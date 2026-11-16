# One-time setup: turns the local MongoDB Windows service into a single-node replica set (rs0),
# because FieldOps books jobs inside transactions and standalone MongoDB doesn't support them.
# Run from an elevated PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\setup-local-mongo.ps1
# Safe to run again.

$ErrorActionPreference = "Stop"

$service = Get-CimInstance Win32_Service -Filter "Name='MongoDB'"
if (-not $service) { throw "MongoDB Windows service not found. Install MongoDB Community Server first." }

$config = $service.PathName -replace '.*--config\s+"?([^"]+)"?.*', '$1'
if (-not (Test-Path $config)) { throw "Config file not found: $config" }

$text = Get-Content $config -Raw
if ($text -match '(?m)^replication:') {
  Write-Host "Replication already configured in $config"
} else {
  Copy-Item $config "$config.bak" -Force
  $text = $text -replace '(?m)^#replication:\s*$', "replication:`r`n  replSetName: rs0"
  if ($text -notmatch '(?m)^replication:') { $text += "`r`nreplication:`r`n  replSetName: rs0`r`n" }
  Set-Content -Path $config -Value $text -Encoding ascii
  Write-Host "Added replSetName rs0 to $config (backup at $config.bak)"
}

Set-Service -Name MongoDB -StartupType Automatic
Restart-Service -Name MongoDB -Force
Write-Host "MongoDB service restarted"

$mongosh = (Get-Command mongosh -ErrorAction SilentlyContinue).Source
if (-not $mongosh) { throw "mongosh not found on PATH; run rs.initiate() yourself." }

$init = @'
try { rs.status().ok && print("Replica set already initiated") }
catch (e) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] }); print("Replica set rs0 initiated") }
'@
for ($i = 0; $i -lt 10; $i++) {
  & $mongosh --quiet "mongodb://127.0.0.1:27017/?directConnection=true" --eval $init
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 1
}
