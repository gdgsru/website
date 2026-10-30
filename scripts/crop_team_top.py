from PIL import Image

img = Image.open(r"C:\Users\Narayan Bora\.gemini\antigravity\brain\88b431b3-07a3-41f7-bed6-96a805f27d93\inspect_team.png")
crop1 = img.crop((0, 0, 400, 150))
crop1.save(r"C:\Users\Narayan Bora\.gemini\antigravity\brain\88b431b3-07a3-41f7-bed6-96a805f27d93\inspect_team_top.png")
print("Saved inspect_team_top.png")
