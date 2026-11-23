import base64
import json
import os
import re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "scratch_raw_logos")
IMG_OUT = os.path.join(ROOT, "assets", "img")
OUT_JS = os.path.join(ROOT, "src", "logos-data.js")
os.makedirs(IMG_OUT, exist_ok=True)
os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)


def tint_png_espresso(src_name, dst_name, max_w=260):
    im = Image.open(os.path.join(RAW_DIR, src_name)).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    if im.width > max_w:
        r = max_w / im.width
        im = im.resize((max_w, max(1, int(im.height * r))), Image.Resampling.LANCZOS)
    _, _, _, a = im.split()
    solid = Image.new("RGBA", im.size, (66, 37, 28, 255))
    sr, sg, sb, _ = solid.split()
    tinted = Image.merge("RGBA", (sr, sg, sb, a))
    out_path = os.path.join(IMG_OUT, dst_name)
    tinted.save(out_path, optimize=True)
    return out_path


tint_png_espresso("biocodex_png.png", "ref-biocodex.png", 250)
tint_png_espresso("opakim_png.png", "ref-opakim.png", 260)
tint_png_espresso("itu_png.png", "ref-itu.png", 240)


def read_raw(fn):
    with open(os.path.join(RAW_DIR, fn), "r", encoding="utf-8") as f:
        return f.read()


# 1. Vodafone
voda = read_raw("vodafone.svg")
voda = re.sub(r"<style[^>]*>.*?</style>", "", voda, flags=re.S)
voda = re.sub(r'class="a"', 'fill="currentColor"', voda)
voda = re.sub(r'<svg[^>]*>', '<svg viewBox="4.6 18.3 140.8 34.9" xmlns="http://www.w3.org/2000/svg">', voda, count=1)

# 2. Zoetis
zoe = read_raw("zoetis.svg")
zoe = re.sub(r"<title>.*?</title>", "", zoe, flags=re.S)
zoe = re.sub(r'\s+data-darkreader-[^=]+="[^"]*"', "", zoe)
zoe = re.sub(r'\s+style="[^"]*"', "", zoe)
zoe = zoe.replace('fill="#F65C00"', 'fill="currentColor"')
zoe = re.sub(r'<svg[^>]*>', '<svg viewBox="0 0.48 85 32.03" xmlns="http://www.w3.org/2000/svg">', zoe, count=1)

# 3. Kalekim
kale = read_raw("kalekim_0.svg")
kale = kale.replace('fill="black"', 'fill="currentColor"')
kale = kale.replace('fill="#EA5C52"', 'fill="currentColor" fill-opacity="0.72"')
kale = kale.replace("clip0_156_2569", "clip_kalekim")
kale = re.sub(r'<svg[^>]*>', '<svg viewBox="0 0 168 32" fill="none" xmlns="http://www.w3.org/2000/svg">', kale, count=1)

# 4. Purina (strip full white bg box, unify dark to currentColor, keep letter cutouts as --ivory-card)
pur = read_raw("purina.svg")
pur = pur.replace('<path d="M157 0H0V33.1075H157V0Z" fill="white"/>', "")
pur = pur.replace('fill="#E91C24"', 'fill="currentColor"')
pur = pur.replace('fill="black"', 'fill="currentColor"')
pur = pur.replace('fill="white"', 'fill="var(--ivory-card, #FCFBF8)"')
pur = re.sub(r'<svg[^>]*>', '<svg viewBox="0 0 157 34" fill="none" xmlns="http://www.w3.org/2000/svg">', pur, count=1)

# 5. Menarini (for İbrahim Ethem Ulagay İlaç — Menarini Türkiye)
men = read_raw("menarini.svg")
men = re.sub(r"<defs><style>.*?</style></defs>", "", men, flags=re.S)
# Keep the square box background light ivory so the dark V-wedge + gold/espresso M pop cleanly
men = men.replace(
    '<path class="a" d="M45.107.9V45.107H.9V.9Z"',
    '<path fill="var(--ivory-card, #FCFBF8)" d="M45.107.9V45.107H.9V.9Z"'
)
men = men.replace('<path d="M44.956,45H0V0H44.956', '<path fill="currentColor" d="M44.956,45H0V0H44.956')
men = men.replace('<path d="M45.107.5,22.981,30.867.9.5Z"', '<path fill="currentColor" d="M45.107.5,22.981,30.867.9.5Z"')
men = men.replace('<path d="M32.992,74.641', '<path fill="currentColor" d="M32.992,74.641')
men = men.replace('style="fill:#9d9d9c;"', 'fill="currentColor" fill-opacity="0.4"')
men = men.replace('class="a"', 'fill="currentColor"')
men = men.replace('class="b"', 'fill="var(--gold-deep, #9A7145)"')
men = re.sub(r'<svg[^>]*>', '<svg viewBox="0 0 165.896 45" xmlns="http://www.w3.org/2000/svg">', men, count=1)

# 6. İstanbul Üniversitesi official crest SVG (clean & lightweight check)
iu_raw = read_raw("iu.svg")
iu_raw = re.sub(r"<\?xml[^>]*\?>", "", iu_raw)
iu_raw = re.sub(r"<!--.*?-->", "", iu_raw, flags=re.S)
# Preserve visual hierarchy: green field -> dark espresso, gold laurels/torch -> champagne gold, white -> ivory
def clean_iu_colors(svg_text):
    def repl_style(m):
        s = m.group(1)
        s = re.sub(r'fill:#ffffff|fill:#fff\b', 'fill:var(--ivory-card, #FCFBF8)', s, flags=re.I)
        s = re.sub(r'fill:#ffd528\b', 'fill:var(--gold-bright, #E2C6A1)', s, flags=re.I)
        s = re.sub(r'fill:#00733d\b', 'fill:currentColor', s, flags=re.I)
        s = re.sub(r'fill:#[0-9a-fA-F]{3,6}', 'fill:currentColor', s)
        return f'style="{s}"'
    svg_text = re.sub(r'style="([^"]*)"', repl_style, svg_text)
    svg_text = re.sub(r'fill="#ffffff"|fill="#fff"', 'fill="var(--ivory-card, #FCFBF8)"', svg_text, flags=re.I)
    svg_text = re.sub(r'fill="#ffd528"', 'fill="var(--gold-bright, #E2C6A1)"', svg_text, flags=re.I)
    svg_text = re.sub(r'fill="#[0-9a-fA-F]{3,6}"', 'fill="currentColor"', svg_text, flags=re.I)
    return svg_text

iu_clean = clean_iu_colors(iu_raw)
iu_clean = re.sub(r'<svg[^>]*>', '<svg viewBox="0 0 79.076546 79.076195" xmlns="http://www.w3.org/2000/svg">', iu_clean, count=1)

# Create two variants with distinct clipPath prefixes so placing both İÜ references on screen never collides!
iu_clean_1 = iu_clean.replace("clipPath", "iu1_clip")
iu_clean_2 = iu_clean.replace("clipPath", "iu2_clip")

# Check sizes
print("Cleaned SVG sizes:",
      "vodafone", len(voda),
      "zoetis", len(zoe),
      "kalekim", len(kale),
      "purina", len(pur),
      "menarini", len(men),
      "iu1", len(iu_clean_1))

# 7. Crisp Editorial Vector Marks for Remaining Organizations
SVG_SCHINDLER = '''<svg viewBox="0 0 180 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="22" cy="21" r="15" stroke="currentColor" stroke-width="5"/>
  <path d="M13.5 31L22 17L30.5 31H13.5Z" fill="var(--ivory-card, #FCFBF8)"/>
  <path d="M15.5 30L22 19L28.5 30H15.5Z" fill="currentColor" fill-opacity="0.72"/>
  <text x="46" y="27.5" fill="currentColor" font-family="Manrope, Arial, sans-serif" font-weight="800" font-size="21" letter-spacing="-0.4">Schindler</text>
</svg>'''

SVG_SINCLAIR = '''<svg viewBox="0 0 190 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="21" r="13.5" stroke="currentColor" stroke-width="1.8"/>
  <path d="M24 14.5C21.5 13 17.2 13.5 16.5 16.5C15.8 19.5 23.5 19.8 23 23.5C22.5 26.8 18 27.5 15.2 25.8" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
  <text x="42" y="25" fill="currentColor" font-family="Manrope, Arial, sans-serif" font-weight="700" font-size="17" letter-spacing="2.6">SINCLAIR</text>
</svg>'''

SVG_NETPARTNERING = '''<svg viewBox="0 0 210 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="15" cy="14" r="3.5" fill="currentColor"/>
  <circle cx="29" cy="14" r="3.5" stroke="currentColor" stroke-width="2"/>
  <circle cx="22" cy="28" r="3.5" fill="currentColor" fill-opacity="0.7"/>
  <path d="M17.5 16.2L20.5 24.5M26.5 16.2L23.5 24.5M18.5 14H25.5" stroke="currentColor" stroke-width="1.6"/>
  <text x="42" y="22" fill="currentColor" font-family="Manrope, Arial, sans-serif" font-weight="800" font-size="14.5" letter-spacing="-0.2">Netpartnering</text>
  <text x="42" y="33" fill="currentColor" fill-opacity="0.65" font-family="Manrope, Arial, sans-serif" font-weight="600" font-size="8.5" letter-spacing="1.6">CO-MARKETING</text>
</svg>'''

SVG_ONCHANNEL = '''<svg viewBox="0 0 185 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="21" cy="21" r="13" stroke="currentColor" stroke-width="2.2"/>
  <circle cx="21" cy="21" r="5" fill="currentColor"/>
  <path d="M29 13A11 11 0 0 1 29 29" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.6"/>
  <text x="44" y="25.5" fill="currentColor" font-family="Manrope, Arial, sans-serif" font-weight="800" font-size="15.5" letter-spacing="0.8">ON CHANNEL</text>
</svg>'''

SVG_GIYAD = '''<svg viewBox="0 0 175 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="26" height="26" rx="5" stroke="currentColor" stroke-width="1.8"/>
  <path d="M14 27V21M21 27V16M28 27V12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  <text x="44" y="26.5" fill="currentColor" font-family="Cormorant Garamond, Georgia, serif" font-weight="700" font-size="23" letter-spacing="1.8">GİYAD</text>
</svg>'''

SVG_TUKETICI = '''<svg viewBox="0 0 205 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M22 9V31M14 31H30M11 15H33M11 15L8 23H14L11 15ZM33 15L30 23H36L33 15Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <text x="45" y="19.5" fill="currentColor" font-family="Cormorant Garamond, Georgia, serif" font-weight="700" font-size="13.5" letter-spacing="0.8">TÜKETİCİ HUKUKU</text>
  <text x="45" y="31.5" fill="currentColor" fill-opacity="0.72" font-family="Manrope, Arial, sans-serif" font-weight="700" font-size="9.5" letter-spacing="2.2">ENSTİTÜSÜ</text>
</svg>'''

SVG_KAMUIHALE = '''<svg viewBox="0 0 205 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 14L22 8L35 14H9ZM12 17V29M18.5 17V29M25.5 17V29M32 17V29M9 32H35" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="45" y="19.5" fill="currentColor" font-family="Cormorant Garamond, Georgia, serif" font-weight="700" font-size="13.5" letter-spacing="0.8">KAMU İHALE HUKUKU</text>
  <text x="45" y="31.5" fill="currentColor" fill-opacity="0.72" font-family="Manrope, Arial, sans-serif" font-weight="700" font-size="9.5" letter-spacing="2.2">ENSTİTÜSÜ</text>
</svg>'''

SVG_IGSK = '''<svg viewBox="0 0 195 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21 7L33 12V22C33 28.5 27.5 33.5 21 36C14.5 33.5 9 28.5 9 22V12L21 7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M13.5 22C16 19.5 18.5 19.5 21 22C23.5 24.5 26 24.5 28.5 22" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
  <text x="42" y="19.5" fill="currentColor" font-family="Manrope, Arial, sans-serif" font-weight="800" font-size="12.5" letter-spacing="0.6">İSTANBUL GSK</text>
  <text x="42" y="31" fill="currentColor" fill-opacity="0.68" font-family="Manrope, Arial, sans-serif" font-weight="600" font-size="8.2" letter-spacing="0.8">GENÇLİK &amp; SPOR KULÜBÜ</text>
</svg>'''

# Build 18 ordered references matching PDF page 14 (with fixed names & sectors)
REFS = [
    {"id": "vodafone", "name": "Vodafone İletişim", "sector": "corp", "type": "svg", "markup": voda},
    {"id": "schindler", "name": "Schindler Türkeli Asansör", "sector": "corp", "type": "svg", "markup": SVG_SCHINDLER},
    {"id": "kalekim", "name": "Kalekim Yapı Kimyasalları", "sector": "corp", "type": "svg", "markup": kale},
    {"id": "netpartnering", "name": "Netpartnering Co-Marketing", "sector": "corp", "type": "svg", "markup": SVG_NETPARTNERING},
    {"id": "onchannel", "name": "On Channel", "sector": "corp", "type": "svg", "markup": SVG_ONCHANNEL},

    {"id": "zoetis", "name": "Zoetis Hayvan Sağlığı", "sector": "pharma", "type": "svg", "markup": zoe},
    {"id": "purina", "name": "Nestlé Purina Veteriner Ürünleri", "sector": "pharma", "type": "svg", "markup": pur},
    {"id": "menarini", "name": "İbrahim Ethem Ulagay İlaç", "sector": "pharma", "type": "svg", "markup": men},
    {"id": "biocodex", "name": "Biocodex İlaç", "sector": "pharma", "type": "img", "src": "assets/img/ref-biocodex.png"},
    {"id": "sinclair", "name": "Sinclair Pharma Co.", "sector": "pharma", "type": "svg", "markup": SVG_SINCLAIR},
    {"id": "opakim", "name": "Opakim Tıbbi Ürünler", "sector": "pharma", "type": "img", "src": "assets/img/ref-opakim.png"},

    {"id": "iu-energy", "name": "İstanbul Üniversitesi Yenilenebilir Enerji Komisyonu", "sector": "edu", "type": "svg", "markup": iu_clean_1},
    {"id": "iu-vet", "name": "İstanbul Üniversitesi Veterinerlik Fakültesi", "sector": "edu", "type": "svg", "markup": iu_clean_2},
    {"id": "itu", "name": "İstanbul Teknik Üniversitesi Gemi İnşaatı Müh. Fakültesi", "sector": "edu", "type": "img", "src": "assets/img/ref-itu.png"},

    {"id": "giyad", "name": "GİYAD – Genç Yatırımcı İş Adamları Derneği", "sector": "law", "type": "svg", "markup": SVG_GIYAD},
    {"id": "tuketici", "name": "Tüketici Hukuku Enstitüsü", "sector": "law", "type": "svg", "markup": SVG_TUKETICI},
    {"id": "kamuihale", "name": "Kamu İhale Hukuku Enstitüsü", "sector": "law", "type": "svg", "markup": SVG_KAMUIHALE},
    {"id": "igsk", "name": "İstanbul Gençlik ve Spor Kulübü", "sector": "law", "type": "svg", "markup": SVG_IGSK},
]

with open(OUT_JS, "w", encoding="utf-8") as f:
    f.write("// Harmonized Reference Brand Logos (Official SVGs/Alphas + Editorial Vector Marks)\n")
    f.write("window.PAYAM_REFS = ")
    json.dump(REFS, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print(f"Wrote {OUT_JS} ({os.path.getsize(OUT_JS)/1024:.1f} KB)")
for fn in ["ref-biocodex.png", "ref-opakim.png", "ref-itu.png"]:
    print(f"  {fn}: {os.path.getsize(os.path.join(IMG_OUT, fn))/1024:.1f} KB")
