from PIL import Image
import os

for f in ["t_060ms.png", "t_260ms.png", "t_360ms.png", "t_500ms.png", "t_700ms.png"]:
    p = os.path.join("scripts", f)
    if os.path.exists(p):
        img = Image.open(p)
        # Sample middle pixel of the screen
        cx, cy = img.width // 2, img.height // 2
        colors = [img.getpixel((cx, cy)), img.getpixel((100, cy)), img.getpixel((img.width - 100, cy))]
        print(f"{f}: size={img.size}, sample_colors={colors}")
