import unittest
import sys
import os
import json
import sqlite3

# Adjust python path to import backend modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from core.parser import extract_public_ips, parse_email_input
from core.analyzer import analyze_hops, analyze_authenticity, extract_domain
from core.geolocation import detect_provider
from app import app, init_db, DATABASE_PATH, ADMIN_SECRET_KEY

class TestEmailHeaderAnalyzer(unittest.TestCase):
    def setUp(self):
        # Configure Flask app for testing
        app.config['TESTING'] = True
        self.client = app.test_client()
        
        # Make sure database is initialized and clear it for tests
        init_db()
        self.clear_db()

    def tearDown(self):
        self.clear_db()

    def clear_db(self):
        if os.path.exists(DATABASE_PATH):
            conn = sqlite3.connect(DATABASE_PATH)
            c = conn.cursor()
            c.execute('DELETE FROM flagged_ips')
            conn.commit()
            conn.close()

    def test_ip_extraction(self):
        raw_received = """from mail-io1-f169.google.com (mail-io1-f169.google.com [209.85.166.169])
        by mx.google.com with ESMTPS id o21-20020a05620a235500b00787e9d722bfsi3429392qka.169.2023.07.13.11.23.51
        for <user@example.com>
        (version=TLS1_3 cipher=ECDHE-RSA-AES128-GCM-SHA256 bits=128/128);
        Thu, 13 Jul 2023 11:23:52 -0700 (PDT)"""
        
        # 209.85.166.169 is public, should be extracted
        extracted = extract_public_ips(raw_received)
        self.assertIn("209.85.166.169", extracted)

        # Private IPs should be filtered out
        private_text = "from relay (192.168.1.50) by mx (10.0.0.1) with SMTP"
        extracted_p = extract_public_ips(private_text)
        self.assertEqual(len(extracted_p), 0)

    def test_domain_extraction(self):
        self.assertEqual(extract_domain('"Sender Name" <sender@example.com>'), 'example.com')
        self.assertEqual(extract_domain('return-path@sub.domain.co.uk'), 'sub.domain.co.uk')
        self.assertEqual(extract_domain('<bounces@service.net>'), 'service.net')
        self.assertIsNone(extract_domain('no-email-address-here'))

    def test_authenticity_scoring(self):
        # Complete Legitimate case (SPF Pass, DKIM present, matching domains)
        headers = {
            "received_spf": "pass (google.com: domain of sender@example.com designates 209.85.166.169 as authorized sender)",
            "dkim_signature": "v=1; a=rsa-sha256; c=relaxed/relaxed; d=example.com;",
            "from": "sender@example.com",
            "return_path": "sender@example.com"
        }
        auth = analyze_authenticity(headers)
        self.assertEqual(auth["score"], 0)
        self.assertEqual(auth["verdict"]["value"], "legitimate")

        # Spoofed case (SPF Fail, DKIM absent, domain mismatch)
        spoofed_headers = {
            "received_spf": "fail (google.com: domain of evil@attacker.com does not designate 1.2.3.4)",
            "dkim_signature": "",
            "from": "ceo@victimcompany.com",
            "return_path": "evil@attacker.com"
        }
        auth_spoofed = analyze_authenticity(spoofed_headers)
        # SPF Fail (+40) + DKIM Absent (+20) + Domain Mismatch (+30) = 90
        self.assertEqual(auth_spoofed["score"], 90)
        self.assertEqual(auth_spoofed["verdict"]["value"], "spoofed")

    def test_api_analyze_validation(self):
        # Test missing Received line
        invalid_headers = "From: sender@example.com\nTo: receiver@example.com\nSubject: Test"
        response = self.client.post('/api/analyze', 
                                    data=json.dumps({"headers": invalid_headers}),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertIn("This does not look like email headers", response.get_json()["error"])

        # Test exceeding size limit (100KB)
        large_headers = "Received: from local\n" * 8000 # ~200KB
        response_large = self.client.post('/api/analyze',
                                          data=json.dumps({"headers": large_headers}),
                                          content_type='application/json')
        self.assertEqual(response_large.status_code, 400)
        self.assertIn("exceeds the 100KB limit", response_large.get_json()["error"])

    def test_flagged_ip_registry_flow(self):
        # 1. Verify registry starts empty
        res = self.client.get('/api/registry')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.get_json()), 0)

        # 2. Flag an IP (bad password)
        flag_payload = {
            "ip": "8.8.8.8",
            "reference_id": "REF-001",
            "notes": "Testing flagging flow",
            "admin_password": "wrongpassword"
        }
        res_flag = self.client.post('/api/flag', data=json.dumps(flag_payload), content_type='application/json')
        self.assertEqual(res_flag.status_code, 401)

        # 3. Flag an IP (correct password)
        flag_payload["admin_password"] = ADMIN_SECRET_KEY
        res_flag = self.client.post('/api/flag', data=json.dumps(flag_payload), content_type='application/json')
        self.assertEqual(res_flag.status_code, 200)
        self.assertTrue(res_flag.get_json()["success"])

        # 4. Verify IP is in registry
        res_search = self.client.get('/api/registry?ip=8.8.8.8')
        records = res_search.get_json()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["reference_id"], "REF-001")
        record_id = records[0]["id"]

        # 5. Delete flag (correct password)
        delete_payload = {
            "id": record_id,
            "admin_password": ADMIN_SECRET_KEY
        }
        res_del = self.client.post('/api/registry/delete', data=json.dumps(delete_payload), content_type='application/json')
        self.assertEqual(res_del.status_code, 200)
        self.assertTrue(res_del.get_json()["success"])

        # 6. Verify registry is empty again
        res_empty = self.client.get('/api/registry')
        self.assertEqual(len(res_empty.get_json()), 0)

    def test_provider_detection(self):
        self.assertEqual(detect_provider("AS15169 Google LLC"), "Google")
        self.assertEqual(detect_provider("Google Inc."), "Google")
        self.assertEqual(detect_provider("AS8075 Microsoft Corporation"), "Microsoft")
        self.assertEqual(detect_provider("AS10310 Yahoo! Inc."), "Yahoo")
        self.assertEqual(detect_provider("Amazon.com, Inc."), "Amazon SES")
        self.assertEqual(detect_provider("SendGrid, Inc."), "SendGrid")
        self.assertEqual(detect_provider("Mailchimp"), "Mailchimp")
        self.assertEqual(detect_provider("The Rocket Science Group LLC"), "Mailchimp")
        self.assertEqual(detect_provider("Zoho Corporation"), "Zoho")
        self.assertEqual(detect_provider("Proton AG"), "ProtonMail")
        self.assertEqual(detect_provider("Apple Inc."), "Apple")
        self.assertIsNone(detect_provider("Comcast Cable Communications, LLC"))
        self.assertIsNone(detect_provider(None))
        self.assertIsNone(detect_provider(""))

    def test_api_analyze_provider_detection(self):
        from unittest.mock import patch
        
        mock_geo = {
            "ip": "209.85.166.169",
            "ipinfo": {
                "city": "Mountain View",
                "region": "California",
                "country": "US",
                "isp": "Google LLC",
                "lat": 37.4056,
                "lon": -122.0775,
                "timezone": "America/Los_Angeles",
                "success": True
            },
            "ip_api": {
                "city": "Mountain View",
                "region": "California",
                "country": "United States",
                "isp": "Google LLC",
                "lat": 37.4056,
                "lon": -122.0775,
                "timezone": "America/Los_Angeles",
                "success": True
            },
            "confidence": {
                "status": "confirmed",
                "label": "Confirmed by 2 Sources",
                "color": "green"
            }
        }
        
        headers_data = (
            "Received: from mail-io1-f169.google.com (mail-io1-f169.google.com [209.85.166.169])\n"
            "by mx.google.com with ESMTPS id o21-20020a05620a235500b00787e9d722bfsi3429392qka.169.2023.07.13.11.23.51\n"
            "for <user@example.com>;\n"
            "Thu, 13 Jul 2023 11:23:52 -0700 (PDT)\n"
            "From: sender@example.com\n"
            "To: receiver@example.com\n"
            "Subject: Hello"
        )
        
        with patch('app.get_dual_geolocation', return_value=mock_geo):
            response = self.client.post('/api/analyze',
                                        data=json.dumps({"headers": headers_data}),
                                        content_type='application/json')
            self.assertEqual(response.status_code, 200)
            res_data = response.get_json()
            self.assertEqual(res_data["provider"], "Google")
            self.assertIn("Section 67C of the IT Act, 2000", res_data["provider_notice"])
            self.assertIn("Google's mail server infrastructure", res_data["provider_notice"])

if __name__ == '__main__':
    unittest.main()
