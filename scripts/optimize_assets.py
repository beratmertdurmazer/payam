import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "scratch_raw_img")
OUT_DIR = os.path.join(ROOT, "assets", "img")
os.makedirs(OUT_DIR, exist_ok=True)

# 1. Process transparent PAYAM logos (dark espresso original + warm ivory light variant)
logo_src = Image.open(os.path.join(RAW_DIR, "P1_X16.png")).convert("RGBA")
bbox = logo_src.getbbox()
if bbox:
    logo_cropped = logo_src.crop(bbox)
else:
    logo_cropped = logo_src

# Resize cleanly to max width 480px while preserving crispness
max_logo_w = 480
if logo_cropped.width > max_logo_w:
    ratio = max_logo_w / logo_cropped.width
    logo_cropped = logo_cropped.resize((max_logo_w, int(logo_cropped.height * ratio)), Image.Resampling.LANCZOS)

logo_cropped.save(os.path.join(OUT_DIR, "payam-logo-dark.png"), optimize=True)

# Create light ivory variant (#F7F3EC) preserving exact alpha channel
r, g, b, a = logo_cropped.split()
ivory_fill = Image.new("RGBA", logo_cropped.size, (247, 243, 236, 255))
ivory_r, ivory_g, ivory_b, _ = ivory_fill.split()
logo_light = Image.merge("RGBA", (ivory_r, ivory_g, ivory_b, a))
logo_light.save(os.path.join(OUT_DIR, "payam-logo-light.png"), optimize=True)

# 2. Semantic mapping for JPEG photos
PHOTO_MAP = {
    "P1_X6_X4.png": ("hero-coast.jpg", 900, 82),
    "P1_X8_X7.png": ("hero-palm.jpg", 900, 82),
    "P1_X12_X11.png": ("hero-terrace.jpg", 900, 82),
    "P1_X10_X9.png": ("hero-desert.jpg", 900, 82),

    "P2_X6_X4.png": ("about-meeting.jpg", 960, 82),

    "P3_X6_X4.png": ("srv-lounge.jpg", 1000, 82),
    "P3_X8_X7.png": ("srv-conference.jpg", 1000, 82),
    "P3_X10_X9.png": ("srv-vip-van.jpg", 1000, 82),

    "P4_X8_X7.png": ("corp-flight.jpg", 900, 82),
    "P4_X6_X4.png": ("corp-hotel.jpg", 900, 82),
    "P4_X10_X9.png": ("corp-traveler.jpg", 900, 82),

    "P8_X8_X7.png": ("exp-intro-yoga.jpg", 900, 80),
    "P8_X6_X4.png": ("exp-intro-sail.jpg", 900, 80),
    "P8_X10_X9.png": ("exp-intro-seminar.jpg", 900, 82),

    "P9_X7_X5.png": ("exp-sailing.jpg", 900, 82),
    "P9_X12_X11.png": ("exp-diving.jpg", 900, 82),
    "P9_X15_X14.png": ("exp-yoga.jpg", 900, 82),
    "P9_X18_X17.png": ("exp-rowing.jpg", 900, 82),

    "P10_X7_X5.png": ("exp-hiking.jpg", 900, 82),
    "P10_X10_X9.png": ("exp-incentive.jpg", 1000, 80),
    "P10_X13_X12.png": ("exp-wellness.jpg", 900, 82),
    "P10_X16_X15.png": ("exp-safari.jpg", 900, 82),

    "P11_X10_X8_X7.png": ("culture-rome.jpg", 1050, 80),
    "P11_X12_X11.png": ("culture-beach.jpg", 1050, 80),
    "P11_X6_X4.png": ("culture-thailand.jpg", 1050, 80),

    "P12_X6_X4.png": ("dmc-floating-market.jpg", 1000, 82),
    "P15_X9_X7_X6_X4.png": ("contact-aerial.jpg", 1100, 80),
}

total_bytes = 0
for fn in ["payam-logo-dark.png", "payam-logo-light.png"]:
    sz = os.path.getsize(os.path.join(OUT_DIR, fn))
    total_bytes += sz
    print(f"{fn:26s} {sz/1024:6.1f} KB")

for src_name, (dst_name, max_dim, qual) in PHOTO_MAP.items():
    src_path = os.path.join(RAW_DIR, src_name)
    im = Image.open(src_path).convert("RGB")
    if max(im.size) > max_dim:
        im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    dst_path = os.path.join(OUT_DIR, dst_name)
    im.save(dst_path, "JPEG", quality=qual, optimize=True, progressive=True)
    sz = os.path.getsize(dst_path)
    total_bytes += sz
    print(f"{dst_name:26s} {im.width}x{im.height}  {sz/1024:6.1f} KB")

print(f"\nTotal optimized media size: {total_bytes/1024:.1f} KB ({total_bytes/(1024*1024):.2f} MB)")
