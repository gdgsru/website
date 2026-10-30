from PIL import Image

img = Image.open('scripts/t_260ms.png')
# Check unique colors in t_260ms
colors = img.getcolors(maxcolors=100000)
print(f"Total unique colors in t_260ms: {len(colors)}")
# Are there any blue, green, yellow, red colors?
google_colors = 0
for count, col in colors:
    r, g, b = col[:3]
    # Check if blue, green, yellow, or red
    if (b > 200 and r < 100) or (g > 150 and r < 100) or (r > 200 and g > 150 and b < 50) or (r > 200 and g < 100 and b < 100):
        google_colors += count
print(f"Pixels with Google colors in t_260ms: {google_colors} out of {img.width * img.height}")

img0 = Image.open('scripts/t_060ms.png')
colors0 = img0.getcolors(maxcolors=100000)
google_colors0 = 0
for count, col in colors0:
    r, g, b = col[:3]
    if (b > 200 and r < 100) or (g > 150 and r < 100) or (r > 200 and g > 150 and b < 50) or (r > 200 and g < 100 and b < 100):
        google_colors0 += count
print(f"Pixels with Google colors in t_060ms: {google_colors0} out of {img.width * img.height}")
