$src = 'C:\Users\Cominn\.gemini\antigravity\scratch\teerresult2'

$desktopDir = 'C:\Users\Cominn\Desktop\teerresult2-files-to-upload'
$desktopZip = 'C:\Users\Cominn\Desktop\teerresult2-cloudflare-ready.zip'

$downloadsDir = 'C:\Users\Cominn\Downloads\teerresult2-files-to-upload'
$downloadsZip = 'C:\Users\Cominn\Downloads\teerresult2-cloudflare-ready.zip'

Write-Host "Updating $desktopDir..."
if (Test-Path $desktopDir) { Remove-Item $desktopDir -Recurse -Force }
New-Item -ItemType Directory -Path $desktopDir | Out-Null

$exclude = @(
    'node_modules',
    '.next',
    '.open-next',
    '.git',
    '.env',
    'dev.db',
    'dev.db-journal',
    'test.db',
    'test.db-journal',
    'test-e2e-pipeline.db',
    'test-e2e-pipeline.db-journal'
)

Get-ChildItem -Path $src | ForEach-Object {
    if ($_.Name -notin $exclude -and !$_.Name.EndsWith('.log') -and !$_.Name.EndsWith('.db')) {
        Copy-Item -Path $_.FullName -Destination $desktopDir -Recurse -Force
    }
}

Write-Host "Creating $desktopZip..."
if (Test-Path $desktopZip) { Remove-Item $desktopZip -Force }
Compress-Archive -Path (Join-Path $desktopDir '*') -DestinationPath $desktopZip -Force

Write-Host "Copying to Downloads ($downloadsDir & $downloadsZip)..."
if (Test-Path $downloadsDir) { Remove-Item $downloadsDir -Recurse -Force }
Copy-Item -Path $desktopDir -Destination $downloadsDir -Recurse -Force

if (Test-Path $downloadsZip) { Remove-Item $downloadsZip -Force }
Copy-Item -Path $desktopZip -Destination $downloadsZip -Force

Write-Host "Export completed successfully to BOTH Desktop and Downloads!"
Get-Item $desktopDir, $desktopZip, $downloadsDir, $downloadsZip | Select-Object Name, Length, LastWriteTime, FullName
