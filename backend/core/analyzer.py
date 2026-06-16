import re
from core.parser import extract_public_ips

def extract_domain(email_header_value):
    """Extract domain name from an email address or header value (e.g. 'From: User <user@domain.com>')."""
    if not email_header_value:
        return None
    # Regular expression to extract email domain
    match = re.search(r'[\w\.-]+@([\w\.-]+\.[\w\.-]+)', email_header_value)
    if match:
        return match.group(1).lower().strip()
    return None

def analyze_hops(received_headers):
    """
    Reconstructs hop chain in chronological order (oldest first).
    Identifies the originating IP as the first public IP in the oldest Received: header.
    """
    # received_headers contains Received headers in order of appearance (newest first)
    chronological = list(reversed(received_headers))
    hops = []
    
    for idx, raw_text in enumerate(chronological):
        public_ips = extract_public_ips(raw_text)
        hops.append({
            "hop_number": idx + 1,
            "public_ips": public_ips,
            "raw_text": raw_text,
            "has_public_ip": len(public_ips) > 0
        })
        
    originating_ip = None
    if hops:
        # First hop (index 0) is the oldest hop
        first_hop_ips = hops[0]["public_ips"]
        if first_hop_ips:
            originating_ip = first_hop_ips[0]
        else:
            # Fallback: scan chronological hops for the first public IP found
            for hop in hops:
                if hop["public_ips"]:
                    originating_ip = hop["public_ips"][0]
                    break
                    
    return hops, originating_ip

def analyze_authenticity(parsed_headers: dict) -> dict:
    """
    Evaluates SPF, DKIM, and Domain Alignment, and returns a cumulative risk score and verdict.
    
    SPF: Pass = 0, Softfail = +30, Fail = +40, Missing = +20
    DKIM: Absent = +20, Present = 0
    Domain mismatch: From domain != Return-Path domain = +30
    
    Verdict: 
      0-29 = Legitimate (green)
      30-59 = Suspicious (amber)
      60+ = Likely Spoofed (red)
    """
    # 1. SPF Check
    received_spf = parsed_headers.get("received_spf") or ""
    spf_lower = received_spf.lower()
    
    if not received_spf:
        spf_status = "Missing"
        spf_score = 20
        spf_explanation = "The 'Received-SPF' header is missing from the email headers."
    elif "pass" in spf_lower:
        spf_status = "Pass"
        spf_score = 0
        spf_explanation = f"SPF validation passed: {received_spf}"
    elif "softfail" in spf_lower:
        spf_status = "Softfail"
        spf_score = 30
        spf_explanation = f"SPF validation returned Softfail: {received_spf}. The sender IP is not explicitly authorized, but not hard-failed."
    elif "fail" in spf_lower:
        spf_status = "Fail"
        spf_score = 40
        spf_explanation = f"SPF validation failed: {received_spf}. The sending server is unauthorized to send emails on behalf of this domain."
    else:
        # Default to neutral or unknown as missing/neutral (+20)
        spf_status = "Neutral/Unknown"
        spf_score = 20
        spf_explanation = f"SPF validation is neutral/unknown: {received_spf}."

    # 2. DKIM Check
    dkim_signature = parsed_headers.get("dkim_signature") or ""
    if not dkim_signature:
        dkim_status = "Absent"
        dkim_score = 20
        dkim_explanation = "The 'DKIM-Signature' header is missing. Authenticity cannot be cryptographicially verified."
    else:
        dkim_status = "Present"
        dkim_score = 0
        dkim_explanation = "DKIM cryptographic signature is present, indicating integrity validation was enabled."

    # 3. Domain Mismatch Check
    from_header = parsed_headers.get("from") or ""
    return_path_header = parsed_headers.get("return_path") or ""
    
    from_domain = extract_domain(from_header)
    rp_domain = extract_domain(return_path_header)
    
    mismatch = False
    if not from_domain or not rp_domain:
        # If one is present and the other is missing/empty, it's considered a mismatch.
        if from_domain != rp_domain:
            mismatch = True
    else:
        mismatch = (from_domain != rp_domain)
        
    if mismatch:
        mismatch_status = "Mismatch"
        mismatch_score = 30
        mismatch_explanation = f"Domain mismatch detected. The From domain ({from_domain or 'None'}) does not match the Return-Path domain ({rp_domain or 'None'})."
    else:
        mismatch_status = "Match"
        mismatch_score = 0
        mismatch_explanation = f"Domain matches. The From domain matches the Return-Path domain ({from_domain or 'None'})."

    # Cumulative Score & Verdict
    cumulative_score = spf_score + dkim_score + mismatch_score
    
    if cumulative_score < 30:
        verdict_label = "Legitimate"
        verdict_color = "green"
        verdict_value = "legitimate"
    elif cumulative_score < 60:
        verdict_label = "Suspicious"
        verdict_color = "amber"
        verdict_value = "suspicious"
    else:
        verdict_label = "Likely Spoofed"
        verdict_color = "red"
        verdict_value = "spoofed"
        
    flags = []
    if spf_score > 0:
        flags.append({
            "check": "SPF Validation",
            "status": spf_status,
            "score": spf_score,
            "explanation": spf_explanation
        })
    if dkim_score > 0:
        flags.append({
            "check": "DKIM Signature",
            "status": dkim_status,
            "score": dkim_score,
            "explanation": dkim_explanation
        })
    if mismatch_score > 0:
        flags.append({
            "check": "Domain Alignment",
            "status": mismatch_status,
            "score": mismatch_score,
            "explanation": mismatch_explanation
        })

    return {
        "score": cumulative_score,
        "verdict": {
            "label": verdict_label,
            "color": verdict_color,
            "value": verdict_value
        },
        "flags": flags,
        "details": {
            "spf": {
                "status": spf_status,
                "score": spf_score,
                "explanation": spf_explanation
            },
            "dkim": {
                "status": dkim_status,
                "score": dkim_score,
                "explanation": dkim_explanation
            },
            "domain_alignment": {
                "status": mismatch_status,
                "score": mismatch_score,
                "explanation": mismatch_explanation,
                "from_domain": from_domain,
                "return_path_domain": rp_domain
            }
        }
    }
