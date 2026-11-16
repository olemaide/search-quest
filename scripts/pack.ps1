# Zips the built extension (dist/) into release/search-quest-<version>.zip. Run `npm run zip`.
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$dist = Join-Path $root 'dist'
if (-not (Test-Path (Join-Path $dist 'manifest.json'))) { throw 'dist/ is missing. Run npm run build first.' }
$version = (Get-Content (Join-Path $dist 'manifest.json') -Raw | ConvertFrom-Json).version
$out = Join-Path $root 'release'
New-Item -ItemType Directory -Force $out | Out-Null
$zip = Join-Path $out "search-quest-$version.zip"
Remove-Item -Force $zip -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $dist '*') -DestinationPath $zip
Write-Output "wrote $zip"
