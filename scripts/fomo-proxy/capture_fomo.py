"""
Fomo API Capture Script for mitmproxy
Captures and logs all API calls from the Fomo app

Usage:
  mitmweb -s capture_fomo.py --listen-port 8080

Then configure your phone to use this PC as proxy (192.168.1.202:8080)
"""

import json
import os
from datetime import datetime
from mitmproxy import http, ctx

# Output directory for captured data
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "captured_data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Track unique endpoints
endpoints_file = os.path.join(OUTPUT_DIR, "endpoints.json")
endpoints = {}

# Domains to capture (Fomo + GMGN + DexScreener + Axiom)
CAPTURE_DOMAINS = [
    # Fomo
    "fomo.family",
    "api.fomo",
    "privy.io",
    "auth.privy.io",
    # GMGN
    "gmgn.ai",
    "api.gmgn",
    "gmgn.com",
    "gmgn.gracematrix.net",
    "gracematrix.net",
    # DexScreener
    "dexscreener.com",
    "api.dexscreener.com",
    "io.dexscreener",
    # Axiom
    "axiom.trade",
    "api.axiom",
    "axiom.xyz",
]

def is_target_domain(host: str) -> bool:
    """Check if the request is from a target domain"""
    return any(domain in host for domain in CAPTURE_DOMAINS)


class FomoCapture:
    def __init__(self):
        self.request_count = 0
        self.load_endpoints()
    
    def load_endpoints(self):
        global endpoints
        if os.path.exists(endpoints_file):
            with open(endpoints_file, 'r') as f:
                endpoints = json.load(f)
    
    def save_endpoints(self):
        with open(endpoints_file, 'w') as f:
            json.dump(endpoints, f, indent=2)
    
    def request(self, flow: http.HTTPFlow) -> None:
        """Log outgoing requests"""
        host = flow.request.host
        
        if is_target_domain(host):
            self.request_count += 1
            method = flow.request.method
            path = flow.request.path
            
            ctx.log.info(f"[FOMO REQUEST #{self.request_count}] {method} {host}{path}")
            
            # Log headers (look for auth tokens)
            headers = dict(flow.request.headers)
            if 'authorization' in headers or 'Authorization' in headers:
                ctx.log.warn(f"[AUTH FOUND] {headers.get('authorization', headers.get('Authorization', ''))[:50]}...")
    
    def response(self, flow: http.HTTPFlow) -> None:
        """Capture and save responses"""
        host = flow.request.host
        
        if not is_target_domain(host):
            return
        
        method = flow.request.method
        path = flow.request.path
        status = flow.response.status_code
        
        # Create endpoint key
        endpoint_key = f"{method} {path.split('?')[0]}"
        
        # Track endpoint
        if endpoint_key not in endpoints:
            endpoints[endpoint_key] = {
                "method": method,
                "host": host,
                "path": path.split('?')[0],
                "first_seen": datetime.now().isoformat(),
                "sample_count": 0,
                "has_auth": False,
                "response_sample": None
            }
        
        endpoints[endpoint_key]["sample_count"] += 1
        endpoints[endpoint_key]["last_seen"] = datetime.now().isoformat()
        
        # Check for auth
        headers = dict(flow.request.headers)
        if 'authorization' in [h.lower() for h in headers.keys()]:
            endpoints[endpoint_key]["has_auth"] = True
        
        # Save response sample (first one only, if JSON)
        if endpoints[endpoint_key]["response_sample"] is None:
            content_type = flow.response.headers.get("content-type", "")
            if "json" in content_type:
                try:
                    body = flow.response.get_text()
                    data = json.loads(body)
                    
                    # Save full response to file
                    safe_path = path.split('?')[0].replace('/', '_').strip('_')
                    filename = f"{method}_{safe_path}_{datetime.now().strftime('%H%M%S')}.json"
                    filepath = os.path.join(OUTPUT_DIR, filename)
                    
                    with open(filepath, 'w') as f:
                        json.dump({
                            "endpoint": endpoint_key,
                            "url": f"https://{host}{path}",
                            "request_headers": dict(flow.request.headers),
                            "request_body": flow.request.get_text() if flow.request.content else None,
                            "response_status": status,
                            "response_headers": dict(flow.response.headers),
                            "response_body": data,
                            "captured_at": datetime.now().isoformat()
                        }, f, indent=2)
                    
                    ctx.log.info(f"[SAVED] {filename}")
                    
                    # Store truncated sample in endpoints
                    sample_str = json.dumps(data)
                    endpoints[endpoint_key]["response_sample"] = sample_str[:500] + "..." if len(sample_str) > 500 else sample_str
                    
                except Exception as e:
                    ctx.log.warn(f"[ERROR] Could not parse JSON: {e}")
        
        # Save endpoints index
        self.save_endpoints()
        
        ctx.log.info(f"[FOMO RESPONSE] {status} {method} {host}{path[:50]}")


addons = [FomoCapture()]
