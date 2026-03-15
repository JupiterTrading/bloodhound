# Fomo App API Proxy Capture

Intercept and analyze API calls from the Fomo crypto trading app.

## Your PC Info
- **Proxy IP:** `192.168.1.202`
- **Proxy Port:** `8080`

---

## Step 1: Start the Proxy (on this PC)

Open a terminal and run:

```powershell
cd c:\Users\guestarino\CascadeProjects\bloodhound\scripts\fomo-proxy
mitmweb -s capture_fomo.py --listen-port 8080
```

This will:
- Start the proxy on port 8080
- Open a web UI at http://localhost:8081 to view traffic
- Save captured API calls to `./captured_data/`

---

## Step 2: Configure Your Phone

### iPhone:
1. **Settings → Wi-Fi → tap (i) on your network**
2. Scroll to **HTTP Proxy → Configure Proxy → Manual**
3. Enter:
   - Server: `192.168.1.202`
   - Port: `8080`
4. Save

### Android:
1. **Settings → Wi-Fi → long-press your network → Modify → Advanced**
2. Set Proxy to **Manual**
3. Enter:
   - Proxy hostname: `192.168.1.202`
   - Proxy port: `8080`
4. Save

---

## Step 3: Install SSL Certificate (REQUIRED for HTTPS)

On your phone's browser, go to:

```
http://mitm.it
```

This page will detect your device and show the correct certificate to download.

### iPhone:
1. Download the iOS certificate
2. Go to **Settings → General → VPN & Device Management**
3. Install the mitmproxy certificate
4. Go to **Settings → General → About → Certificate Trust Settings**
5. **Enable full trust** for mitmproxy

### Android:
1. Download the Android certificate
2. Go to **Settings → Security → Install from storage**
3. Select the downloaded certificate
4. Name it "mitmproxy" and trust it for apps

---

## Step 4: Capture Traffic

1. Open the **Fomo app** on your phone
2. Browse around:
   - View the leaderboard
   - Check profiles
   - Look at trades
   - View your portfolio
3. Watch the terminal/web UI for captured requests

---

## Step 5: Analyze Captured Data

Stop the proxy (Ctrl+C) and run:

```powershell
python analyze_endpoints.py
```

This will:
- List all discovered API endpoints
- Categorize them (leaderboard, trades, users, etc.)
- Generate a scraper template

---

## Output Files

| File | Description |
|------|-------------|
| `captured_data/endpoints.json` | Index of all discovered endpoints |
| `captured_data/*.json` | Individual API response samples |
| `fomo_scraper_template.py` | Auto-generated scraper code |

---

## Troubleshooting

### "Connection not secure" / App won't load
- Make sure you installed AND trusted the certificate (Step 3)
- On iPhone, you MUST enable trust in Certificate Trust Settings

### No traffic appearing
- Verify phone and PC are on same Wi-Fi network
- Check Windows Firewall isn't blocking port 8080
- Try: `netsh advfirewall firewall add rule name="mitmproxy" dir=in action=allow protocol=TCP localport=8080`

### App uses certificate pinning
- Some apps reject proxied connections. Fomo likely doesn't since it uses Privy's standard infrastructure.

---

## After Capture

Once you have the endpoints, we can:
1. Build a scraper to pull leaderboard data
2. Map usernames to wallet addresses  
3. Integrate into Bloodhound's ranking system
