import os
import datetime
import re
from io import BytesIO
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# Import core business logic
from core.parser import parse_email_input, parse_email_bytes
from core.geolocation import get_dual_geolocation, detect_provider
from core.analyzer import analyze_hops, analyze_authenticity
from core.report_builder import build_pdf_report

load_dotenv()

app = Flask(__name__)
# Enable CORS for frontend integration
CORS(app)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL")

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class FlaggedIP(db.Model):
    __tablename__ = 'flagged_ips'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ip = db.Column(db.String(45), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)
    reference_id = db.Column(db.String(30), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    reason = db.Column(db.Text, nullable=True)
    flagged_by = db.Column(db.String(100), nullable=False)
    flagged_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class Admin(db.Model):
    __tablename__ = 'admins'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

def init_db():
    """Initializes the database schema."""
    if not DATABASE_URL:
        print("WARNING: DATABASE_URL is not set. Skipping database initialization.")
        return
    try:
        with app.app_context():
            db.create_all()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Error initializing database: {e}")

# Initialize database on startup
init_db()

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
            # Check local PostgreSQL registry for previously flagged occurrences
            records = FlaggedIP.query.filter_by(ip=originating_ip).order_by(FlaggedIP.flagged_at.desc()).all()
            flagged_history = [{
                "reference_id": r.reference_id,
                "flagged_at": r.flagged_at.isoformat() if r.flagged_at else None,
                "notes": r.notes
            } for r in records]
            
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
    username = data.get("username")
    password = data.get("password")
    
    # Validation
    if not ip or not reference_id:
        return jsonify({"error": "IP address and Reference ID are required."}), 400
        
    if len(reference_id) > 30:
        return jsonify({"error": "Reference ID must be 30 characters or less."}), 400
        
    if not username or not password:
        return jsonify({"error": "Admin credentials are required."}), 400
        
    # Verify admin credentials
    admin = Admin.query.filter_by(username=username).first()
    if not admin or not check_password_hash(admin.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401
        
    try:
        new_flag = FlaggedIP(
            ip=ip,
            ip_address=ip,
            reference_id=reference_id,
            notes=notes,
            reason=notes,
            flagged_by=username
        )
        db.session.add(new_flag)
        db.session.commit()
        return jsonify({"success": True, "message": f"IP {ip} successfully flagged."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route('/api/registry', methods=['GET'])
def get_registry():
    ip_query = request.args.get("ip", "").strip()
    ref_query = request.args.get("reference_id", "").strip()
    start_date = request.args.get("start_date", "").strip() # YYYY-MM-DD
    end_date = request.args.get("end_date", "").strip() # YYYY-MM-DD
    
    query = FlaggedIP.query
    
    if ip_query:
        query = query.filter(FlaggedIP.ip.like(f"%{ip_query}%"))
    if ref_query:
        query = query.filter(FlaggedIP.reference_id.like(f"%{ref_query}%"))
    if start_date:
        try:
            s_date = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(db.cast(FlaggedIP.flagged_at, db.Date) >= s_date)
        except ValueError:
            pass
    if end_date:
        try:
            e_date = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(db.cast(FlaggedIP.flagged_at, db.Date) <= e_date)
        except ValueError:
            pass
            
    query = query.order_by(FlaggedIP.flagged_at.desc())
    
    try:
        records = query.all()
        results = [{
            "id": r.id,
            "ip": r.ip,
            "reference_id": r.reference_id,
            "notes": r.notes,
            "flagged_at": r.flagged_at.isoformat() if r.flagged_at else None
        } for r in records]
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"error": f"Database query failed: {str(e)}"}), 500

@app.route('/api/registry/delete', methods=['POST'])
def delete_flag():
    data = request.json or {}
    record_id = data.get("id")
    username = data.get("username")
    password = data.get("password")
    
    if not record_id:
        return jsonify({"error": "Record ID is required."}), 400
        
    if not username or not password:
        return jsonify({"error": "Admin credentials are required."}), 400
        
    # Verify admin credentials
    admin = Admin.query.filter_by(username=username).first()
    if not admin or not check_password_hash(admin.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401
        
    try:
        record = FlaggedIP.query.get(record_id)
        if not record:
            return jsonify({"error": "Record not found."}), 404
            
        db.session.delete(record)
        db.session.commit()
        
        return jsonify({"success": True, "message": "Record successfully deleted."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database delete failed: {str(e)}"}), 500

@app.route('/api/registry/export', methods=['GET'])
def export_csv():
    ip_query = request.args.get("ip", "").strip()
    ref_query = request.args.get("reference_id", "").strip()
    start_date = request.args.get("start_date", "").strip()
    end_date = request.args.get("end_date", "").strip()
    
    query = FlaggedIP.query
    
    if ip_query:
        query = query.filter(FlaggedIP.ip.like(f"%{ip_query}%"))
    if ref_query:
        query = query.filter(FlaggedIP.reference_id.like(f"%{ref_query}%"))
    if start_date:
        try:
            s_date = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(db.cast(FlaggedIP.flagged_at, db.Date) >= s_date)
        except ValueError:
            pass
    if end_date:
        try:
            e_date = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(db.cast(FlaggedIP.flagged_at, db.Date) <= e_date)
        except ValueError:
            pass
            
    query = query.order_by(FlaggedIP.flagged_at.desc())
    
    try:
        records = query.all()
        
        # Build CSV string
        import csv
        output = BytesIO()
        from io import TextIOWrapper
        wrapper = TextIOWrapper(output, encoding='utf-8', newline='')
        writer = csv.writer(wrapper)
        writer.writerow(["IP Address", "Reference ID", "Notes", "Flagged At"])
        for r in records:
            writer.writerow([r.ip, r.reference_id, r.notes, r.flagged_at.strftime('%Y-%m-%d %H:%M:%S') if r.flagged_at else ''])
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
            records = FlaggedIP.query.filter_by(ip=originating_ip).order_by(FlaggedIP.flagged_at.desc()).all()
            was_flagged_info = [{
                "reference_id": r.reference_id,
                "flagged_at": r.flagged_at.strftime('%Y-%m-%d %H:%M:%S') if r.flagged_at else '',
                "notes": r.notes
            } for r in records]
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
