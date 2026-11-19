$src = 'C:\Users\Cominn\.gemini\antigravity\scratch\teerresult2'
$destDir = 'C:\Users\Cominn\Desktop\teerresult2-files-to-upload'
$destZip = 'C:\Users\Cominn\Desktop\teerresult2-cloudflare-ready.zip'

Write-Host "Updating $destDir..."
if (Test-Path $destDir) { Remove-Item $destDir -Recurse -Force }
New-Item -ItemType Directory -Path $destDir | Out-Null

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
        Copy-Item -Path $_.FullName -Destination $destDir -Recurse -Force
    }
}

Write-Host "Creating $destZip..."
if (Test-Path $destZip) { Remove-Item $destZip -Force }
Compress-Archive -Path (Join-Path $destDir '*') -DestinationPath $destZip -Force

Write-Host "Export completed successfully!"
Get-Item $destDir | Select-Object Name, LastWriteTime
Get-Item $destZip | Select-Object Name, Length, LastWriteTime
