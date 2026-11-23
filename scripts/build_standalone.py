import base64
import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(ROOT, "dist")
os.makedirs(DIST_DIR, exist_ok=True)

with open(os.path.join(ROOT, "index.html"), "r", encoding="utf-8") as f:
    html = f.read()

with open(os.path.join(ROOT, "styles.css"), "r", encoding="utf-8") as f:
    css = f.read()

# Build base64 map for all files in assets/img/
data_map = {}
for path in sorted(glob.glob(os.path.join(ROOT, "assets/img/*"))):
    fn = os.path.basename(path)
    ext = os.path.splitext(fn)[1].lower()
    mime = "image/png" if ext == ".png" else ("image/webp" if ext == ".webp" else "image/jpeg")
    with open(path, "rb") as img_f:
        b64 = base64.b64encode(img_f.read()).decode("ascii")
    data_map[f"assets/img/{fn}"] = f"data:{mime};base64,{b64}"

# Inline CSS
html = html.replace(
    '<link rel="stylesheet" href="styles.css" />',
    f"<style>\n{css}\n  </style>",
    1
)

# Mark PAYAM_STANDALONE = true
html = html.replace(
    "window.PAYAM_PRESET = { client: \"\", event: \"\", lang: \"\" };",
    "window.PAYAM_STANDALONE = true;\n    window.PAYAM_PRESET = { client: \"\", event: \"\", lang: \"\" };",
    1
)

# Inline JS files & replace asset paths
js_files = [
    "src/i18n.js",
    "src/world-map-data.js",
    "src/logos-data.js",
    "src/app.js",
]

for jf in js_files:
    with open(os.path.join(ROOT, jf), "r", encoding="utf-8") as f:
        code = f.read()
    for rel_path, uri in data_map.items():
        code = code.replace(f'"{rel_path}"', f'"{uri}"')
    # Protect closing script tag inside inline scripts if any
    code = code.replace("</script>", "<\\/script>")
    tag = f'<script src="{jf}"></script>'
    assert tag in html, f"Missing script tag {tag}"
    html = html.replace(tag, f"<script>\n{code}\n  </script>", 1)

# Replace img src in HTML
for rel_path, uri in data_map.items():
    html = html.replace(f'src="{rel_path}"', f'src="{uri}"')

# Verify no relative image file paths remain
leftovers = re.findall(r'assets/img/[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp|svg)', html)
assert not leftovers, f"Unresolved relative image paths: {leftovers}"

out_path = os.path.join(DIST_DIR, "PAYAM-MICE-Sunum.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)

sz = os.path.getsize(out_path)
print(f"Built standalone offline HTML: {out_path}")
print(f"Size: {sz/1024:.1f} KB ({sz/(1024*1024):.2f} MB), embedded assets: {len(data_map)}")
