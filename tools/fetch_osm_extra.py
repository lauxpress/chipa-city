"""Datos extra de OpenStreetMap: semáforos, faroles y direcciones (para la numeración de los carteles).
Datos (c) OpenStreetMap contributors, licencia ODbL.  Salida: data/osm_extra.json
"""
import json, pathlib, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
S, W, N, E = (-27.4850, -58.8720, -27.4520, -58.8150)
B = f"({S},{W},{N},{E})"
QUERY = f"""
[out:json][timeout:120];
(
  node["highway"="traffic_signals"]{B};
  node["highway"="street_lamp"]{B};
  node["addr:housenumber"]["addr:street"]{B};
  way["addr:housenumber"]["addr:street"]{B};
);
out center tags;
"""
req = urllib.request.Request(__import__("os").environ.get("OVERPASS", "https://overpass-api.de/api/interpreter"), data=urllib.parse.urlencode({"data": QUERY}).encode(),
                             headers={"User-Agent": "taragui-turbo-mapgen/0.1"})
raw = json.load(urllib.request.urlopen(req, timeout=180))
out = {"signals": [], "lamps": [], "addresses": []}
for e in raw["elements"]:
    lat = e.get("lat", e.get("center", {}).get("lat")); lon = e.get("lon", e.get("center", {}).get("lon"))
    t = e.get("tags", {})
    if lat is None:
        continue
    if t.get("highway") == "traffic_signals":
        out["signals"].append([lat, lon])
    elif t.get("highway") == "street_lamp":
        out["lamps"].append([lat, lon])
    if "addr:housenumber" in t and "addr:street" in t:
        num = "".join(ch for ch in t["addr:housenumber"].split(";")[0].split("-")[0] if ch.isdigit())
        if num:
            out["addresses"].append([lat, lon, t["addr:street"], int(num)])
(ROOT / "data" / "osm_extra.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf8")
print({k: len(v) for k, v in out.items()})
