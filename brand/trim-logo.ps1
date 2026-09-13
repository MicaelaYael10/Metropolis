# Quita el fondo de un logo y lo recorta al contenido.
# Solo usa System.Drawing de Windows: no anade dependencias al proyecto.
#
#   pwsh -File brand/trim-logo.ps1 -In <origen.jpg> -Out <destino.png>

param(
    [Parameter(Mandatory = $true)][string]$In,
    [Parameter(Mandatory = $true)][string]$Out,
    [int]$Pad = 14,
    [int]$Tol = 26
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# --- cargar y convertir a 32bpp ARGB en memoria (libera el archivo) ---
$fileBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $In))
$w = $fileBmp.Width
$h = $fileBmp.Height
$bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($fileBmp, 0, 0, $w, $h)
$g.Dispose()
$fileBmp.Dispose()

$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)

Write-Host "origen: ${w}x${h}"

# --- color de fondo = media de las cuatro esquinas ---
$corners = @(
    @(0, 0), @(($w - 1), 0), @(0, ($h - 1)), @(($w - 1), ($h - 1))
)
$bgB = 0; $bgG = 0; $bgR = 0
foreach ($c in $corners) {
    $i = $c[1] * $stride + $c[0] * 4
    $bgB += $bytes[$i]; $bgG += $bytes[$i + 1]; $bgR += $bytes[$i + 2]
}
$bgB = [int]($bgB / 4); $bgG = [int]($bgG / 4); $bgR = [int]($bgR / 4)
Write-Host "fondo detectado: R=$bgR G=$bgG B=$bgB"

function Test-Bg([int]$i) {
    $d = [math]::Abs($bytes[$i + 2] - $bgR) + [math]::Abs($bytes[$i + 1] - $bgG) + [math]::Abs($bytes[$i] - $bgB)
    return $d -le ($Tol * 3)
}

# --- recorrido en anchura desde el borde: solo se borra el fondo conectado ---
$visited = New-Object bool[] ($w * $h)
$queue = New-Object 'System.Collections.Generic.Queue[int]'

for ($x = 0; $x -lt $w; $x++) {
    foreach ($y in @(0, ($h - 1))) {
        $p = $y * $w + $x
        if (-not $visited[$p]) { $visited[$p] = $true; $queue.Enqueue($p) }
    }
}
for ($y = 0; $y -lt $h; $y++) {
    foreach ($x in @(0, ($w - 1))) {
        $p = $y * $w + $x
        if (-not $visited[$p]) { $visited[$p] = $true; $queue.Enqueue($p) }
    }
}

$minX = $w; $minY = $h; $maxX = 0; $maxY = 0

while ($queue.Count -gt 0) {
    $p = $queue.Dequeue()
    $y = [int][math]::Floor($p / $w)
    $x = $p - $y * $w
    $i = $y * $stride + $x * 4

    if (Test-Bg $i) {
        $bytes[$i + 3] = 0
        foreach ($n in @(
                @(($x - 1), $y), @(($x + 1), $y), @($x, ($y - 1)), @($x, ($y + 1))
            )) {
            $nx = $n[0]; $ny = $n[1]
            if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $w -or $ny -ge $h) { continue }
            $np = $ny * $w + $nx
            if (-not $visited[$np]) { $visited[$np] = $true; $queue.Enqueue($np) }
        }
    }
    else {
        # pixel de contenido: se marca visitado para no volver a entrar
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
    }
}

[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
$bmp.UnlockBits($data)

Write-Host "contenido: x=$minX..$maxX  y=$minY..$maxY"

# --- recortar al contenido con margen ---
$cx = [math]::Max(0, $minX - $Pad)
$cy = [math]::Max(0, $minY - $Pad)
$cw = [math]::Min($w - $cx, ($maxX - $minX + 1) + 2 * $Pad)
$ch = [math]::Min($h - $cy, ($maxY - $minY + 1) + 2 * $Pad)

$outBmp = New-Object System.Drawing.Bitmap($cw, $ch, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$og = [System.Drawing.Graphics]::FromImage($outBmp)
$og.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, 0, $cw, $ch)), (New-Object System.Drawing.Rectangle($cx, $cy, $cw, $ch)), [System.Drawing.GraphicsUnit]::Pixel)
$og.Dispose()

$outFull = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Out))
$outBmp.Save($outFull, [System.Drawing.Imaging.ImageFormat]::Png)
$outBmp.Dispose()
$bmp.Dispose()

Write-Host "escrito: $outFull  (${cw}x${ch}, con transparencia)"
