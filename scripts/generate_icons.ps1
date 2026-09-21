Add-Type -AssemblyName System.Drawing

function Generate-ShieldIcon {
    param(
        [int]$size,
        [string]$outputPath
    )

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)

    $scale = [double]$size / 128.0

    # Key geometric coordinates for 128x128
    $pTopCenter = New-Object System.Drawing.PointF([float](64.0 * $scale), [float](16.0 * $scale))
    $pTopLeft   = New-Object System.Drawing.PointF([float](24.0 * $scale), [float](26.0 * $scale))
    $pMidLeft   = New-Object System.Drawing.PointF([float](24.0 * $scale), [float](66.0 * $scale))
    $pBottom    = New-Object System.Drawing.PointF([float](64.0 * $scale), [float](116.0 * $scale))
    $pMidRight  = New-Object System.Drawing.PointF([float](104.0 * $scale), [float](66.0 * $scale))
    $pTopRight  = New-Object System.Drawing.PointF([float](104.0 * $scale), [float](26.0 * $scale))

    # Full shield polygon
    $fullPoints = [System.Drawing.PointF[]]@($pTopCenter, $pTopRight, $pMidRight, $pBottom, $pMidLeft, $pTopLeft)
    $fullPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $fullPath.AddPolygon($fullPoints)

    # Left facet polygon (illuminated)
    $leftPoints = [System.Drawing.PointF[]]@($pTopCenter, $pBottom, $pMidLeft, $pTopLeft)
    $leftPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $leftPath.AddPolygon($leftPoints)

    # Right facet polygon (shaded)
    $rightPoints = [System.Drawing.PointF[]]@($pTopCenter, $pTopRight, $pMidRight, $pBottom)
    $rightPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rightPath.AddPolygon($rightPoints)

    # Brushes & Pens
    # Left facet: Crisp bright white #F8FAFC
    $leftBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
    # Right facet: Metallic Platinum #A1A1AA
    $rightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 161, 161, 170))
    
    # Outer stroke for crisp contrast against any background
    $strokeWidth = [float][Math]::Max(1.0, 3.5 * $scale)
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(240, 15, 15, 18), $strokeWidth)
    $borderPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    # Center seam
    $seamWidth = [float][Math]::Max(1.0, 1.8 * $scale)
    $seamPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 24, 24, 27), $seamWidth)

    # Draw shapes
    $g.FillPath($leftBrush, $leftPath)
    $g.FillPath($rightBrush, $rightPath)
    $g.DrawLine($seamPen, $pTopCenter, $pBottom)
    $g.DrawPath($borderPen, $fullPath)

    # Optional: For larger icons (48 and 128), add a small Vercel status accent dot or keep pure minimalist
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Successfully generated: $outputPath ($size x $size)"
}

$iconsDir = Join-Path $PSScriptRoot "..\icons"
Generate-ShieldIcon -size 128 -outputPath (Join-Path $iconsDir "icon128.png")
Generate-ShieldIcon -size 48  -outputPath (Join-Path $iconsDir "icon48.png")
Generate-ShieldIcon -size 16  -outputPath (Join-Path $iconsDir "icon16.png")
