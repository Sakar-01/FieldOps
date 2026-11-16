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

# Initiate the replica set with the project's own MongoDB driver, so mongosh isn't needed.
# The JavaScript uses single quotes only: PowerShell 5.1 strips double quotes from native arguments.
# Without this step the server stays "not primary" and refuses every write.
$initiate = @'
const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true', { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const admin = client.db().admin();
  try {
    await admin.command({ replSetGetStatus: 1 });
    console.log('Replica set already initiated');
  } catch {
    await admin.command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] } });
    console.log('Replica set rs0 initiated');
  }
  for (let i = 0; i < 30; i++) {
    if ((await admin.command({ hello: 1 })).isWritablePrimary) { console.log('MongoDB is primary and ready'); break; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  await client.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
'@
Push-Location (Split-Path $PSScriptRoot -Parent)
try { node -e $initiate; if ($LASTEXITCODE -ne 0) { throw "Replica set initiation failed" } }
finally { Pop-Location }
