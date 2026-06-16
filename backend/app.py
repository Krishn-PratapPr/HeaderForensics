import os
import sqlite3
import datetime
import re
from io import BytesIO
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

# Import core business logic
from core.parser import parse_email_input, parse_email_bytes
from core.geolocation import get_dual_geolocation, detect_provider
from core.analyzer import analyze_hops, analyze_authenticity
from core.report_builder import build_pdf_report

load_dotenv()

app = Flask(__name__)
# Enable CORS for frontend integration
CORS(app)

# SQLite database configuration
DATABASE_DIR = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'instance')
DATABASE_PATH = os.path.join(DATABASE_DIR, 'registry.db')

ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "admin")

def init_db():
    """Initializes the SQLite database and index."""
    os.makedirs(DATABASE_DIR, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS flagged_ips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT NOT NULL,
            reference_id TEXT NOT NULL,
            notes TEXT,
            flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_flagged_ips_ip ON flagged_ips(ip)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_flagged_ips_ref ON flagged_ips(reference_id)')
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        # Check if file is provided or text content
        raw_headers = ""
        
        if 'file' in request.files:
            file = request.files['file']
            file_bytes = file.read()
            # F-01: Max size 100KB
            if len(file_bytes) > 100 * 1024:
                return jsonify({"error": "The .eml file size exceeds the 100KB limit."}), 400
            
            parsed_data = parse_email_bytes(file_bytes)
        else:
            data = request.json or {}
            raw_headers = data.get("headers", "")
            # F-01: Max size 100KB
            if len(raw_headers.encode('utf-8')) > 100 * 1024:
                return jsonify({"error": "The email headers size exceeds the 100KB limit."}), 400
                
            if not raw_headers.strip():
                return jsonify({"error": "Please provide email headers."}), 400
                
            parsed_data = parse_email_input(raw_headers)
            
        # Analyze hops and originating IP
        received = parsed_data.get("received", [])
        hops, originating_ip = analyze_hops(received)
        
        # Analyze spoofing and authenticity
        authenticity = analyze_authenticity(parsed_data)
        
        # Resolve geolocation for originating IP if available
        geolocation = None
        flagged_history = []
        provider = None
        provider_notice = None
        
        if originating_ip:
            geolocation = get_dual_geolocation(originating_ip)
            if geolocation and geolocation.get("ipinfo"):
                org_field = geolocation["ipinfo"].get("isp")
                provider = detect_provider(org_field)
                if provider:
                    provider_notice = (
                        f"The originating IP belongs to {provider}'s mail server infrastructure, "
                        f"not the sender's device. To obtain the sender's actual device IP and location, "
                        f"serve a legal notice to {provider} under Section 67C of the IT Act, 2000, "
                        f"quoting the Message-ID and timestamp from this email."
                    )
            # Check local SQLite registry for previously flagged occurrences
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                'SELECT reference_id, flagged_at, notes FROM flagged_ips WHERE ip = ? ORDER BY flagged_at DESC',
                (originating_ip,)
            )
            flagged_history = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
        return jsonify({
            "headers": parsed_data,
            "hops": hops,
            "originating_ip": originating_ip,
            "geolocation": geolocation,
            "authenticity": authenticity,
            "flagged_history": flagged_history,
            "provider": provider,
            "provider_notice": provider_notice
        }), 200
        
    except ValueError as val_err:
        return jsonify({"error": str(val_err)}), 400
    except Exception as e:
        return jsonify({"error": f"An error occurred during analysis: {str(e)}"}), 500

@app.route('/api/flag', methods=['POST'])
def flag_ip():
    data = request.json or {}
    ip = data.get("ip")
    reference_id = data.get("reference_id")
    notes = data.get("notes", "")
    admin_password = data.get("admin_password")
    
    # Validation
    if not ip or not reference_id:
        return jsonify({"error": "IP address and Reference ID are required."}), 400
        
    if len(reference_id) > 30:
        return jsonify({"error": "Reference ID must be 30 characters or less."}), 400
        
    if not admin_password:
        return jsonify({"error": "Admin password is required."}), 400
        
    if admin_password != ADMIN_SECRET_KEY:
        return jsonify({"error": "Incorrect admin password."}), 401
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO flagged_ips (ip, reference_id, notes) VALUES (?, ?, ?)',
            (ip, reference_id, notes)
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"IP {ip} successfully flagged."}), 200
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route('/api/registry', methods=['GET'])
def get_registry():
    ip_query = request.args.get("ip", "").strip()
    ref_query = request.args.get("reference_id", "").strip()
    start_date = request.args.get("start_date", "").strip() # YYYY-MM-DD
    end_date = request.args.get("end_date", "").strip() # YYYY-MM-DD
    
    query = "SELECT id, ip, reference_id, notes, flagged_at FROM flagged_ips WHERE 1=1"
    params = []
    
    if ip_query:
        query += " AND ip LIKE ?"
        params.append(f"%{ip_query}%")
    if ref_query:
        query += " AND reference_id LIKE ?"
        params.append(f"%{ref_query}%")
    if start_date:
        query += " AND date(flagged_at) >= date(?)"
        params.append(start_date)
    if end_date:
        query += " AND date(flagged_at) <= date(?)"
        params.append(end_date)
        
    query += " ORDER BY flagged_at DESC"
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        results = [dict(row) for row in rows]
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"error": f"Database query failed: {str(e)}"}), 500

@app.route('/api/registry/delete', methods=['POST'])
def delete_flag():
    data = request.json or {}
    record_id = data.get("id")
    admin_password = data.get("admin_password")
    
    if not record_id:
        return jsonify({"error": "Record ID is required."}), 400
        
    if not admin_password:
        return jsonify({"error": "Admin password is required."}), 400
        
    if admin_password != ADMIN_SECRET_KEY:
        return jsonify({"error": "Incorrect admin password."}), 401
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify it exists
        cursor.execute('SELECT id FROM flagged_ips WHERE id = ?', (record_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Record not found."}), 404
            
        cursor.execute('DELETE FROM flagged_ips WHERE id = ?', (record_id,))
        conn.commit()
        conn.close()
        
        return jsonify({"success": True, "message": "Record successfully deleted."}), 200
    except Exception as e:
        return jsonify({"error": f"Database delete failed: {str(e)}"}), 500

@app.route('/api/registry/export', methods=['GET'])
def export_csv():
    ip_query = request.args.get("ip", "").strip()
    ref_query = request.args.get("reference_id", "").strip()
    start_date = request.args.get("start_date", "").strip()
    end_date = request.args.get("end_date", "").strip()
    
    query = "SELECT ip, reference_id, notes, flagged_at FROM flagged_ips WHERE 1=1"
    params = []
    
    if ip_query:
        query += " AND ip LIKE ?"
        params.append(f"%{ip_query}%")
    if ref_query:
        query += " AND reference_id LIKE ?"
        params.append(f"%{ref_query}%")
    if start_date:
        query += " AND date(flagged_at) >= date(?)"
        params.append(start_date)
    if end_date:
        query += " AND date(flagged_at) <= date(?)"
        params.append(end_date)
        
    query += " ORDER BY flagged_at DESC"
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        # Build CSV string
        import csv
        output = BytesIO()
        # csv writer works with strings, so we wrap it
        from io import TextIOWrapper
        wrapper = TextIOWrapper(output, encoding='utf-8', newline='')
        writer = csv.writer(wrapper)
        writer.writerow(["IP Address", "Reference ID", "Notes", "Flagged At"])
        for row in rows:
            writer.writerow([row["ip"], row["reference_id"], row["notes"], row["flagged_at"]])
        wrapper.flush()
        output.seek(0)
        
        return send_file(
            output,
            mimetype="text/csv",
            as_attachment=True,
            download_name=f"EHA_flagged_ips_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        )
    except Exception as e:
        return jsonify({"error": f"CSV export failed: {str(e)}"}), 500

@app.route('/api/report', methods=['POST'])
def generate_report():
    data = request.json or {}
    analysis_data = data.get("analysis_data")
    reference_id = data.get("reference_id", "").strip()
    analyst_name = data.get("analyst_name", "").strip()
    organization = data.get("organization", "").strip()
    
    if not analysis_data:
        return jsonify({"error": "Analysis data is required to build a report."}), 400
        
    if not reference_id or not analyst_name:
        return jsonify({"error": "Reference ID and Analyst Name are required."}), 400
        
    if len(reference_id) > 30:
        return jsonify({"error": "Reference ID must be 30 characters or less."}), 400
        
    # Get current timestamp formatted
    now = datetime.datetime.now()
    timestamp_str = now.strftime("%Y-%m-%d %H:%M:%S")
    file_timestamp = now.strftime("%Y%m%d_%H%M%S")
    
    meta_info = {
        "reference_id": reference_id,
        "analyst_name": analyst_name,
        "organization": organization or "N/A",
        "timestamp": timestamp_str
    }
    
    # Check if the originating IP is flagged (for report alert section F-07)
    originating_ip = analysis_data.get("originating_ip")
    was_flagged_info = []
    if originating_ip:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                'SELECT reference_id, flagged_at, notes FROM flagged_ips WHERE ip = ? ORDER BY flagged_at DESC',
                (originating_ip,)
            )
            was_flagged_info = [dict(row) for row in cursor.fetchall()]
            conn.close()
        except Exception:
            pass
            
    try:
        pdf_bytes = build_pdf_report(analysis_data, meta_info, was_flagged_info)
        
        # Clean reference ID for filename
        sanitized_ref = re.sub(r'[^a-zA-Z0-9_-]', '', reference_id)
        if not sanitized_ref:
            sanitized_ref = "REPORT"
            
        return send_file(
            BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"EHA_{sanitized_ref}_{file_timestamp}.pdf"
        )
    except Exception as e:
        return jsonify({"error": f"Failed to generate report: {str(e)}"}), 500

if __name__ == '__main__':
    # Running locally
    port = int(os.getenv("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
