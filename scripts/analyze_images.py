from PIL import Image

def analyze(path, name):
    img = Image.open(path)
    print(f"{name}: size={img.size}, mode={img.mode}")
    # Crop top 300px
    top = img.crop((0, 0, img.width, 300))
    top.save(f"scripts/{name}_top.png")
    # Crop middle 300-600px
    mid = img.crop((0, 300, img.width, 600))
    mid.save(f"scripts/{name}_mid.png")

artifact_dir = r"C:\Users\Narayan Bora\.gemini\antigravity\brain\88b431b3-07a3-41f7-bed6-96a805f27d93"
analyze(f"{artifact_dir}/inspect_team.png", "team")
analyze(f"{artifact_dir}/inspect_blog.png", "blog")
print("Saved analysis crops")
