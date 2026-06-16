import re
import ipaddress
from email import message_from_string, message_from_bytes
from email.message import Message

IPV4_REGEX = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')

def clean_header_val(val):
    if val is None:
        return ""
    # Standardize header folding whitespace
    return re.sub(r'\s+', ' ', str(val)).strip()

def extract_public_ips(text):
    """Extract all valid public IPv4 addresses from a string."""
    if not text:
        return []
    ips = IPV4_REGEX.findall(text)
    public_ips = []
    for ip in ips:
        try:
            # Basic validation of octets to avoid things like 999.999.999.999
            parts = [int(p) for p in ip.split('.')]
            if any(p > 255 for p in parts):
                continue
            
            ip_obj = ipaddress.ip_address(ip)
            if ip_obj.version == 4:
                # Private IP ranges: 10.x, 192.168.x, 172.16-31.x, 127.x
                # ip_obj.is_private covers 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                # ip_obj.is_loopback covers 127.0.0.0/8
                if not (ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_multicast or ip_obj.is_reserved):
                    if ip not in public_ips:
                        public_ips.append(ip)
        except ValueError:
            continue
    return public_ips

def parse_email_input(raw_content: str) -> dict:
    """
    Parses raw header text into structured components.
    Validates that there is at least one 'Received:' header.
    """
    # Verify we have at least one 'Received' line (case-insensitive)
    # The check is 'received:' in lowercase raw_content, but let's check properly
    # using regex or substring search
    if not re.search(r'(?mi)^Received\s*:', raw_content):
        raise ValueError("This does not look like email headers. Please paste raw headers or upload a .eml file.")

    msg = message_from_string(raw_content)
    
    # Extract standard fields
    parsed = {
        "from": clean_header_val(msg.get("From")),
        "to": clean_header_val(msg.get("To")),
        "subject": clean_header_val(msg.get("Subject")),
        "date": clean_header_val(msg.get("Date")),
        "message_id": clean_header_val(msg.get("Message-ID")),
        "return_path": clean_header_val(msg.get("Return-Path")),
        "received_spf": clean_header_val(msg.get("Received-SPF")),
        "dkim_signature": clean_header_val(msg.get("DKIM-Signature")),
        "received": [clean_header_val(r) for r in msg.get_all("Received") or []]
    }
    
    return parsed

def parse_email_bytes(file_bytes: bytes) -> dict:
    """
    Parses email bytes (from .eml file) into structured components.
    """
    # Try decoding to string to check for Received: headers
    try:
        content_str = file_bytes.decode('utf-8', errors='ignore')
    except Exception:
        raise ValueError("This does not look like email headers. Please paste raw headers or upload a .eml file.")
        
    if not re.search(r'(?mi)^Received\s*:', content_str):
        raise ValueError("This does not look like email headers. Please paste raw headers or upload a .eml file.")
        
    # Python email module can parse bytes directly
    msg = message_from_bytes(file_bytes)
    
    parsed = {
        "from": clean_header_val(msg.get("From")),
        "to": clean_header_val(msg.get("To")),
        "subject": clean_header_val(msg.get("Subject")),
        "date": clean_header_val(msg.get("Date")),
        "message_id": clean_header_val(msg.get("Message-ID")),
        "return_path": clean_header_val(msg.get("Return-Path")),
        "received_spf": clean_header_val(msg.get("Received-SPF")),
        "dkim_signature": clean_header_val(msg.get("DKIM-Signature")),
        "received": [clean_header_val(r) for r in msg.get_all("Received") or []]
    }
    
    return parsed
