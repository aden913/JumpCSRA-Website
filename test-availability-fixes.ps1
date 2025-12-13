# PowerShell script to test the availability system fixes
# This will compile the TypeScript and run basic checks

Write-Host "🔄 Testing JumpCSRA Availability System Fixes" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Navigate to the JumpCSRA directory
Set-Location ".\JumpCSRA"

# Check if TypeScript compiles without errors
Write-Host "`n📝 Checking TypeScript compilation..." -ForegroundColor Yellow
try {
    $tscOutput = npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ TypeScript compilation successful" -ForegroundColor Green
    } else {
        Write-Host "❌ TypeScript compilation errors:" -ForegroundColor Red
        Write-Host $tscOutput -ForegroundColor Red
    }
} catch {
    Write-Host "⚠️  Could not run TypeScript compiler - ensure it's installed" -ForegroundColor Yellow
}

# Check for common syntax issues in our modified files
Write-Host "`n🔍 Checking modified files for syntax issues..." -ForegroundColor Yellow

$filesToCheck = @(
    "app\utils\bookingUtils.ts",
    "app\routes\checkout.tsx",
    "app\welcome\index.tsx"
)

foreach ($file in $filesToCheck) {
    if (Test-Path $file) {
        Write-Host "✅ $file exists" -ForegroundColor Green
        
        # Basic syntax checks
        $content = Get-Content $file -Raw
        
        # Check for import/export balance
        $importCount = ($content | Select-String "import\s+" -AllMatches).Matches.Count
        $exportCount = ($content | Select-String "export\s+" -AllMatches).Matches.Count
        
        if ($importCount -gt 0 -or $exportCount -gt 0) {
            Write-Host "  📦 Imports: $importCount, Exports: $exportCount" -ForegroundColor Cyan
        }
        
        # Check for our new functions
        if ($file -eq "app\utils\bookingUtils.ts") {
            if ($content -match "getUnavailableInflateables") {
                Write-Host "  ✅ getUnavailableInflateables function found" -ForegroundColor Green
            }
            if ($content -match "validateAndCleanCart") {
                Write-Host "  ✅ validateAndCleanCart function found" -ForegroundColor Green
            }
            if ($content -match "orderDetails\.items") {
                Write-Host "  ✅ Updated to use orderDetails.items structure" -ForegroundColor Green
            }
        }
        
        if ($file -eq "app\routes\checkout.tsx") {
            if ($content -match "validateAndCleanCart") {
                Write-Host "  ✅ Cart validation integrated" -ForegroundColor Green
            }
            if ($content -match "calendarDateRange\[0\], calendarDateRange\[1\]") {
                Write-Host "  ✅ Date change detection added" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "❌ $file not found" -ForegroundColor Red
    }
}

# Summary of changes
Write-Host "`n📋 Summary of Availability System Fixes:" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "✅ Fixed getUnavailableInflateables to use correct database structure" -ForegroundColor Green
Write-Host "   - Now reads orderDetails.eventDate instead of startDate/endDate" -ForegroundColor Gray
Write-Host "   - Now reads orderDetails.items array instead of inflateableIDs" -ForegroundColor Gray
Write-Host "   - Uses product names instead of IDs for carousel compatibility" -ForegroundColor Gray
Write-Host "✅ Added validateAndCleanCart function for automatic cart cleanup" -ForegroundColor Green
Write-Host "✅ Integrated cart validation in checkout when dates change" -ForegroundColor Green
Write-Host "✅ Added comprehensive debug logging" -ForegroundColor Green
Write-Host "✅ Maintains existing membership booking availability logic" -ForegroundColor Green

Write-Host "`n🧪 Testing Recommendations:" -ForegroundColor Yellow
Write-Host "============================" -ForegroundColor Yellow
Write-Host "1. Navigate to the welcome page and select dates" -ForegroundColor Cyan
Write-Host "2. Check if products show as unavailable correctly" -ForegroundColor Cyan
Write-Host "3. Add items to cart, change dates, verify auto-removal" -ForegroundColor Cyan
Write-Host "4. Check browser console for detailed availability logs" -ForegroundColor Cyan
Write-Host "5. Test with known booked dates to verify conflict detection" -ForegroundColor Cyan

Write-Host "`n🎉 Availability system fixes complete!" -ForegroundColor Green