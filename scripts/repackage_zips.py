import os
import zipfile
import shutil

def make_zip(source_dir, output_zip):
    print(f"Creating {output_zip} from {source_dir}...")
    file_count = 0
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)
                file_count += 1
    size_mb = os.path.getsize(output_zip) / (1024 * 1024)
    print(f"Done! {output_zip}: {file_count} files, {size_mb:.2f} MB ({os.path.getsize(output_zip)} bytes)")

if __name__ == '__main__':
    src = "cloudflare-pages-site"
    primary_zip = "cloudflare-pages-site.zip"
    make_zip(src, primary_zip)
    
    # Mirror to all convenience zip files so whichever the user opens is current
    copies = [
        "cloudflare-pages-site-latest.zip",
        "cloudflare-pages-site-patched.zip",
        "cloudflare-pages-site-v4-patched.zip",
        "cloudflare-pages-site-v3-patched.zip"
    ]
    for target in copies:
        shutil.copyfile(primary_zip, target)
        print(f"Mirrored -> {target}")
    
    print("\nAll zip archives successfully updated with the latest build!")
