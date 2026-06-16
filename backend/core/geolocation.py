import requests
from concurrent.futures import ThreadPoolExecutor

PROVIDER_MAPPING = [
    ("google", "Google"),
    ("microsoft", "Microsoft"),
    ("yahoo", "Yahoo"),
    ("amazon", "Amazon SES"),
    ("sendgrid", "SendGrid"),
    ("mailchimp", "Mailchimp"),
    ("rocket science group", "Mailchimp"),
    ("zoho", "Zoho"),
    ("proton", "ProtonMail"),
    ("apple", "Apple"),
]

def detect_provider(org: str) -> str:
    """
    Checks the org field against known mail providers.
    Returns the provider name if matched, else None.
    """
    if not org:
        return None
    org_lower = org.lower()
    for keyword, provider_name in PROVIDER_MAPPING:
        if keyword in org_lower:
            return provider_name
    return None

def fetch_ipinfo(ip):
    try:
        url = f"https://ipinfo.io/{ip}/json"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if "bogon" in data and data["bogon"]:
                return None
            
            # Parse lat, lon from "loc": "37.4056,-122.0775"
            lat, lon = None, None
            loc = data.get("loc", "")
            if loc and "," in loc:
                try:
                    lat_str, lon_str = loc.split(",")
                    lat = float(lat_str)
                    lon = float(lon_str)
                except ValueError:
                    pass

            return {
                "city": data.get("city"),
                "region": data.get("region"),
                "country": data.get("country"),
                "isp": data.get("org"), # org represents ISP in ipinfo
                "lat": lat,
                "lon": lon,
                "timezone": data.get("timezone"),
                "success": True
            }
    except Exception:
        pass
    return None

def fetch_ip_api(ip):
    try:
        # ip-api free tier requires http, not https
        url = f"http://ip-api.com/json/{ip}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "fail":
                return None
            
            return {
                "city": data.get("city"),
                "region": data.get("regionName"),
                "country": data.get("country"),
                "isp": data.get("isp"),
                "lat": data.get("lat"),
                "lon": data.get("lon"),
                "timezone": data.get("timezone"),
                "success": True
            }
    except Exception:
        pass
    return None

def get_dual_geolocation(ip: str) -> dict:
    """
    Queries ipinfo.io and ip-api.com in parallel using a ThreadPoolExecutor.
    Compares the city fields and assigns a confidence badge.
    """
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_ipinfo = executor.submit(fetch_ipinfo, ip)
        future_ip_api = executor.submit(fetch_ip_api, ip)
        
        res_ipinfo = future_ipinfo.result()
        res_ip_api = future_ip_api.result()
        
    # Analyze responses and determine confidence badge
    badge = {
        "status": "failed",
        "label": "Geolocation Unavailable — Offline Mode",
        "color": "red"
    }
    
    if res_ipinfo and res_ip_api:
        city_ipinfo = (res_ipinfo.get("city") or "").strip().lower()
        city_ip_api = (res_ip_api.get("city") or "").strip().lower()
        
        if city_ipinfo and city_ip_api and city_ipinfo == city_ip_api:
            badge = {
                "status": "confirmed",
                "label": "Confirmed by 2 Sources",
                "color": "green"
            }
        else:
            badge = {
                "status": "disagreed",
                "label": "Location Estimated — Sources Disagree",
                "color": "amber"
            }
    elif res_ipinfo or res_ip_api:
        badge = {
            "status": "single",
            "label": "Single Source — Treat as Estimate",
            "color": "grey"
        }
        
    return {
        "ip": ip,
        "ipinfo": res_ipinfo,
        "ip_api": res_ip_api,
        "confidence": badge
    }
