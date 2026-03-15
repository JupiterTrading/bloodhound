# BLOODHOUND — KOL Data Setup Script
# Run this script to set up KOL data

Write-Host "🐕 BLOODHOUND KOL Setup" -ForegroundColor Red
Write-Host ""

# Step 1: Check environment variables
Write-Host "Step 1: Checking environment..." -ForegroundColor Yellow
if (-not $env:SUPABASE_URL) {
    Write-Host "  ⚠️  SUPABASE_URL not set. Please set it first." -ForegroundColor Yellow
}
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "  ⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Please set it first." -ForegroundColor Yellow
}

# Step 2: Run migrations
Write-Host ""
Write-Host "Step 2: To run migrations, execute in Supabase SQL Editor:" -ForegroundColor Yellow
Write-Host "  Copy contents of: packages/db/schema/003_kol_profiles.sql" -ForegroundColor Cyan
Write-Host ""

# Step 3: Import KOL data
Write-Host "Step 3: Importing KOL data..." -ForegroundColor Yellow
$scriptPath = Join-Path $PSScriptRoot "import-kol-wallets.mjs"
$dataPath = Join-Path $PSScriptRoot "kol-data\gmgn-kols-complete.json"

if (Test-Path $dataPath) {
    Write-Host "  Found KOL data at: $dataPath" -ForegroundColor Green
    Write-Host "  Run: node scripts/import-kol-wallets.mjs --file ./scripts/kol-data/gmgn-kols-complete.json" -ForegroundColor Cyan
} else {
    Write-Host "  ⚠️  KOL data file not found at: $dataPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done! Run the commands above to complete setup." -ForegroundColor Green
