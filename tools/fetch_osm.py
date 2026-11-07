"""Baja los datos de OpenStreetMap del centro de Corrientes (Overpass API).
Datos (c) OpenStreetMap contributors, licencia ODbL."""
import json, sys, urllib.request, urllib.parse, pathlib

# sur, oeste, norte, este
BBOX = (-27.4850, -58.8720, -27.4520, -58.8150)

QUERY = f"""
[out:json][timeout:120];
(
  way["highway"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["building"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["leisure"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["landuse"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["natural"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  relation["natural"="water"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["waterway"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["amenity"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["name"]["amenity"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out body;
>;
out skel qt;
"""

out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "data/osm_raw.json")
data = urllib.parse.urlencode({"data": QUERY}).encode()
req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=data,
                             headers={"User-Agent": "taragui-turbo-mapgen/0.1"})
with urllib.request.urlopen(req, timeout=180) as r:
    raw = r.read()
out.write_bytes(raw)
j = json.loads(raw)
print("elementos:", len(j["elements"]), "bytes:", len(raw))
