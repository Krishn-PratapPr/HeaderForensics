from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def add_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#555555'))
    canvas.drawString(54, 30, "Email Header Analyzer (EHA) - Evidence Report")
    canvas.drawRightString(595.27 - 54, 30, f"Page {canvas._pageNumber}")
    canvas.restoreState()

def build_pdf_report(analysis_data: dict, meta_info: dict, was_flagged_info: list = None) -> bytes:
    """
    Generates a black & white, laser-printer friendly A4 PDF evidence report.
    Returns the PDF as raw bytes.
    """
    buffer = BytesIO()
    
    # Page setup
    # A4 is 595.27 x 841.89 points
    # 0.75 in margin is 54 points
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom, unique ParagraphStyles to avoid collisions
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#000000'),
        spaceAfter=15
    )
    
    h2_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#000000'),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#111111'),
        spaceAfter=4
    )
    
    body_bold_style = ParagraphStyle(
        'BodyTextBoldCustom',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    code_style = ParagraphStyle(
        'CodeStyleCustom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#222222')
    )
    
    disclaimer_style = ParagraphStyle(
        'DisclaimerStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#444444'),
        spaceBefore=15
    )

    elements = []
    
    # Title Block
    elements.append(Paragraph("EMAIL HEADER ANALYSIS EVIDENCE REPORT", title_style))
    elements.append(Spacer(1, 5))
    
    # Cover Metadata Block
    meta_data = [
        [Paragraph("<b>Reference ID:</b>", body_style), Paragraph(meta_info.get("reference_id", "N/A"), body_style)],
        [Paragraph("<b>Analyst Name:</b>", body_style), Paragraph(meta_info.get("analyst_name", "N/A"), body_style)],
        [Paragraph("<b>Organization:</b>", body_style), Paragraph(meta_info.get("organization", "N/A"), body_style)],
        [Paragraph("<b>Date Generated:</b>", body_style), Paragraph(meta_info.get("timestamp", "N/A"), body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[120, 367])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC')),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 10))
    
    # 1. Email Summary
    elements.append(Paragraph("1. Email Headers Summary", h2_style))
    headers = analysis_data.get("headers", {})
    summary_data = [
        [Paragraph("<b>From:</b>", body_style), Paragraph(headers.get("from", "N/A"), body_style)],
        [Paragraph("<b>To:</b>", body_style), Paragraph(headers.get("to", "N/A"), body_style)],
        [Paragraph("<b>Subject:</b>", body_style), Paragraph(headers.get("subject", "N/A"), body_style)],
        [Paragraph("<b>Date:</b>", body_style), Paragraph(headers.get("date", "N/A"), body_style)],
        [Paragraph("<b>Message-ID:</b>", body_style), Paragraph(headers.get("message_id", "N/A"), body_style)],
        [Paragraph("<b>Return-Path:</b>", body_style), Paragraph(headers.get("return_path", "N/A"), body_style)],
    ]
    summary_table = Table(summary_data, colWidths=[120, 367])
    summary_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#EEEEEE')),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 10))
    
    # 2. Originating IP + Geolocation
    elements.append(Paragraph("2. Originating IP & Geolocation Details", h2_style))
    orig_ip = analysis_data.get("originating_ip")
    elements.append(Paragraph(f"<b>Originating IP Address:</b> {orig_ip or 'Not found'}", body_bold_style))
    
    # Confidence Badge Section
    confidence = analysis_data.get("geolocation", {}).get("confidence", {})
    badge_label = confidence.get("label", "N/A")
    elements.append(Paragraph(f"<b>Geolocation Confidence Level:</b> {badge_label}", body_style))
    elements.append(Spacer(1, 5))
    
    # Geolocation comparisons
    geo_data = [
        [Paragraph("<b>Data Field</b>", body_bold_style), Paragraph("<b>Primary (ipinfo.io)</b>", body_bold_style), Paragraph("<b>Secondary (ip-api.com)</b>", body_bold_style)]
    ]
    
    ipinfo = analysis_data.get("geolocation", {}).get("ipinfo") or {}
    ip_api = analysis_data.get("geolocation", {}).get("ip_api") or {}
    
    fields = [
        ("city", "City"),
        ("region", "Region/State"),
        ("country", "Country"),
        ("isp", "ISP (Organization)"),
        ("lat", "Latitude"),
        ("lon", "Longitude"),
        ("timezone", "Timezone")
    ]
    
    for key, label in fields:
        val1 = ipinfo.get(key)
        val2 = ip_api.get(key)
        if key in ["lat", "lon"]:
            v1_str = f"{val1:.4f}" if isinstance(val1, (int, float)) else str(val1 or "N/A")
            v2_str = f"{val2:.4f}" if isinstance(val2, (int, float)) else str(val2 or "N/A")
        else:
            v1_str = str(val1 or "N/A")
            v2_str = str(val2 or "N/A")
            
        geo_data.append([
            Paragraph(label, body_style),
            Paragraph(v1_str, body_style),
            Paragraph(v2_str, body_style)
        ])
        
    geo_table = Table(geo_data, colWidths=[110, 188, 189])
    geo_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC')),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F5F5F5')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(geo_table)
    elements.append(Spacer(1, 10))
    
    # 3. Spoofing & Authenticity Analysis
    elements.append(Paragraph("3. Spoofing & Authenticity Analysis", h2_style))
    auth = analysis_data.get("authenticity", {})
    verdict = auth.get("verdict", {})
    verdict_label = verdict.get("label", "Unknown").upper()
    elements.append(Paragraph(f"<b>Verdict:</b> {verdict_label} (Cumulative Risk Score: {auth.get('score', 0)})", body_bold_style))
    elements.append(Spacer(1, 5))
    
    flags = auth.get("flags", [])
    if flags:
        flags_data = [
            [Paragraph("<b>Check</b>", body_bold_style), Paragraph("<b>Status</b>", body_bold_style), Paragraph("<b>Risk Impact</b>", body_bold_style), Paragraph("<b>Details</b>", body_bold_style)]
        ]
        for f in flags:
            flags_data.append([
                Paragraph(f.get("check", ""), body_style),
                Paragraph(f.get("status", ""), body_style),
                Paragraph(f"+{f.get('score', 0)}", body_style),
                Paragraph(f.get("explanation", ""), body_style)
            ])
        flags_table = Table(flags_data, colWidths=[100, 70, 70, 247])
        flags_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC')),
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F5F5F5')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
        ]))
        elements.append(flags_table)
    else:
        elements.append(Paragraph("No authenticity issues detected. The email domain checks passed cleanly.", body_style))
    elements.append(Spacer(1, 10))
    
    # 4. Hop Chain
    elements.append(Paragraph("4. Mail Server Hop Chain (Chronological, Oldest First)", h2_style))
    hops = analysis_data.get("hops", [])
    if hops:
        hops_data = [
            [Paragraph("<b>Hop #</b>", body_bold_style), Paragraph("<b>IP Addresses Detected</b>", body_bold_style), Paragraph("<b>Received Header Snippet</b>", body_bold_style)]
        ]
        for h in hops:
            num = h.get("hop_number")
            public_ips = h.get("public_ips") or []
            ips_str = ", ".join(public_ips) if public_ips else "Internal relay — no public IP"
            
            # Truncate first 150 characters
            raw_text = h.get("raw_text", "")
            snippet = raw_text[:150] + ("..." if len(raw_text) > 150 else "")
            
            hop_lbl = f"Hop {num}"
            if num == 1:
                hop_lbl = "Hop 1 (Origin)"
                
            hops_data.append([
                Paragraph(hop_lbl, body_style),
                Paragraph(ips_str, body_style),
                Paragraph(snippet, code_style)
            ])
            
        hops_table = Table(hops_data, colWidths=[90, 110, 287])
        hops_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC')),
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F5F5F5')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
        ]))
        elements.append(hops_table)
    else:
        elements.append(Paragraph("No hop chain details detected in email headers.", body_style))
    elements.append(Spacer(1, 10))
    
    # 5. Flagged IP Registry Alert (If applicable)
    if was_flagged_info:
        elements.append(Paragraph("5. Flagged Registry Alert", h2_style))
        elements.append(Paragraph("<b>CAUTION:</b> The originating IP of this analysis was previously flagged in the local database registry. Summary of prior occurrences:", body_bold_style))
        elements.append(Spacer(1, 5))
        
        warn_data = [
            [Paragraph("<b>Reference ID</b>", body_bold_style), Paragraph("<b>Date Flagged</b>", body_bold_style), Paragraph("<b>Analyst Notes</b>", body_bold_style)]
        ]
        for f in was_flagged_info:
            warn_data.append([
                Paragraph(f.get("reference_id", "N/A"), body_style),
                Paragraph(f.get("flagged_at", "N/A"), body_style),
                Paragraph(f.get("notes", "N/A"), body_style)
            ])
            
        warn_table = Table(warn_data, colWidths=[120, 120, 247])
        warn_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('GRID', (0,0), (-1,-1), 1.0, colors.HexColor('#000000')),
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#EEEEEE')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
        ]))
        elements.append(warn_table)
        elements.append(Spacer(1, 10))
        
    # Statutory Disclaimer
    elements.append(Paragraph("<b>Statutory Disclaimer:</b> City-level accuracy is ~65%. Country and ISP are reliable. For legally admissible subscriber identity, contact the relevant ISP or local authorities.", disclaimer_style))
    
    # Build Document
    doc.build(elements, onFirstPage=add_footer, onLaterPages=add_footer)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
