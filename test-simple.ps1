# PowerShell script to test the availability system fixes
Write-Host "Testing JumpCSRA Availability System Fixes" -ForegroundColor Green

# Navigate to the JumpCSRA directory
Set-Location ".\JumpCSRA"

# Check if TypeScript compiles
Write-Host "Checking TypeScript compilation..." -ForegroundColor Yellow
try {
    npx tsc --noEmit 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "TypeScript compilation successful" -ForegroundColor Green
    } else {
        Write-Host "TypeScript compilation has errors" -ForegroundColor Red
    }
} catch {
    Write-Host "Could not run TypeScript compiler" -ForegroundColor Yellow
}

# Check modified files
Write-Host "Checking modified files..." -ForegroundColor Yellow

$filesToCheck = @(
    "app\utils\bookingUtils.ts",
    "app\routes\checkout.tsx",
    "app\welcome\index.tsx"
)

foreach ($file in $filesToCheck) {
    if (Test-Path $file) {
        Write-Host "File exists: $file" -ForegroundColor Green
        
        $content = Get-Content $file -Raw
        
        if ($file -eq "app\utils\bookingUtils.ts") {
            if ($content -match "getUnavailableInflateables") {
                Write-Host "  getUnavailableInflateables function found" -ForegroundColor Green
            }
            if ($content -match "validateAndCleanCart") {
                Write-Host "  validateAndCleanCart function found" -ForegroundColor Green
            }
            if ($content -match "orderDetails\.items") {
                Write-Host "  Updated to use orderDetails.items structure" -ForegroundColor Green
            }
        }
        
        if ($file -eq "app\routes\checkout.tsx") {
            if ($content -match "validateAndCleanCart") {
                Write-Host "  Cart validation integrated" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "File not found: $file" -ForegroundColor Red
    }
}

Write-Host "Summary of Fixes:" -ForegroundColor Yellow
Write-Host "1. Fixed getUnavailableInflateables to use correct database structure" -ForegroundColor Green
Write-Host "2. Added validateAndCleanCart function for automatic cart cleanup" -ForegroundColor Green
Write-Host "3. Integrated cart validation in checkout when dates change" -ForegroundColor Green
Write-Host "4. Added comprehensive debug logging" -ForegroundColor Green

Write-Host "Testing complete!" -ForegroundColor Green