$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
 $runtimeBin = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
 if (Test-Path (Join-Path $runtimeBin 'node.exe')) {
  $env:PATH = "$runtimeBin;$env:PATH"
  $packageBin = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback'
  if (Test-Path $packageBin) { $env:PATH = "$packageBin;$env:PATH" }
 } else { throw 'Install Node.js 22 or newer first, then restart VS Code.' }
}
$nodeMajor = [int]((node -p 'process.versions.node').Split('.')[0])
if ($nodeMajor -lt 22) { throw 'Node.js 22 or newer is required. Update Node.js and restart VS Code.' }
$localConnection = New-Object System.Net.Sockets.TcpClient
try {
 $pendingConnection = $localConnection.BeginConnect('127.0.0.1', 3000, $null, $null)
 if ($pendingConnection.AsyncWaitHandle.WaitOne(500)) {
  try { $localConnection.EndConnect($pendingConnection) } catch {}
 }
 if ($localConnection.Connected) {
  Write-Host 'Port 3000 is already in use. Your running PantryChef app is at http://127.0.0.1:3000/'
  return
 }
} finally { $localConnection.Dispose() }
if (-not (Test-Path '.\node_modules\next')) {
 if (Get-Command npm -ErrorAction SilentlyContinue) { npm.cmd install }
 elseif (Get-Command pnpm -ErrorAction SilentlyContinue) { pnpm install }
 else { throw 'Install Node.js from nodejs.org; it includes npm.' }
 if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
if (-not (Test-Path '.\.generated\lsa.json') -or -not (Select-String -LiteralPath '.env.local' -Pattern '^RUNTIME_DATABASE_URL=' -Quiet -ErrorAction SilentlyContinue)) {
 node scripts/setup.mjs
 if ($LASTEXITCODE -ne 0) { throw 'Database setup failed. See README.md.' }
}
node scripts/serve.mjs dev
