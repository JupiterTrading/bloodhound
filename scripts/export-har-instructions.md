# How to Export HAR File from Edge DevTools

## Method 1: Console Export (EASIEST)

1. **Open DevTools** (F12)
2. Go to **Network tab**
3. **Clear** the network log (trash icon)
4. **Navigate to Vision page**: https://axiom.trade/vision?chain=sol
5. **Wait for page to load completely**
6. **Scroll down** to see the KOL leaderboard
7. In the **Filter box**, type: `api`
8. Look for URLs containing:
   - `/kol`
   - `/trader`
   - `/leaderboard`
   - `/wallet`
9. **Right-click on ONE of those API calls** > Copy > Copy as HAR
10. **Paste into a new text file** and save as `axiom-kol-api.har`

## Method 2: Find the Specific API Call

In the Network tab, look for these patterns:
- `https://api.axiom.trade/vision/kols`
- `https://api.axiom.trade/leaderboard`
- `https://api7.axiom.trade/kols`
- Any URL with "kol" or "trader" in it

**Click on that request** and look at the **Response** tab to see if it contains wallet data.

## What You're Looking For

The response should look like:
```json
{
  "kols": [
    {
      "address": "ABC123...",
      "twitter": "@username",
      "pnl": 1234.56,
      "winRate": 0.75
    }
  ]
}
```

## If You Can't Find It

The KOL data might be loaded dynamically. Try:
1. Click on different tabs in the Vision page
2. Scroll through the leaderboard
3. Click on a KOL profile
4. Watch the Network tab for new API calls

Each interaction should trigger new API requests!
