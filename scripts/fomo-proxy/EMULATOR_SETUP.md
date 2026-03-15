# Android Emulator Setup for DexScreener/Axiom Proxy Capture

## Manual WiFi Proxy Configuration in LDPlayer

Since LDPlayer doesn't have UI proxy settings, configure it in Android:

### Step 1: Open WiFi Settings in Emulator
1. In LDPlayer, open **Settings app**
2. Go to **Network & Internet** → **Wi-Fi**
3. Long-press on the connected WiFi network
4. Select **Modify network**

### Step 2: Configure Proxy
1. Expand **Advanced options**
2. Set **Proxy** to **Manual**
3. Enter:
   - **Proxy hostname:** `10.0.2.2` (this is the host machine from emulator's perspective)
   - **Proxy port:** `8080`
4. Save

### Step 3: Install mitmproxy Certificate

#### 3a. Download cert in emulator browser
1. In LDPlayer, open Chrome browser
2. Navigate to: `http://mitm.it`
3. Download the **Android certificate**
4. Save as `mitmproxy-ca-cert.cer`

#### 3b. Install certificate
1. Open **Settings** → **Security** → **Encryption & credentials**
2. Select **Install a certificate** → **CA certificate**
3. Select the downloaded `mitmproxy-ca-cert.cer`
4. Name it "mitmproxy"

### Step 4: Install as System Certificate (Root Required)

If apps still fail due to cert pinning, install as system cert:

1. Enable root in LDPlayer settings
2. Use ADB to push cert to system:

```bash
# Find LDPlayer's ADB (usually in installation folder)
cd "C:\Program Files\LDPlayer9" # or wherever installed

# Connect to emulator
.\adb.exe connect 127.0.0.1:5555

# Get cert hash
.\adb.exe shell "openssl x509 -inform PEM -subject_hash_old -in /sdcard/Download/mitmproxy-ca-cert.cer | head -1"

# Push to system (replace HASH with output from above)
.\adb.exe root
.\adb.exe remount
.\adb.exe push C:\Users\guestarino\.mitmproxy\mitmproxy-ca-cert.pem /system/etc/security/cacerts/HASH.0
.\adb.exe shell chmod 644 /system/etc/security/cacerts/HASH.0
.\adb.exe reboot
```

### Step 5: Install Apps
1. Download DexScreener APK from APKPure
2. Drag APK into LDPlayer window to install
3. Same for Axiom if available

### Step 6: Test
1. Make sure mitmproxy is running on host: `mitmweb -s capture_fomo.py --listen-port 8080`
2. Open DexScreener in emulator
3. Check mitmweb UI for captured traffic

---

## Alternative: Use Your Phone's Browser Instead

**Easier option:** Just use Safari/Chrome on your phone to visit:
- `dexscreener.com` 
- `axiom.trade`

Browsers don't use cert pinning. The proxy will capture all API calls.
