# PowerShell Script to Fix Payment Calculation
# This script fixes the calculateMonthlyPayments function in utils.js

$filePath = "js\utils.js"
$backupPath = "js\utils.js.backup"

Write-Host "Creating backup..." -ForegroundColor Yellow
Copy-Item $filePath $backupPath -Force
Write-Host "Backup created: $backupPath" -ForegroundColor Green

Write-Host "Reading file..." -ForegroundColor Yellow
$content = Get-Content $filePath -Raw

Write-Host "Applying fixes..." -ForegroundColor Yellow

# Fix 1: Change totalPaid to totalEarned/totalProjected
$content = $content -replace 'totalPaid \+= manualPayments;', @'
totalEarned += manualPayments;
        total Projected += manualPayments; // For manual, earned = projected (already happened)
'@

# Fix 2: Weekly calculation - check if week has ended
$oldWeekly = @'
                    // If this is a week start day
                    if (dayOfWeek === weekStartDay) {
                        // Check if this week started after employee's start date
                        if (currentDate >= startDate) {
                            cyclesCompleted++;
                        }
                    }
'@

$newWeekly = @'
                    if (dayOfWeek === weekStartDay && currentDate >= startDate) {
                        // This week started in the month AND after employee started
                        cyclesProjected++;
                        
                        // Week end is 6 days after start
                        const weekEnd = new Date(currentDate);
                        weekEnd.setDate(currentDate.getDate() + 6);
                        
                        // Only count as COMPLETED if week end has PASSED
                        if (weekEnd <= today) {
                            cyclesCompleted++;
                        }
                    }
'@

$content = $content -replace [regex]::Escape($oldWeekly), $newWeekly

# Fix 3: Biweekly calculation
$oldBiweekly = @'
                // Biweekly: 15th and end of month
                const mid = new Date(year, month, 15);
                
                // Count payments that occurred in this month
                if (mid >= startDate && mid >= monthStart && mid <= monthEnd) {
                    cyclesCompleted++;
                }
                if (monthEnd >= startDate) {
                    cyclesCompleted++;
                }
'@

$newBiweekly = @'
                // Biweekly: 15th and end of month
                const mid = new Date(year, month, 15);
                const end = new Date(year, month + 1, 0);
                
                // Check 15th payment
                if (mid >= startDate && mid >= monthStart && mid <= monthEnd) {
                    cyclesProjected++;
                    if (mid <= today) cyclesCompleted++;
                }
                
                // Check end of month payment
                if (end >= startDate) {
                    cyclesProjected++;
                    if (end <= today) cyclesCompleted++;
                }
'@

$content = $content -replace [regex]::Escape($oldBiweekly), $newBiweekly

# Fix 4: Calculate earned and projected
$content = $content -replace 'totalPaid \+= cyclesCompleted \* cycleAmount;', @'
const earned = cyclesCompleted * cycleAmount;
            const projected = cyclesProjected * cycleAmount;
            
            salaryEarned += earned;
            salaryProjected += projected;
            totalEarned += earned;
            totalProjected += projected;
'@

# Fix 5: Return statement
$oldReturn = @'
        return {
            totalPaid: Math.round(totalPaid),
            breakdown: {
                manual: Math.round(manualPayments),
                salary: Math.round(totalPaid - manualPayments)
            }
        };
'@

$newReturn = @'
        return {
            totalPaid: Math.round(totalEarned), // What's been EARNED up to today
            totalProjected: Math.round(totalProjected), // What will be paid by end of month
            breakdown: {
                manual: Math.round(manualPayments),
                salaryEarned: Math.round(salaryEarned),
                salaryProjected: Math.round(salaryProjected)
            },
            pending: Math.round(totalProjected - totalEarned) // What's still to be earned
        };
'@

$content = $content -replace [regex]::Escape($oldReturn), $newReturn

Write-Host "Saving fixed file..." -ForegroundColor Yellow
Set-Content $filePath -Value $content -NoNewline

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "       ✅ FIX APLICADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Siguiente paso:" -ForegroundColor Cyan
Write-Host "1. Ejecuta LIMPIAR_CACHE.bat" -ForegroundColor White
Write-Host "2. Cierra TODO el navegador" -ForegroundColor White
Write-Host "3. Abre la aplicación de nuevo" -ForegroundColor White
Write-Host ""
Write-Host "Si algo sale mal, el backup está en: $backupPath" -ForegroundColor Yellow
