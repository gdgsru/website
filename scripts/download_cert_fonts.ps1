# Download certificate fonts for self-hosting
# Fonts needed: Outfit (400,500,600,700,800,900), Space Grotesk (500,700,800,900),
#               JetBrains Mono (400,600,700,800), Kalam (400,700), Inter (400,500,600,700,800)

$fontsDir = "d:\Drafts\Blogs\website\cloudflare-pages-site\assets\fonts\cert"
New-Item -ItemType Directory -Force -Path $fontsDir | Out-Null

# We'll use the Google Fonts API with a User-Agent that returns woff2
$headers = @{
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# Direct woff2 URLs from Google Fonts CDN (fonts.gstatic.com)
# These are stable URLs we can download directly

$fonts = @(
    # Outfit - latin subset
    @{ name = "outfit-400"; url = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4G-EiAou6Y.woff2" },
    @{ name = "outfit-500"; url = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4VK1C4G-EiAou6Y.woff2" },
    @{ name = "outfit-600"; url = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4a62C4G-EiAou6Y.woff2" },
    @{ name = "outfit-700"; url = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4be2C4G-EiAou6Y.woff2" },
    @{ name = "outfit-800"; url = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4dq2C4G-EiAou6Y.woff2" },
    @{ name = "outfit-900"; url = "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4fO2C4G-EiAou6Y.woff2" }
)

Write-Host "Fetching Google Fonts CSS to get exact woff2 URLs..."

# Strategy: call the Google Fonts CSS2 API with a Chrome UA to get woff2 URLs
$apiUrl = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;700;900&family=JetBrains+Mono:wght@400;600;700;800&family=Kalam:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap&subset=latin"

try {
    $css = Invoke-WebRequest -Uri $apiUrl -Headers $headers -UseBasicParsing
    $cssContent = $css.Content
    Write-Host "Got CSS response ($($cssContent.Length) chars)"
    
    # Extract all woff2 URLs
    $pattern = "url\(([^)]+\.woff2)\)"
    $matches = [regex]::Matches($cssContent, $pattern)
    Write-Host "Found $($matches.Count) woff2 URLs"
    $cssContent | Out-File "$fontsDir\google-fonts-response.css" -Encoding utf8
    Write-Host "Saved CSS to $fontsDir\google-fonts-response.css"
} catch {
    Write-Host "Error fetching Google Fonts CSS: $_"
}
