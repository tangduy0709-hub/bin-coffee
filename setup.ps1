param(
  [string]$ApiKey = "",
  [string]$Provider = "openai"
)

$Cyan = "Cyan"; $Green = "Green"; $Yellow = "Yellow"; $Red = "Red"; $Gray = "Gray"

# --- Provider Validation ---
if ($Provider -notin @("openai","dashscope","gemini")) {
  Write-Host "FAIL Invalid provider specified: '$Provider'. Must be 'openai', 'dashscope', or 'gemini'." -ForegroundColor $Red
  exit 1
}

Write-Host "================================" -ForegroundColor $Cyan
Write-Host "  Brew & Bean + QwenPaw Setup" -ForegroundColor $Cyan
Write-Host "================================" -ForegroundColor $Cyan
Write-Host ""

# ----- 1. Install QwenPaw using official script -----
Write-Host "[1/5] Installing QwenPaw via official script..." -ForegroundColor $Yellow

$qwenpawBinPath = "$env:USERPROFILE\.qwenpaw\bin"

# Check if qwenpaw command is already available or if the binary path exists
$qwenpawExists = $false
try {
  # Check if qwenpaw command is callable in the current session
  $null = (Get-Command qwenpaw -ErrorAction SilentlyContinue)
  if ($null) { $qwenpawExists = $true }
} catch {}

# Also check if the executable exists directly (if not yet in PATH)
if (-not $qwenpawExists -and (Test-Path "$qwenpawBinPath\qwenpaw.ps1")) {
  Write-Host "  QwenPaw executable found, adding to current PATH..." -ForegroundColor $Yellow
  $env:Path = "$env:Path;$qwenpawBinPath"
  Write-Host "  OK Added '$qwenpawBinPath' to current session PATH." -ForegroundColor $Green
  $qwenpawExists = $true # Now it should be available
}

if (-not $qwenpawExists) {
  Write-Host "  Downloading and executing QwenPaw install script..." -ForegroundColor $Yellow
  try {
    irm https://qwenpaw.agentscope.io/install.ps1 | iex 2>&1 | Out-Null
    # After running installer, ensure PATH is updated for current session
    if (Test-Path "$qwenpawBinPath\qwenpaw.ps1") {
      if (-not ($env:Path -like "*$qwenpawBinPath*")) {
        Write-Host "  Adding '$qwenpawBinPath' to current session PATH after install..." -ForegroundColor $Yellow
        $env:Path = "$env:Path;$qwenpawBinPath"
      }
      Write-Host "  OK QwenPaw installed and PATH updated." -ForegroundColor $Green
      $qwenpawExists = $true
    }
  } catch {
    Write-Host "  FAIL QwenPaw install script failed: $_" -ForegroundColor $Red
    exit 1
  }
}

if ($qwenpawExists) {
  Write-Host "  OK QwenPaw command available." -ForegroundColor $Green
} else {
  Write-Host "  FAIL QwenPaw command not available after install attempt." -ForegroundColor $Red
  Write-Host "    Please ensure PowerShell has permission to run scripts (Set-ExecutionPolicy -ExecutionPolicy Bypass)." -ForegroundColor $Gray
  Write-Host "    Or manually run: irm https://qwenpaw.agentscope.io/install.ps1 | iex, then restart terminal." -ForegroundColor $Gray
  exit 1
}

# ----- 2. Init QwenPaw -----
Write-Host "[2/5] Initializing QwenPaw..." -ForegroundColor $Yellow
$qDir = "$env:USERPROFILE\.qwenpaw"
if (-not (Test-Path $qDir\config.json)) { # Check for config.json to confirm init
  qwenpaw init --defaults 2>&1 | Out-Null
  Write-Host "  OK Initialized" -ForegroundColor $Green
} else {
  Write-Host "  OK Already initialized" -ForegroundColor $Green
}

# Set API key env for current session and future qwenpaw commands
if ($ApiKey) {
  $keyName = switch ($Provider) {
    "openai" { "OPENAI_API_KEY" }
    "dashscope" { "DASHSCOPE_API_KEY" }
    "gemini" { "GOOGLE_API_KEY" }
    Default { "" }
  }
  if ($keyName) {
    [Environment]::SetEnvironmentVariable($keyName, $ApiKey, "Process")
    Write-Host "  OK $keyName set for this session." -ForegroundColor $Green
  } else {
    Write-Host "  WARN Unknown provider '$Provider'. API key not set automatically." -ForegroundColor $Yellow
  }
} else {
  Write-Host "  WARN No API key provided." -ForegroundColor $Yellow
}

# ----- 3. Configure .env for Next.js -----
Write-Host "[3/5] Configuring .env for Next.js..." -ForegroundColor $Yellow
# Ensure .env exists, creating it if neither .env nor .env.example exist
if (-not (Test-Path ".env")) {
  if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env"
    Write-Host "  OK Created .env from .env.example" -ForegroundColor $Green
  } else {
    New-Item ".env" -ItemType File | Out-Null # Create an empty .env if example is missing
    Write-Host "  WARN .env.example not found. Created empty .env." -ForegroundColor $Yellow
  }
}
if ($ApiKey) {
  $c = Get-Content ".env" -Raw
  $keyName = switch ($Provider) {
    "openai" { "OPENAI_API_KEY" }
    "dashscope" { "DASHSCOPE_API_KEY" }
    "gemini" { "GOOGLE_API_KEY" }
    Default { "" }
  }
  if ($keyName) {
    # Use -replace with literal string for $keyName to avoid regex issues with characters like '.'
    # Ensure the line exists or add it if it doesn't
    $pattern = "^${keyName}=.*$"
    if ($c -match $pattern) {
        $c = $c -replace $pattern, "${keyName}=$ApiKey"
    } else {
        $c = "$c`n${keyName}=$ApiKey"
    }
    Set-Content ".env" $c
    Write-Host "  OK .env updated with API key." -ForegroundColor $Green
  } else {
    Write-Host "  WARN Unknown provider '$Provider'. .env not updated with API key." -ForegroundColor $Yellow
  }
} else {
  Write-Host "  WARN .env not updated with API key. Edit manually if needed." -ForegroundColor $Yellow
}
Write-Host "  OK .env ready." -ForegroundColor $Green

# ----- 4. Start QwenPaw App (in background) -----
Write-Host "[4/5] Starting QwenPaw App in background..." -ForegroundColor $Yellow

# Kill any existing qwenpaw processes
try { Get-Process -Name "qwenpaw" -ErrorAction Stop | Stop-Process -Force } catch {}

# Start QwenPaw app in a new job, passing API key as env var
Start-Job -ScriptBlock {
  param($k, $p)
  if ($k) {
    $keyName = switch ($p) {
      "openai" { "OPENAI_API_KEY" }
      "dashscope" { "DASHSCOPE_API_KEY" }
      "gemini" { "GOOGLE_API_KEY" }
      Default { "" }
    }
    if ($keyName) {
      [Environment]::SetEnvironmentVariable($keyName, $k, "Process") # Set env var for the job process
    }
  }
  qwenpaw app # This command should be available after install.ps1
} -ArgumentList $ApiKey, $Provider | Out-Null

# Wait for QwenPaw to be ready
Write-Host "  Waiting for QwenPaw app to be ready..." -ForegroundColor $Yellow
$ready = $false
for ($i = 0; $i -lt 60; $i++) { # Increased timeout for initial startup
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:8088" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop # Changed to root endpoint
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}

if (-not $ready) {
  Write-Host "  FAIL QwenPaw app not started. Check: Get-Job | Receive-Job" -ForegroundColor $Red
  exit 1
}
Write-Host "  OK QwenPaw app running on http://localhost:8088." -ForegroundColor $Green

# ----- 5. Configure agent via API -----
Write-Host "[5/5] Configuring Brew & Bean agent via API..." -ForegroundColor $Yellow

$sysPrompt = @"
You are a friendly and knowledgeable barista assistant at Brew & Bean, a cozy artisan coffee shop.

## Menu
- Signature Espresso ($4.50) - Rich double-shot, dark chocolate notes
- Caramel Latte ($5.75) - Creamy with house-made caramel
- Oat Milk Cappuccino ($5.25) - Velvety oat milk foam
- Cold Brew ($4.75) - 24-hour steeped, smooth
- Matcha Latte ($5.50) - Ceremonial grade matcha
- Chai Latte ($5.00) - Spiced with cinnamon, cardamom
- Almond Croissant ($4.25) - Buttery almond cream
- Cinnamon Roll ($4.50) - Warm cream cheese frosting
- Mocha ($5.50) - Espresso with rich chocolate
- Affogato ($6.00) - Espresso over vanilla gelato

## Customization
Size: Small, Medium, Large | Milk: Whole, Oat, Almond, Soy | Extras: Extra shot (+$0.75), syrups

## Guidelines
- Warm, concise replies (2-3 sentences)
- Suggest pairings (espresso -> croissant, latte -> cinnamon roll)
- Redirect politely if item is not on menu
"@

$body = @{
  system_prompt = $sysPrompt
} | ConvertTo-Json

try {
  Invoke-RestMethod -Uri "http://localhost:8088/api/agent/default" -Method Patch -Body $body -ContentType "application/json" -ErrorAction Stop | Out-Null
  Write-Host "  OK Agent 'default' configured with coffee shop prompt." -ForegroundColor $Green
} catch {
  Write-Host "  WARN Agent configuration failed: $_" -ForegroundColor $Yellow
  Write-Host "    You may need to configure the default agent's system prompt manually via http://localhost:8088/settings/agents." -ForegroundColor $Gray
}

# ----- Final Steps -----
Write-Host ""
Write-Host "================================" -ForegroundColor $Cyan
Write-Host "  Setup complete!" -ForegroundColor $Green
Write-Host "================================" -ForegroundColor $Cyan
Write-Host ""
Write-Host "  QwenPaw Console : http://localhost:8088" -ForegroundColor $Cyan
Write-Host "  Coffee Shop App : http://localhost:3000" -ForegroundColor $Cyan
Write-Host ""
Write-Host "  NEXT: Ensure your LLM API key is configured in the QwenPaw Console:" -ForegroundColor $Yellow
Write-Host "    Open http://localhost:8088/settings/models" -ForegroundColor $Gray
Write-Host "    Add your API key (e.g., GOOGLE_API_KEY for Gemini) and enable a provider + model." -ForegroundColor $Gray
Write-Host ""
Write-Host "  Starting Next.js app..." -ForegroundColor $Cyan

npm run dev
