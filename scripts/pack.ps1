# Builds dist/search-quest-<version>.zip with only the files Chrome needs.
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$version = (Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json).version
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist 'stage'
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($item in 'manifest.json', 'background.js', 'app', 'content', 'lib', 'icons', 'LICENSE') {
  Copy-Item -Recurse (Join-Path $root $item) $stage
}
$zip = Join-Path $dist "search-quest-$version.zip"
Remove-Item -Force $zip -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item -Recurse -Force $stage
Write-Output "wrote $zip"
