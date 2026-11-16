# Renders icons/icon{16,32,48,128}.png: an indigo rounded square with a white magnifier
# and a small amber "quest" star. Run: powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

foreach ($size in 16, 32, 48, 128) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $s = $size / 128.0

  $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 99, 91, 255)), ([System.Drawing.Color]::FromArgb(255, 67, 56, 202)), 45.0
  $g.FillPath($bg, (RoundedRect 0 0 ($size - 0.5) ($size - 0.5) (28 * $s)))

  $penW = [Math]::Max(2.0, 13 * $s)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $penW
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $g.DrawEllipse($pen, 24 * $s, 22 * $s, 56 * $s, 56 * $s)
  $g.DrawLine($pen, 72 * $s, 70 * $s, 100 * $s, 98 * $s)

  if ($size -ge 32) {
    $amber = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 251, 191, 36))
    $cx = 52 * $s; $cy = 50 * $s; $R = 15 * $s; $r = 6.5 * $s
    $pts = for ($i = 0; $i -lt 10; $i++) {
      $ang = -[Math]::PI / 2 + $i * [Math]::PI / 5
      $rad = if ($i % 2 -eq 0) { $R } else { $r }
      New-Object System.Drawing.PointF ([float]($cx + $rad * [Math]::Cos($ang))), ([float]($cy + $rad * [Math]::Sin($ang)))
    }
    $g.FillPolygon($amber, [System.Drawing.PointF[]]$pts)
  }

  $file = Join-Path $out "icon$size.png"
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "wrote $file"
}
