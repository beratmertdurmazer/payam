import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEOJSON_PATH = os.path.join(ROOT, "scratch_countries.geojson")
OUT_JS_PATH = os.path.join(ROOT, "src", "world-map-data.js")
os.makedirs(os.path.dirname(OUT_JS_PATH), exist_ok=True)


def natural_earth_raw(lon_deg, lat_deg):
    lam = math.radians(lon_deg)
    phi = math.radians(max(-60.0, min(84.0, lat_deg)))
    phi2 = phi * phi
    phi4 = phi2 * phi2
    phi6 = phi4 * phi2
    phi8 = phi4 * phi4
    phi10 = phi8 * phi2
    phi12 = phi10 * phi2
    x = lam * (0.8707 - 0.131979 * phi2 - 0.013791 * phi4 + 0.003971 * phi10 - 0.001529 * phi12)
    y = phi * (1.007226 + 0.015085 * phi2 - 0.044475 * phi6 + 0.028874 * phi8 - 0.005916 * phi10)
    return x, -y


# Compute projection bounds from [-180..180] x [-58..83] to fit viewBox 0 0 1000 490
xs, ys = [], []
for lon in (-180, 0, 180):
    for lat in (-58, 0, 83):
        px, py = natural_earth_raw(lon, lat)
        xs.append(px)
        ys.append(py)

MIN_X, MAX_X = min(xs), max(xs)
MIN_Y, MAX_Y = min(ys), max(ys)

WIDTH = 1000.0
HEIGHT = 490.0
PAD_X = 12.0
PAD_Y = 14.0
SCALE = min((WIDTH - 2 * PAD_X) / (MAX_X - MIN_X), (HEIGHT - 2 * PAD_Y) / (MAX_Y - MIN_Y))
DRAW_W = (MAX_X - MIN_X) * SCALE
DRAW_H = (MAX_Y - MIN_Y) * SCALE
OFF_X = (WIDTH - DRAW_W) / 2.0
OFF_Y = (HEIGHT - DRAW_H) / 2.0


def project(lon, lat):
    rx, ry = natural_earth_raw(lon, lat)
    x = OFF_X + (rx - MIN_X) * SCALE
    y = OFF_Y + (ry - MIN_Y) * SCALE
    return round(x, 1), round(y, 1)


def perp_dist(pt, a, b):
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    if dx == 0 and dy == 0:
        return math.hypot(pt[0] - a[0], pt[1] - a[1])
    t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy)
    proj = (a[0] + t * dx, a[1] + t * dy)
    return math.hypot(pt[0] - proj[0], pt[1] - proj[1])


def dp_simplify(pts, tol):
    if len(pts) <= 4:
        return pts
    dmax = 0.0
    idx = 0
    for i in range(1, len(pts) - 1):
        d = perp_dist(pts[i], pts[0], pts[-1])
        if d > dmax:
            idx = i
            dmax = d
    if dmax > tol:
        left = dp_simplify(pts[: idx + 1], tol)
        right = dp_simplify(pts[idx:], tol)
        return left[:-1] + right
    return [pts[0], pts[-1]]


def ring_to_path(ring):
    if len(ring) < 3:
        return ""
    proj_pts = [project(lon, lat) for lon, lat in ring]
    # Remove consecutive duplicates
    dedup = [proj_pts[0]]
    for p in proj_pts[1:]:
        if abs(p[0] - dedup[-1][0]) > 0.15 or abs(p[1] - dedup[-1][1]) > 0.15:
            dedup.append(p)
    if len(dedup) < 3:
        return ""
    # Skip wrap-around artifacts crossing 180 deg meridian (e.g. Chukotka/Fiji jumps > 350px)
    clean_jumps = any(abs(dedup[i][0] - dedup[i - 1][0]) > 350 for i in range(1, len(dedup)))
    if clean_jumps:
        return ""
    simp = dp_simplify(dedup, 0.55)
    if len(simp) < 3:
        return ""
    xs_r = [p[0] for p in simp]
    ys_r = [p[1] for p in simp]
    if (max(xs_r) - min(xs_r)) < 1.2 and (max(ys_r) - min(ys_r)) < 1.2:
        return ""
    parts = [f"M{simp[0][0]},{simp[0][1]}"]
    for p in simp[1:]:
        parts.append(f"L{p[0]},{p[1]}")
    parts.append("Z")
    return "".join(parts)


with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
    geo = json.load(f)

groups = {
    "context": [],       # Europe, North America, Oceania
    "asia": [],          # Asia (excluding Turkey)
    "africa": [],        # Africa
    "southAmerica": [],  # South America
    "turkey": [],        # Turkey hub
}

for feat in geo["features"]:
    props = feat["properties"]
    cont = props.get("CONTINENT", "")
    admin = props.get("ADMIN", "")
    iso3 = props.get("ISO_A3", "")
    if cont == "Antarctica":
        continue
    geom = feat["geometry"]
    gtype = geom["type"]
    polys = [geom["coordinates"]] if gtype == "Polygon" else geom["coordinates"]

    for poly in polys:
        outer = poly[0]
        if not outer:
            continue
        avg_lon = sum(p[0] for p in outer) / len(outer)
        avg_lat = sum(p[1] for p in outer) / len(outer)

        # Classify accurately
        if iso3 == "TUR" or admin == "Turkey":
            target = "turkey"
        elif admin == "France" and avg_lon < -30:
            target = "southAmerica"  # French Guiana
        elif cont == "Asia":
            target = "asia"
        elif cont == "Africa":
            target = "africa"
        elif cont == "South America":
            target = "southAmerica"
        elif cont in ("Europe", "North America", "Oceania"):
            target = "context"
        else:
            # Seven seas open ocean tiny islands
            if avg_lat < -58:
                continue
            target = "context"

        d_outer = ring_to_path(outer)
        if d_outer:
            groups[target].append(d_outer)

# Pre-compute exact hub and city coordinates using the identical projection
HUBS = [
    {"id": "istanbul", "name": "İstanbul", "lon": 28.9784, "lat": 41.0082, "primary": True},
    {"id": "bodrum", "name": "Bodrum", "lon": 27.4305, "lat": 37.0344, "primary": False},
]
for h in HUBS:
    h["x"], h["y"] = project(h["lon"], h["lat"])

CITIES = {
    "asia": [
        {"id": "dubai", "name": "Dubai", "lon": 55.2708, "lat": 25.2048},
        {"id": "bangkok", "name": "Bangkok", "lon": 100.5018, "lat": 13.7563},
        {"id": "singapore", "name": "Singapur", "lon": 103.8198, "lat": 1.3521},
        {"id": "tokyo", "name": "Tokyo", "lon": 139.6917, "lat": 35.6895},
    ],
    "africa": [
        {"id": "marrakesh", "name": "Marakeş", "lon": -7.9811, "lat": 31.6295},
        {"id": "cairo", "name": "Kahire", "lon": 31.2357, "lat": 30.0444},
        {"id": "nairobi", "name": "Nairobi", "lon": 36.8219, "lat": -1.2921},
        {"id": "capetown", "name": "Cape Town", "lon": 18.4241, "lat": -33.9249},
    ],
    "southAmerica": [
        {"id": "bogota", "name": "Bogotá", "lon": -74.0721, "lat": 4.7110},
        {"id": "lima", "name": "Lima", "lon": -77.0428, "lat": -12.0464},
        {"id": "saopaulo", "name": "São Paulo", "lon": -46.6333, "lat": -23.5505},
        {"id": "buenosaires", "name": "Buenos Aires", "lon": -58.3816, "lat": -34.6037},
    ],
}
for region, lst in CITIES.items():
    for c in lst:
        c["x"], c["y"] = project(c["lon"], c["lat"])

# Graticule lines every 30 deg lon, 20 deg lat for cartographic precision
graticule = []
for lat in (-40, -20, 0, 20, 40, 60):
    pts = [project(lon, lat) for lon in range(-180, 181, 10)]
    graticule.append("M" + "L".join(f"{x},{y}" for x, y in pts))
for lon in range(-150, 180, 30):
    pts = [project(lon, lat) for lat in range(-56, 82, 4)]
    graticule.append("M" + "L".join(f"{x},{y}" for x, y in pts))

payload = {
    "viewBox": f"0 0 {int(WIDTH)} {int(HEIGHT)}",
    "graticule": "".join(graticule),
    "paths": {k: "".join(v) for k, v in groups.items()},
    "hubs": HUBS,
    "cities": CITIES,
}

with open(OUT_JS_PATH, "w", encoding="utf-8") as f:
    f.write("// Generated from Natural Earth 110m vector data (Natural Earth I projection)\n")
    f.write("window.PAYAM_WORLD_MAP = ")
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

sz = os.path.getsize(OUT_JS_PATH)
print(f"Wrote {OUT_JS_PATH} ({sz/1024:.1f} KB)")
for k, v in groups.items():
    print(f"  {k}: {len(v)} polygons")
