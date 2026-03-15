"""
Analyze captured Fomo API endpoints and generate a summary report
Run this after capturing traffic to see what endpoints were discovered
"""

import json
import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CAPTURED_DIR = SCRIPT_DIR / "captured_data"
ENDPOINTS_FILE = CAPTURED_DIR / "endpoints.json"

def analyze():
    if not ENDPOINTS_FILE.exists():
        print("No endpoints.json found. Run the proxy capture first!")
        return
    
    with open(ENDPOINTS_FILE) as f:
        endpoints = json.load(f)
    
    print("=" * 70)
    print("FOMO API ENDPOINTS DISCOVERED")
    print("=" * 70)
    
    # Categorize endpoints
    auth_endpoints = []
    leaderboard_endpoints = []
    trade_endpoints = []
    user_endpoints = []
    other_endpoints = []
    
    for key, data in endpoints.items():
        path = data['path'].lower()
        
        if any(x in path for x in ['auth', 'login', 'token', 'privy']):
            auth_endpoints.append((key, data))
        elif any(x in path for x in ['leaderboard', 'rank', 'top', 'score']):
            leaderboard_endpoints.append((key, data))
        elif any(x in path for x in ['trade', 'swap', 'buy', 'sell', 'order', 'position']):
            trade_endpoints.append((key, data))
        elif any(x in path for x in ['user', 'profile', 'wallet', 'account', 'portfolio']):
            user_endpoints.append((key, data))
        else:
            other_endpoints.append((key, data))
    
    def print_category(name, items):
        if not items:
            return
        print(f"\n## {name} ({len(items)} endpoints)")
        print("-" * 50)
        for key, data in items:
            auth_marker = "🔐" if data.get('has_auth') else "  "
            print(f"{auth_marker} {key}")
            print(f"   Host: {data['host']}")
            print(f"   Calls: {data['sample_count']}")
            if data.get('response_sample'):
                sample = data['response_sample'][:100]
                print(f"   Sample: {sample}...")
            print()
    
    print_category("🎯 LEADERBOARD/RANKING", leaderboard_endpoints)
    print_category("💰 TRADING", trade_endpoints)
    print_category("👤 USER/WALLET", user_endpoints)
    print_category("🔑 AUTH", auth_endpoints)
    print_category("📦 OTHER", other_endpoints)
    
    # Summary
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total endpoints discovered: {len(endpoints)}")
    print(f"Endpoints requiring auth: {sum(1 for e in endpoints.values() if e.get('has_auth'))}")
    print(f"\nCaptured JSON files in: {CAPTURED_DIR}")
    
    # List captured files
    json_files = list(CAPTURED_DIR.glob("*.json"))
    if json_files:
        print(f"\nCaptured responses ({len(json_files)} files):")
        for f in sorted(json_files)[:20]:
            if f.name != "endpoints.json":
                print(f"  - {f.name}")
        if len(json_files) > 20:
            print(f"  ... and {len(json_files) - 20} more")
    
    # Generate scraper template
    generate_scraper_template(endpoints)


def generate_scraper_template(endpoints):
    """Generate a template scraper based on discovered endpoints"""
    
    # Find the most interesting endpoints
    interesting = []
    for key, data in endpoints.items():
        path = data['path'].lower()
        if any(x in path for x in ['leaderboard', 'rank', 'top', 'user', 'wallet', 'trade', 'position', 'portfolio']):
            interesting.append(data)
    
    if not interesting:
        return
    
    template_file = SCRIPT_DIR / "fomo_scraper_template.py"
    
    template = '''"""
Auto-generated Fomo API scraper template
Based on captured endpoints from proxy analysis
"""

import httpx
import json
from datetime import datetime

# Base configuration - UPDATE THESE after capture
BASE_URL = "https://api.fomo.family"  # Update with actual API host
AUTH_TOKEN = "YOUR_AUTH_TOKEN_HERE"   # Get from captured headers

HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "User-Agent": "fomo/1.0 iOS",
    "Content-Type": "application/json",
}

async def fetch_endpoint(client: httpx.AsyncClient, path: str):
    """Generic endpoint fetcher"""
    try:
        resp = await client.get(f"{BASE_URL}{path}", headers=HEADERS)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Error fetching {path}: {e}")
        return None


# DISCOVERED ENDPOINTS - uncomment and use as needed
'''
    
    for data in interesting[:10]:
        template += f'''
# Endpoint: {data['method']} {data['path']}
# Host: {data['host']}
# async def fetch_{data['path'].replace('/', '_').strip('_')}(client):
#     return await fetch_endpoint(client, "{data['path']}")
'''
    
    template += '''

async def main():
    async with httpx.AsyncClient() as client:
        # Example: fetch leaderboard
        # data = await fetch_leaderboard(client)
        # print(json.dumps(data, indent=2))
        pass

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
'''
    
    with open(template_file, 'w') as f:
        f.write(template)
    
    print(f"\n✅ Generated scraper template: {template_file}")


if __name__ == "__main__":
    analyze()
