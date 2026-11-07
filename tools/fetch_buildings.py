"""Baja las siluetas de edificios de Microsoft Global ML Building Footprints
(detectadas con IA sobre imágenes satelitales) para el área del juego.

Licencia de los datos: ODbL. https://github.com/microsoft/GlobalMLBuildingFootprints
Salida: data/ms_buildings.json  ->  [[altura_m, [[lon, lat], ...]], ...]
"""
import gzip, io, json, pathlib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
BBOX = (-27.4850, -58.8720, -27.4520, -58.8150)  # sur, oeste, norte, este (igual que build_map.py)
QUADKEY = "210303100"  # tile zoom 9 que contiene a Corrientes
INDEX = "https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv"
UA = {"User-Agent": "taragui-turbo-mapgen/0.1"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        return r.read()


links = get(INDEX).decode().splitlines()
urls = [l.split(",")[2] for l in links if l.startswith("Argentina,") and l.split(",")[1] == QUADKEY]
assert urls, "no encontré el quadkey en el índice"
S, W, N, E = BBOX
out = []
for url in urls:
    print("bajando", url)
    raw = gzip.decompress(get(url))
    for line in io.StringIO(raw.decode()):
        f = json.loads(line)
        ring = f["geometry"]["coordinates"][0]
        lons = [p[0] for p in ring]; lats = [p[1] for p in ring]
        if max(lons) < W or min(lons) > E or max(lats) < S or min(lats) > N:
            continue
        h = f.get("properties", {}).get("height", -1)
        out.append([round(h, 1) if h and h > 0 else -1, [[round(p[0], 7), round(p[1], 7)] for p in ring]])
dst = ROOT / "data" / "ms_buildings.json"
dst.write_text(json.dumps(out, separators=(",", ":")))
print("edificios en el área:", len(out), "con altura:", sum(1 for b in out if b[0] > 0))
