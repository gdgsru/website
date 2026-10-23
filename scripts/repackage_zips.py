import os
import zipfile
import shutil

def make_zip(source_dir, output_zip):
    print(f"Creating {output_zip} from {source_dir}...")
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)
    print(f"Done! {output_zip} size: {os.path.getsize(output_zip)} bytes")

if __name__ == '__main__':
    src = "cloudflare-pages-site"
    make_zip(src, "cloudflare-pages-site.zip")
    shutil.copyfile("cloudflare-pages-site.zip", "cloudflare-pages-site-latest.zip")
    print("Updated cloudflare-pages-site.zip and cloudflare-pages-site-latest.zip successfully.")
