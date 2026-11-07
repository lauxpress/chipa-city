"""Edificios y lugares con nombre del área del juego según Wikidata (CC0, dominio público).

Trae nombre, tipo, coordenadas, altura (P2048), pisos (P1101), foto en Wikimedia Commons (P18)
y la referencia a OSM/Wikipedia, para ir modelando los edificios emblemáticos.
Salida: data/wikidata_landmarks.json
"""
import json, pathlib, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
S, W, N, E = (-27.4850, -58.8720, -27.4520, -58.8150)
QUERY = f"""
SELECT ?item ?itemLabel ?typeLabel ?coord ?height ?floors ?image ?article WHERE {{
  SERVICE wikibase:box {{
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point({W} {S})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point({E} {N})"^^geo:wktLiteral .
  }}
  OPTIONAL {{ ?item wdt:P31 ?type . }}
  OPTIONAL {{ ?item wdt:P2048 ?height . }}
  OPTIONAL {{ ?item wdt:P1101 ?floors . }}
  OPTIONAL {{ ?item wdt:P18 ?image . }}
  OPTIONAL {{ ?article schema:about ?item ; schema:isPartOf <https://es.wikipedia.org/> . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "es,en". }}
}}"""
req = urllib.request.Request("https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": QUERY, "format": "json"}),
                             headers={"User-Agent": "taragui-turbo-mapgen/0.1 (proyecto de juego open source)"})
rows = json.load(urllib.request.urlopen(req, timeout=120))["results"]["bindings"]
items = {}
for r in rows:
    qid = r["item"]["value"].rsplit("/", 1)[-1]
    it = items.setdefault(qid, {"qid": qid, "name": r.get("itemLabel", {}).get("value", ""), "types": set()})
    if "typeLabel" in r: it["types"].add(r["typeLabel"]["value"])
    lon, lat = r["coord"]["value"].replace("Point(", "").rstrip(")").split()
    it["lat"], it["lon"] = float(lat), float(lon)
    for k in ("height", "floors", "image", "article"):
        if k in r: it[k] = r[k]["value"]
out = []
for it in items.values():
    it["types"] = sorted(it["types"]); out.append(it)
out.sort(key=lambda x: x["name"])
(ROOT / "data" / "wikidata_landmarks.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf8")
print("lugares:", len(out), "| con foto:", sum("image" in i for i in out), "| con altura:", sum("height" in i for i in out),
      "| con pisos:", sum("floors" in i for i in out))
for i in out:
    if "height" in i or "floors" in i or "image" in i:
        print(" -", i["name"], "|", ", ".join(i["types"][:2]), "|", i.get("height", ""), i.get("floors", ""), "| foto" if "image" in i else "")
