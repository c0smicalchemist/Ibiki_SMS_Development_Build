# Script to add PostgreSQL database to existing Railway project
# This script provides instructions for manually adding the database

Write-Host "=== Railway PostgreSQL Database Setup ===" -ForegroundColor Green
Write-Host ""
Write-Host "Your Railway project 'gleaming-mindfulness' needs a PostgreSQL database." -ForegroundColor Yellow
Write-Host "Please follow these steps:"
Write-Host ""
Write-Host "1. Visit: https://railway.app/project/gleaming-mindfulness" -ForegroundColor Cyan
Write-Host "2. Click 'Add Service' or the '+' button" -ForegroundColor Cyan
Write-Host "3. Select 'Database' from the options" -ForegroundColor Cyan
Write-Host "4. Choose 'PostgreSQL'" -ForegroundColor Cyan
Write-Host "5. Railway will automatically:"
Write-Host "   - Create the database service" -ForegroundColor White
Write-Host "   - Set the DATABASE_URL environment variable" -ForegroundColor White
Write-Host "   - Configure the connection" -ForegroundColor White
Write-Host ""
Write-Host "6. Wait 2-3 minutes for the database to be ready" -ForegroundColor Yellow
Write-Host "7. The application should automatically restart and connect" -ForegroundColor Green
Write-Host ""
Write-Host "Alternative: Use the one-click deploy button in README.md" -ForegroundColor Blue
Write-Host ""
Write-Host "Press any key when you've added the database..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")