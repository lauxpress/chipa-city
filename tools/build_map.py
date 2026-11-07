"""Convierte data/osm_raw.json (OpenStreetMap) en la grilla de tiles del juego.

Salida: game/map.js  (window.MAPDATA)  y  data/preview.png (para revisar).
Datos del mapa (c) OpenStreetMap contributors, licencia ODbL.
"""
import base64, json, math, pathlib, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "osm_raw.json"
MSB = ROOT / "data" / "ms_buildings.json"  # tools/fetch_buildings.py
HEIGHTS = ROOT / "data" / "heights.npy"  # tools/fetch_heights.py (Google Open Buildings 2.5D)
EXTRA = ROOT / "data" / "osm_extra.json"  # tools/fetch_osm_extra.py (semáforos, direcciones)
OUT = ROOT / "game" / "map.js"
PREVIEW = ROOT / "data" / "preview.png"

BBOX = (-27.4850, -58.8720, -27.4520, -58.8150)  # sur, oeste, norte, este
TILE_M = 2.25  # metros por tile (antes 3: celdas más chicas = calles diagonales sin tanto zigzag)
TS_PX = 12      # píxeles del juego por tile (12 px / 2,25 m = 5,33 px por metro, la misma escala de siempre)
K = 3.0 / TILE_M  # para convertir medidas que estaban pensadas en tiles de 3 m

# Tipos de tile (tienen que coincidir con game/game.js)
BLOCK, ROAD, SIDEWALK, GRASS, WATER, SAND, PEATONAL, BRIDGE, OSMB, PARKING, FOOTPATH, YARD, BRIDGEW, MEDIAN, DIRT = range(15)
# MEDIAN = parterre entre las dos manos de una avenida; DIRT = tierra / ripio
# BRIDGEW = tablero de puente con agua abajo

S, Wl, N, E = BBOX
LAT0 = (S + N) / 2
MX = math.cos(math.radians(LAT0)) * 111320.0
MY = 110574.0
W = int(round((E - Wl) * MX / TILE_M))
H = int(round((N - S) * MY / TILE_M))


def proj(lat, lon):
    return ((lon - Wl) * MX / TILE_M, (N - lat) * MY / TILE_M)


raw = json.loads(RAW.read_text(encoding="utf8"))
nodes = {e["id"]: (e["lat"], e["lon"]) for e in raw["elements"] if e["type"] == "node"}
ways = {e["id"]: e for e in raw["elements"] if e["type"] == "way"}
rels = [e for e in raw["elements"] if e["type"] == "relation"]


def way_pts(w):
    return [proj(*nodes[n]) for n in w["nodes"] if n in nodes]


def is_closed(w):
    return len(w["nodes"]) > 3 and w["nodes"][0] == w["nodes"][-1]


def assemble_rings(way_ids):
    """Une segmentos de un multipolígono en anillos cerrados."""
    segs = [list(ways[i]["nodes"]) for i in way_ids if i in ways]
    rings = []
    while segs:
        ring = segs.pop()
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for k, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += s[::-1][1:]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = s[::-1][:-1] + ring
                else:
                    continue
                segs.pop(k)
                changed = True
                break
        rings.append([proj(*nodes[n]) for n in ring if n in nodes])
    return rings


img = Image.new("L", (W, H), YARD)  # lo que no es calle ni edificio: patios / terrenos
dr = ImageDraw.Draw(img)

# 1) Río Paraná (multipolígono): agua afuera, islas como vegetación
for r in rels:
    if r.get("tags", {}).get("natural") != "water":
        continue
    outers = [m["ref"] for m in r["members"] if m["type"] == "way" and m["role"] == "outer"]
    inners = [m["ref"] for m in r["members"] if m["type"] == "way" and m["role"] == "inner"]
    for ring in assemble_rings(outers):
        if len(ring) > 2:
            dr.polygon(ring, fill=WATER)
    for ring in assemble_rings(inners):
        if len(ring) > 2:
            dr.polygon(ring, fill=GRASS)

GREEN = {("leisure", "park"), ("leisure", "garden"), ("leisure", "pitch"), ("leisure", "playground"),
         ("leisure", "recreation_ground"), ("leisure", "track"), ("landuse", "grass"),
         ("landuse", "recreation_ground"), ("landuse", "cemetery"), ("natural", "wood"),
         ("natural", "heath"), ("natural", "scrub"), ("natural", "grassland")}


def area_type(t):
    if t.get("natural") == "beach":
        return SAND
    if t.get("natural") == "water" or t.get("leisure") == "swimming_pool":
        return WATER
    if t.get("amenity") == "parking":
        return PARKING
    for k, v in GREEN:
        if t.get(k) == v:
            return GRASS
    return None


# 2) Áreas: parques, playas, estacionamientos (las grandes primero, las chicas encima)
areas = []
for w in ways.values():
    t = w.get("tags", {})
    if not is_closed(w) or "highway" in t:
        continue
    at = area_type(t)
    if at is not None:
        pts = way_pts(w)
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        areas.append(((max(xs) - min(xs)) * (max(ys) - min(ys)), at, pts))
for _, at, pts in sorted(areas, key=lambda a: -a[0]):
    dr.polygon(pts, fill=at)

# 3) Edificios: los de OSM (mapeados a mano) + los de Microsoft (detectados del satélite)
osm_polys, osm_levels, osm_names = [], [], []
for w in ways.values():
    t = w.get("tags", {})
    if ((t.get("building", "no") != "no") or (t.get("amenity") == "place_of_worship" and t.get("name"))) and is_closed(w):
        pts = way_pts(w)
        dr.polygon(pts, fill=OSMB)
        osm_polys.append(pts)
        lv = "".join(ch for ch in t.get("building:levels", "") if ch.isdigit())
        osm_levels.append(int(lv) if lv else None)
        osm_names.append(t.get("name", ""))
grid = np.array(img, dtype=np.uint8)
ms_polys = []
from shapely.geometry import Polygon as _SPoly
from shapely.strtree import STRtree as _STree
_osm_shapes = [g for g in (_SPoly(pp).buffer(0) for pp in osm_polys if len(pp) > 2) if not g.is_empty]
_osm_tree = _STree(_osm_shapes)
if MSB.exists():
    mimg = Image.new("L", (W, H), 0)
    mdr = ImageDraw.Draw(mimg)
    for _, ring in json.loads(MSB.read_text()):
        pts = [proj(lat, lon) for lon, lat in ring]
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        if 0 <= cx < W and 0 <= cy < H and grid[int(cy), int(cx)] == OSMB:
            continue  # ya está en OSM
        try:
            mp = _SPoly(pts).buffer(0)
            hit = False
            for i in _osm_tree.query(mp):
                inter = mp.intersection(_osm_shapes[i]).area
                if inter > 0.35 * min(mp.area, _osm_shapes[i].area):
                    hit = True; break
            if hit:
                continue  # se superpone con un edificio mapeado a mano: manda OSM
        except Exception:
            pass
        mdr.polygon(pts, fill=1)
        ms_polys.append(pts)
    grid[(np.array(mimg) > 0) & (grid == YARD)] = BLOCK

# 4) Senderos peatonales: solo dentro de plazas / playas / estacionamientos
fimg = Image.new("L", (W, H), 0)
fdr = ImageDraw.Draw(fimg)
for w in ways.values():
    t = w.get("tags", {})
    if t.get("highway") in ("footway", "path", "cycleway", "steps") and t.get("bridge") is None:
        pts = way_pts(w)
        if len(pts) > 1:
            fdr.line(pts, fill=1, width=1)
fmask = np.array(fimg) > 0
grid[fmask & np.isin(grid, [GRASS, SAND])] = FOOTPATH
# Polilíneas de senderos para dibujarlos suaves en el juego
paths = []
for w in ways.values():
    t = w.get("tags", {})
    if t.get("highway") in ("footway", "path", "cycleway", "steps") and t.get("bridge") is None:
        pts = way_pts(w)
        if len(pts) > 1 and any(0 <= x < W and 0 <= y < H for x, y in pts):
            paths.append([round(c, 1) for xy in pts for c in xy])

# 5) Calles, por importancia (las grandes al final)
ROAD_W = {"service": 3, "unclassified": 5, "residential": 5, "tertiary": 7, "secondary": 7,
          "secondary_link": 4, "primary": 8, "primary_link": 4, "trunk": 8, "trunk_link": 4}  # en tiles de 2,25 m
def road_width(t):
    hw = t.get("highway")
    lanes = "".join(ch for ch in t.get("lanes", "") if ch.isdigit())
    if t.get("oneway") == "yes" and hw in ("trunk", "primary", "secondary", "tertiary"):
        return 4  # una mano de avenida o colectora (2 carriles)
    return ROAD_W[hw]


ORDER = ["service", "unclassified", "residential", "tertiary", "secondary_link", "secondary",
         "primary_link", "primary", "trunk_link", "trunk"]
pre_road = grid.copy()
rimg = Image.fromarray(grid)
rdr = ImageDraw.Draw(rimg)
rimg_nb = Image.fromarray(grid)       # las mismas calles pero sin los puentes: lo que se ve debajo de un viaducto
rdr_nb = ImageDraw.Draw(rimg_nb)
for w in ways.values():
    t = w.get("tags", {})
    if t.get("highway") in ("pedestrian", "living_street"):
        pts = way_pts(w)
        if len(pts) > 1:
            rdr.line(pts, fill=PEATONAL, width=4 if t["highway"] == "pedestrian" else 5, joint="curve")
            rdr_nb.line(pts, fill=PEATONAL, width=4 if t["highway"] == "pedestrian" else 5, joint="curve")
for hw in ORDER:
    for w in ways.values():
        t = w.get("tags", {})
        if t.get("highway") != hw:
            continue
        pts = way_pts(w)
        if len(pts) < 2:
            continue
        val = BRIDGE if t.get("bridge") else ROAD
        rdr.line(pts, fill=val, width=road_width(t), joint="curve")
        if not t.get("bridge"):
            rdr_nb.line(pts, fill=ROAD, width=road_width(t), joint="curve")
grid = np.array(rimg, dtype=np.uint8)
grid_nb = np.array(rimg_nb, dtype=np.uint8)
grid[(grid == BRIDGE) & (pre_road == WATER)] = BRIDGEW


def dil(m, r):  # dilatación cuadrada separable
    o = m.copy()
    for d in range(1, r + 1):
        o[d:, :] |= m[:-d, :]; o[:-d, :] |= m[d:, :]
    o2 = o.copy()
    for d in range(1, r + 1):
        o2[:, d:] |= o[:, :-d]; o2[:, :-d] |= o[:, d:]
    return o2


def ero(m, r):
    return ~dil(~m, r)


from collections import defaultdict
dual = defaultdict(list)
for w in ways.values():
    t = w.get("tags", {})
    if t.get("oneway") == "yes" and t.get("highway") in ("trunk", "primary", "secondary") and t.get("name") and not t.get("bridge"):
        dual[t["name"]].append(w)
medians = 0
for name, ws in dual.items():
    if len(ws) < 2:
        continue
    mimg = Image.new("L", (W, H), 0); md = ImageDraw.Draw(mimg)
    for w in ws:
        pts = way_pts(w)
        if len(pts) > 1:
            md.line(pts, fill=1, width=road_width(w["tags"]), joint="curve")
    m = np.array(mimg) > 0
    closed = ero(dil(m, 3), 3)
    med = closed & ~m & np.isin(grid, [YARD, BLOCK, OSMB, GRASS, FOOTPATH])
    grid[med] = MEDIAN
    medians += int(med.sum())
# además, una línea de parterre a mitad de camino entre las dos manos (aunque en OSM estén pegadas),
# abierta en cada cruce de calle
from shapely.geometry import LineString as _LS, Point as _PT
from shapely.ops import nearest_points as _np
node_names = defaultdict(set)
for w in ways.values():
    t = w.get("tags", {})
    if t.get("highway") in ROAD_W or t.get("highway") in ("pedestrian", "living_street"):
        for n in w["nodes"]:
            node_names[n].add(t.get("name", "") + "|" + t.get("highway"))
mimg = Image.new("L", (W, H), 0); md = ImageDraw.Draw(mimg)
for name, ws in dual.items():
    if len(ws) < 2:
        continue
    lines = [(w, _LS(way_pts(w))) for w in ws if len(way_pts(w)) > 1]
    for w, L in lines:
        n = max(2, int(L.length / 2))
        prev = None
        for k in range(n + 1):
            p = L.interpolate(k / n, normalized=True)
            a = L.interpolate(max(0, k - 0.5) / n, normalized=True); b = L.interpolate(min(n, k + 0.5) / n, normalized=True)
            tx, ty = b.x - a.x, b.y - a.y
            best = None
            for w2, L2 in lines:
                if w2 is w:
                    continue
                q = _np(L2, p)[0]; d = p.distance(q)
                if d < 1.6 or d > 9.3:
                    continue
                s2 = L2.project(q); qa = L2.interpolate(max(0, s2 - 0.5)); qb = L2.interpolate(min(L2.length, s2 + 0.5))
                if abs(tx * (qb.x - qa.x) + ty * (qb.y - qa.y)) < 0.7 * math.hypot(tx, ty) * math.hypot(qb.x - qa.x, qb.y - qa.y):
                    continue  # tiene que ir paralela (en cualquier sentido: también separa las colectoras)
                if best is None or d < best[0]:
                    best = (d, q)
            mid = ((p.x + best[1].x) / 2, (p.y + best[1].y) / 2) if best else None
            if mid and prev:
                md.line([prev, mid], fill=1, width=1)
            prev = mid
# abrir el parterre en los cruces con otras calles
for name, ws in dual.items():
    for w in ws:
        for nd in w["nodes"]:
            others = {x for x in node_names[nd] if not x.startswith(name + "|")}
            if others and nd in nodes:
                x, y = proj(*nodes[nd]); md.ellipse([x - 4.7, y - 4.7, x + 4.7, y + 4.7], fill=0)
mline = (np.array(mimg) > 0) & np.isin(grid, [ROAD, YARD, BLOCK, OSMB, GRASS, FOOTPATH])
grid[mline] = MEDIAN
medians += int(mline.sum())
print("parterres (tiles):", medians, "en", sum(1 for v in dual.values() if len(v) > 1), "avenidas")

# Trazado de los puentes (para el tablero 3D): se encadenan los tramos con el mismo tipo de calle
from collections import defaultdict
bways = [w for w in ways.values() if w.get("tags", {}).get("bridge") and w["tags"].get("highway") in ROAD_W]
by_end = defaultdict(list)
for w in bways:
    by_end[w["nodes"][0]].append(w); by_end[w["nodes"][-1]].append(w)
used, bridges = set(), []
for w in bways:
    if w["id"] in used:
        continue
    used.add(w["id"]); hw = w["tags"]["highway"]; seq = list(w["nodes"])
    for forward in (True, False):
        while True:
            end = seq[-1] if forward else seq[0]
            cand = [x for x in by_end[end] if x["id"] not in used and x["tags"]["highway"] == hw]
            if not cand:
                break
            x = cand[0]; used.add(x["id"])
            nn = x["nodes"] if x["nodes"][0] == end else x["nodes"][::-1]
            seq = seq + nn[1:] if forward else nn[::-1][:-1] + seq
    pts = [proj(*nodes[n]) for n in seq if n in nodes]
    length_m = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:])) * TILE_M
    name = w["tags"].get("name", "")
    main = "Belgrano" in name and hw == "trunk"
    deck = 35.0 if main else (6.0 if length_m > 20 else 0)
    if deck < 1.5:
        continue
    bridges.append({"name": name, "w": ROAD_W[hw], "deck": deck, "pylons": main, "len": round(length_m),
                    "pts": [round(c, 2) for xy in pts for c in xy]})
print("puentes:", [(b["name"], b["len"], b["deck"]) for b in bridges])
# Debajo de un viaducto alto no hay asfalto: vuelve lo que había (parque, pasto o la calle que cruza por abajo).
# El perfil de altura es el mismo que usa el juego (bridgeZ en game.js).
elev = Image.new("L", (W, H), 0); ed = ImageDraw.Draw(elev)
for b in bridges:
    pp = list(zip(b["pts"][0::2], b["pts"][1::2]))
    cum = [0.0]
    for a, c in zip(pp, pp[1:]):
        cum.append(cum[-1] + math.hypot(c[0] - a[0], c[1] - a[1]))
    L = cum[-1]; R = L * 0.3; r = b["w"] / 2 + 1
    for i in range(len(pp) - 1):
        a, c = pp[i], pp[i + 1]; seg = cum[i + 1] - cum[i]
        n = max(1, int(seg * 2))
        for k in range(n + 1):
            sv = cum[i] + seg * k / n
            u = min(1.0, max(0.0, min(sv, L - sv) / R)); z = b["deck"] * u * u * (3 - 2 * u)
            if z > 3.0:
                x = a[0] + (c[0] - a[0]) * k / n; y = a[1] + (c[1] - a[1]) * k / n
                ed.ellipse([x - r, y - r, x + r, y + r], fill=1)
under = (np.array(elev) > 0) & (grid == BRIDGE)
grid[under] = grid_nb[under]
print("tiles liberados debajo del viaducto:", int(under.sum()))


def dilate(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


# 6) Veredas alrededor de las calles
road_mask = np.isin(grid, [ROAD, PEATONAL, PARKING])
side = dilate(road_mask, 1) & np.isin(grid, [BLOCK, OSMB, YARD])
grid[side] = SIDEWALK

# 7) Costa: los bloques pegados al agua pasan a ser verde ribereño
shore = dilate(grid == WATER, 3) & np.isin(grid, [BLOCK, YARD])
grid[shore] = GRASS

# Playas de la Costanera sur (al sur del puente): entre el río y la avenida hay arena, con una franja verde junto a la calle
beach = 0
for y in range(int(835 * K), min(H, int(1010 * K))):
    row = grid[y]
    xs = np.where(row[:int(700 * K)] == WATER)[0]
    if xs.size == 0:
        continue
    x = int(xs.max()) + 1
    run = []
    while x < min(W, int(700 * K)) and row[x] in (GRASS, YARD, FOOTPATH, DIRT):
        run.append(x); x += 1
    if x < W and row[x] in (ROAD, SIDEWALK, MEDIAN, PARKING) and len(run) > 8:
        for xx in run[:-4]:
            row[xx] = SAND; beach += 1
        for xx in run[-4:]:
            row[xx] = GRASS
print("arena en la Costanera sur (tiles):", beach)

# --- Red vial para el tráfico -----------------------------------------------
AI_ROADS = {"trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link",
            "tertiary", "residential", "unclassified", "living_street"}
node_index, node_xy, edges, names = {}, [], [], []
name_idx = {}


def nid(osm_id):
    if osm_id not in node_index:
        x, y = proj(*nodes[osm_id])
        node_index[osm_id] = len(node_xy)
        node_xy.append((round(x, 2), round(y, 2)))
    return node_index[osm_id]


def inside(osm_id):
    if osm_id not in nodes:
        return False
    x, y = proj(*nodes[osm_id])
    return 1 <= x < W - 1 and 1 <= y < H - 1


for w in ways.values():
    t = w.get("tags", {})
    hw = t.get("highway")
    if hw not in AI_ROADS and hw != "pedestrian":
        continue
    name = t.get("name", "")
    if name not in name_idx:
        name_idx[name] = len(names); names.append(name)
    ni = name_idx[name]
    ow = t.get("oneway")
    oneway = ow in ("yes", "1", "true") or hw in ("trunk_link", "primary_link") and ow != "no"
    reverse = ow == "-1"
    drive = 0 if hw == "pedestrian" else 1  # las peatonales solo se usan para nombres
    for a, b in zip(w["nodes"], w["nodes"][1:]):
        if not (inside(a) and inside(b)):
            continue
        A, B = nid(a), nid(b)
        if A == B:
            continue
        lanes = "".join(ch for ch in t.get("lanes", "") if ch.isdigit())
        multi = bool(lanes) and int(lanes) >= (2 if (oneway or reverse) else 4)
        flags = drive * 1 | (0 if (oneway or reverse) else 2) | (4 if multi else 0)
        if reverse:
            edges.append((B, A, flags, ni))
        else:
            edges.append((A, B, flags, ni))
            if not oneway:
                edges.append((B, A, flags, ni))

# Punto de inicio: Plaza 25 de Mayo
spawn = (W / 2, H / 2)
for w in ways.values():
    if w.get("tags", {}).get("name") == "Plaza 25 de Mayo" and is_closed(w):
        pts = way_pts(w)
        spawn = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))

# Lugares con nombre (para el mapa grande)
places = []
for w in ways.values():
    t = w.get("tags", {})
    if t.get("name") and is_closed(w) and (t.get("leisure") == "park" or t.get("amenity") in
                                            ("hospital", "university", "townhall", "place_of_worship")):
        pts = way_pts(w)
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        if 0 <= cx < W and 0 <= cy < H:
            places.append((t["name"], round(cx), round(cy)))

# Siluetas de edificios en píxeles del juego (16 px por tile), con pisos estimados.
# Formato plano: tipo(0=satélite,1=OSM), pisos, n, x0, y0, dx1, dy1, ...
import random
rnd = random.Random(7)
bflat = []
sx0, sy0 = spawn
# Recorte exacto: ningún edificio invade la calle ni la vereda (importante en 3D)
from shapely.geometry import LineString, Polygon
from shapely.strtree import STRtree
from shapely.ops import unary_union
road_geoms = []
for w in ways.values():
    t = w.get("tags", {}); hw = t.get("highway")
    if hw in ROAD_W or hw in ("pedestrian", "living_street"):
        pts = way_pts(w)
        if len(pts) > 1:
            wt = road_width(t) if hw in ROAD_W else (4 if hw == "pedestrian" else 5)
            road_geoms.append(LineString(pts).buffer(wt / 2 + 1.0, quad_segs=2))
road_tree = STRtree(road_geoms)


def clip_building(pts):
    poly = Polygon(pts).buffer(0)
    if poly.is_empty:
        return []
    idx = road_tree.query(poly)
    if len(idx):
        poly = poly.difference(unary_union([road_geoms[i] for i in idx]))
    parts = [poly] if poly.geom_type == "Polygon" else [g for g in getattr(poly, "geoms", []) if g.geom_type == "Polygon"]
    res = []
    for g in parts:
        if g.area < 1.5:
            continue
        g = g.simplify(0.15)
        if g.geom_type == "Polygon" and not g.is_empty:
            res.append(list(g.exterior.coords))
    return res


HGT = np.load(HEIGHTS) if HEIGHTS.exists() else None


def real_floors(pts):
    if HGT is None:
        return None
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0 = max(0, int(min(xs))), max(0, int(min(ys))); x1, y1 = min(W, int(max(xs)) + 2), min(H, int(max(ys)) + 2)
    if x1 <= x0 or y1 <= y0:
        return None
    mimg = Image.new("L", (x1 - x0, y1 - y0), 0)
    ImageDraw.Draw(mimg).polygon([(x - x0, y - y0) for x, y in pts], fill=1)
    vals = HGT[y0:y1, x0:x1][np.array(mimg) > 0]
    vals = vals[vals > 1.5]
    if vals.size < max(1, 0.25 * (np.array(mimg) > 0).sum()):
        return None
    return max(1, int(round(float(np.percentile(vals, 70)) / 3.0)))


# Manzana especial: Bolívar / Belgrano / Padre Borgatti / Don Bosco (dibujada a mano desde la referencia)
WORK = {"nw": ("Bolívar", "Padre Borgatti"), "ne": ("Bolívar", "Don Bosco"),
        "sw": ("Belgrano", "Padre Borgatti"), "se": ("Belgrano", "Don Bosco")}


def street_lines(name):
    return [[proj(*nodes[n]) for n in w["nodes"] if n in nodes] for w in ways.values()
            if w.get("tags", {}).get("name") == name and w["tags"].get("highway") in ROAD_W]


def crossing(a, b):
    best = None
    for la in street_lines(a):
        for lb in street_lines(b):
            for p in la:
                for q in lb:
                    d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2
                    if best is None or d < best[0]:
                        best = (d, ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2))
    return best[1] if best and best[0] < 4 else None


CORN = {k: crossing(*v) for k, v in WORK.items()}
work_props = {"cars": [], "trees": []}
work_buildings = []
if all(CORN.values()):
    def bl(u, v):  # coordenadas de la imagen de referencia (0..1) -> tiles (las esquinas son ejes de calle)
        s_, t_ = (u - 0.02) / 0.95, (v - 0.03) / 0.91
        a = [CORN["nw"][i] * (1 - s_) + CORN["ne"][i] * s_ for i in (0, 1)]
        b = [CORN["sw"][i] * (1 - s_) + CORN["se"][i] * s_ for i in (0, 1)]
        return (a[0] * (1 - t_) + b[0] * t_, a[1] * (1 - t_) + b[1] * t_)

    def rect(u0, v0, u1, v1):
        return [bl(u0, v0), bl(u1, v0), bl(u1, v1), bl(u0, v1)]

    def fill(poly, val, over):
        img = Image.fromarray(np.zeros((H, W), np.uint8)); ImageDraw.Draw(img).polygon(poly, fill=1)
        m = (np.array(img) > 0) & np.isin(grid, over)
        grid[m] = val

    block = rect(0.02, 0.03, 0.97, 0.94)
    from shapely.geometry import Polygon as _P, Point as _Pt
    block_poly = _P(block)
    inner = [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT, PARKING]
    fill(block, DIRT, inner)
    fill(rect(0.06, 0.53, 0.95, 0.88), PARKING, inner)   # playón de estacionamiento
    fill(rect(0.88, 0.20, 0.95, 0.53), PARKING, inner)   # calle interna
    fill(rect(0.72, 0.36, 0.88, 0.53), PARKING, inner)
    STY = {"chapa": 0, "teja": 1, "losa": 2, "membrana": 3}
    for sty, pal, fl, u0, v0, u1, v1 in [
        ("chapa", 1, 1, .385, .09, .455, .16), ("losa", 0, 1, .455, .085, .62, .15),
        ("membrana", 0, 1, .39, .155, .70, .215), ("membrana", 0, 1, .70, .135, .765, .205),
        ("membrana", 1, 1, .295, .28, .34, .40), ("chapa", 0, 2, .365, .29, .53, .45),
        ("losa", 2, 1, .63, .26, .71, .40), ("chapa", 0, 1, .64, .40, .70, .48),
        ("membrana", 0, 1, .82, .06, .93, .11)]:
        poly = rect(u0, v0, u1, v1)
        fill(poly, BLOCK, [DIRT, PARKING, YARD])
        work_buildings.append((10 + STY[sty] * 4 + pal, fl, poly))
    for u, v, r in [(.12, .16, 4), (.09, .29, 3), (.17, .25, 3), (.07, .42, 2), (.21, .12, 2), (.55, .31, 2), (.66, .60, 3), (.92, .13, 2)]:
        x, y = bl(u, v); work_props["trees"].append([round(x, 2), round(y, 2), r])
    cars = []
    for i in range(14):
        if i not in (4, 9): cars.append((.13 + i * .031, .565, -1.5708))
    for i in range(11):
        if i != 6: cars.append((.27 + i * .031, .71, -1.5708))
    for i in range(6): cars.append((.765, .58 + i * .045, 0.0))
    for i in range(10):
        if i not in (3, 7): cars.append((.925, .26 + i * .06, -1.5708))
    for u, v in [(.735, .49), (.775, .49)]: cars.append((u, v, -1.5708))
    rcol = random.Random(5)
    for u, v, a in cars:
        x, y = bl(u, v)
        work_props["cars"].append([round(x, 2), round(y, 2), a, rcol.choice([2, 2, 2, 4, 4, 3, 0, 1])])
    print("manzana del trabajo: edificios", len(work_buildings), "autos", len(work_props["cars"]))
else:
    block_poly = None
    print("no encontré las esquinas de la manzana del trabajo:", CORN)

# ---- Lugares armados a mano desde capturas de referencia ----------------------------------------------------
# Cada lugar se ubica con 3 esquinas reales de OSM medidas sobre la imagen (píxeles -> tiles con una afín).
excl_polys = [block_poly] if block_poly is not None else []
work_props.setdefault("fences", []); work_props.setdefault("chimneys", []); work_props.setdefault("ruins", [])


def affine_from(pairs):
    import numpy as _n
    A = _n.array([[u, v, 1] for (u, v), _ in pairs], float)
    X = _n.array([t for _, t in pairs], float)
    M = _n.linalg.solve(A, X)  # 3x2
    return lambda u, v: (float(u * M[0, 0] + v * M[1, 0] + M[2, 0]), float(u * M[0, 1] + v * M[1, 1] + M[2, 1]))


def node_of(a, b):
    ids_a = {n for w in ways.values() if w.get("tags", {}).get("name") == a for n in w["nodes"]}
    for w in ways.values():
        if w.get("tags", {}).get("name") == b:
            for n in w["nodes"]:
                if n in ids_a and n in nodes:
                    return proj(*nodes[n])
    return None


# Casa en Guido Spano y Vélez Sarsfield (esquina sudoeste) + chimenea de la fábrica vieja + vecinos
_c = node_of("Guido Spano", "Vélez Sarsfield")
_n = node_of("Vélez Sarsfield", "Pringles")
_w = node_of("Guido Spano", "Gobernador Antonio B. Gallino")
if _c and _n and _w:
    img = affine_from([((420, 505), _c), ((418, 240), _n), ((30, 500), _w)])
    P = lambda pts: [img(u, v) for u, v in pts]
    inner = [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT, PARKING]
    lot = P([(318, 508), (425, 508), (425, 603), (318, 603)])
    fill(lot, YARD, inner)
    ruins = P([(438, 330), (528, 330), (528, 488), (438, 488)])
    fill(ruins, DIRT, inner)
    for poly in (lot, ruins):
        excl_polys.append(_P(poly))
    # la casa: blanca, techo plano, galería al frente a la izquierda
    house = P([(350, 530), (394, 530), (394, 586), (334, 586), (334, 543), (350, 543)])
    fill(house, BLOCK, [YARD, DIRT])
    work_buildings.append((10 + 3 * 4 + 0, 1, house, "Mi casa"))
    # edificio de departamentos de enfrente (sudeste)
    apt = P([(562, 517), (660, 517), (660, 572), (562, 572)])
    excl_polys.append(_P(apt))
    fill(apt, BLOCK, inner)
    work_buildings.append((10 + 3 * 4 + 0, 5, apt, ""))
    # las calles del juego son más anchas que las reales: lo que cae en calle/vereda se corre hacia el terreno
    lcx = sum(q[0] for q in lot) / 4; lcy = sum(q[1] for q in lot) / 4

    def inside_lot(x, y):
        for _ in range(60):
            tx, ty = int(x), int(y)
            if 0 <= tx < W and 0 <= ty < H and grid[ty, tx] in (YARD, BLOCK, DIRT, GRASS):
                return x, y
            d = math.hypot(lcx - x, lcy - y) or 1
            x += (lcx - x) / d * 0.25; y += (lcy - y) / d * 0.25
        return x, y

    # rejas y medianeras de la casa
    for (a, b, kind) in [((394, 531), (422, 531), "rail"), ((422, 531), (422, 600), "rail"),
                         ((319, 531), (334, 531), "wall"), ((334, 531), (350, 531), "porch")]:
        (x1, y1), (x2, y2) = inside_lot(*img(*a)), inside_lot(*img(*b))
        work_props["fences"].append([round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2), kind])
    # árboles: la palmera de la esquina y la arboleda del fondo
    for u, v, r, k in [(410, 522, 3, 1), (326, 598, 4, 0), (358, 606, 4, 0), (392, 598, 3, 0), (304, 576, 3, 0), (408, 566, 3, 0)]:
        x, y = inside_lot(*img(u, v)); work_props["trees"].append([round(x, 2), round(y, 2), r, k])
    # chimenea de ladrillo de la fábrica vieja y restos de los cimientos
    x, y = img(566, 418); work_props["chimneys"].append([round(x, 2), round(y, 2), 38])
    for a, b in [((445, 338), (520, 338)), ((520, 338), (520, 480)), ((520, 480), (445, 480)), ((445, 480), (445, 338)),
                 ((445, 400), (520, 400)), ((482, 338), (482, 480))]:
        (x1, y1), (x2, y2) = img(*a), img(*b)
        work_props["ruins"].append([round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)])
    print("casa en Guido Spano y Vélez Sarsfield: lista")
else:
    print("no encontré las esquinas de la casa:", _c, _n, _w)

# ---- Costanera sur: Marriott (en Lavalle), Torre Ribera (una cuadra después) y la tercera torre -------------
# Captura satelital girada (norte arriba): escala calibrada con la Torre Ribera (91 m en Google Open Buildings).
work_props.setdefault("turrets", []); work_props.setdefault("watertowers", [])
excl_osm = []      # zonas donde también se descartan los edificios de OSM sin nombre
nofill = set()     # bloques elevados (corona, voladizo): no ocupan el piso
costa = lambda u, v: (K * (553.5 + (u - 272) * 0.24), K * (856 + (v - 228) * 0.24))  # calibrado en tiles de 3 m
# el edificio de tejas que había delante de la última torre no existe: se descarta
_gone = [(K * (582.5 - 6), K * (970 - 8)), (K * (582.5 + 6), K * (970 - 8)), (K * (582.5 + 6), K * (970 + 8)), (K * (582.5 - 6), K * (970 + 8))]
excl_polys.append(_P(_gone)); excl_osm.append(_P(_gone))
# segunda captura del Marriott (vista de la manzana): se pasa a las coordenadas de la captura girada
MR = lambda pts: [(240 + (x - 60) * 0.28, 155 + (y - 50) * 0.296) for x, y in pts]
CP = lambda pts: [costa(u, v) for u, v in pts]
import math as _m
arc = [(240 - 10 * _m.sin(_m.pi * k / 8), 215 + 85 * k / 8) for k in range(9)]  # frente curvo del podio
for name, pts, fl, solid in [
    ("Marriott (podio)", MR([(50, 58), (300, 58), (300, 540), (140, 540), (110, 450), (95, 350), (80, 250), (60, 150)]), 4, True),
    ("Marriott", MR([(125, 58), (298, 58), (298, 114), (125, 114)]), 21, True),
    ("Marriott (torre sur)", MR([(182, 402), (300, 402), (300, 530), (182, 530)]), 23, True),
    ("Torre Ribera (base)", [(322, 392), (392, 392), (392, 462), (322, 462)], 3, True),
    ("Torre Ribera", [(334, 398), (358, 398), (358, 422), (334, 422)], 30, True),
    ("Torre Ribera", [(334, 430), (358, 430), (358, 454), (334, 454)], 30, True),
    ("Torre Ribera (corona)", [(334, 421), (358, 421), (358, 431), (334, 431)], 30, False),
    ("Torre Costanera Sur (base)", [(402, 648), (462, 648), (462, 738), (402, 738)], 3, True),
    ("Torre Costanera Sur", [(410, 656), (452, 656), (452, 700), (410, 700)], 32, True),
    ("Torre Costanera Sur (voladizo)", [(410, 700), (452, 700), (452, 712), (410, 712)], 32, False),
]:
    poly = CP(pts)
    excl_polys.append(_P(poly)); excl_osm.append(_P(poly))
    if solid:
        fill(poly, BLOCK, [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT, PARKING, SIDEWALK])
    else:
        nofill.add(len(work_buildings))
    work_buildings.append((10 + 3 * 4, fl, poly, name))
print("torres de la Costanera: listas")

# ---- La Unidad (ex cárcel, hoy CIT): manzana Moreno / Padre Borgatti / Don Bosco / Av. 3 de Abril -------------
UC = {"nw": crossing("Moreno", "Padre Borgatti"), "ne": crossing("Moreno", "Don Bosco"),
      "sw": crossing("Avenida 3 de Abril", "Padre Borgatti"), "se": crossing("Avenida 3 de Abril", "Don Bosco")}
if all(UC.values()):
    def ub(u, v):  # imagen de referencia (norte arriba): esquinas de la manzana en (215,25)-(525,455)
        s_, t_ = (u - 215) / 310, (v - 25) / 430
        a = [UC["nw"][i] * (1 - s_) + UC["ne"][i] * s_ for i in (0, 1)]
        b = [UC["sw"][i] * (1 - s_) + UC["se"][i] * s_ for i in (0, 1)]
        return (a[0] * (1 - t_) + b[0] * t_, a[1] * (1 - t_) + b[1] * t_)
    UP = lambda pts: [ub(u, v) for u, v in pts]
    blockU = UP([(222, 32), (518, 32), (518, 450), (222, 450)])
    excl_polys.append(_P(blockU)); excl_osm.append(_P(blockU))
    fill(blockU, YARD, [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT])
    fill(UP([(300, 95), (445, 95), (445, 165), (300, 165)]), PARKING, [YARD, GRASS, DIRT])   # estacionamiento del patio norte
    fill(UP([(250, 180), (440, 180), (440, 380), (250, 380)]), PARKING, [YARD, GRASS, DIRT])  # patios de la cárcel (piso duro)
    for name, pts, fl, solid in [
        ("La Unidad (edificio norte)", [(245, 45), (505, 45), (505, 160), (445, 160), (445, 95), (300, 95), (300, 160), (245, 160)], 3, True),
        ("La Unidad (cárcel)", [(240, 392), (506, 392), (506, 446), (240, 446)], 2, True),   # la muralla llega hasta Don Bosco
        ("La Unidad (portón)", [(310, 420), (380, 420), (380, 458), (310, 458)], 3, True),
        ("La Unidad (CIT)", [(456, 254), (506, 254), (506, 388), (456, 388)], 4, True),      # detrás de la muralla, sobre Don Bosco
        ("Torre CIT La Unidad", [(458, 205), (503, 205), (503, 236), (458, 236)], 30, True),  # atrás, en la esquina noreste
    ]:
        poly = UP(pts)
        fill(poly, BLOCK, [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT, PARKING])
        work_buildings.append((10 + 2 * 4, fl, poly, name))
    for (u, v, r, h) in [(240, 446, 2.6, 11), (506, 446, 2.6, 11), (313, 458, 2.2, 13), (377, 458, 2.2, 13)]:
        x, y = ub(u, v); work_props["turrets"].append([round(x, 2), round(y, 2), r, h])
    x, y = ub(470, 245); work_props["watertowers"].append([round(x, 2), round(y, 2), 16])  # entre la torre y el edificio de vidrio
    print("La Unidad: lista")
else:
    print("no encontré las esquinas de La Unidad:", UC)

# ---- IOSCor: manzana Blas B. de la Vega / Piragine Niveyro / Dr. Ramón Carrillo / Lavalle: podio con lamas y 3 torres
BV, NV, RC = "Blas Benjamín de la Vega", "Gobernador Piragine Niveyro", "Doctor Ramón Carrillo"
IC = {"nw": node_of(BV, RC), "ne": node_of(NV, RC), "sw": node_of(BV, "Lavalle"), "se": node_of(NV, "Lavalle")}
if all(IC.values()):
    def ib(sv, tv):
        a = [IC["nw"][i] * (1 - sv) + IC["ne"][i] * sv for i in (0, 1)]
        b = [IC["sw"][i] * (1 - sv) + IC["se"][i] * sv for i in (0, 1)]
        return (a[0] * (1 - tv) + b[0] * tv, a[1] * (1 - tv) + b[1] * tv)
    IB = lambda s0, t0, s1, t1: [ib(s0, t0), ib(s1, t0), ib(s1, t1), ib(s0, t1)]
    blk = IB(0.02, 0.03, 0.98, 0.97)
    excl_polys.append(_P(blk)); excl_osm.append(_P(blk))
    fill(blk, YARD, [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT])
    for name, poly, fl in [("IOSCor (podio)", IB(0.04, 0.08, 0.96, 0.95), 2),
                           ("IOSCor (torre oeste)", IB(0.07, 0.50, 0.27, 0.93), 14),
                           ("IOSCor (torre central)", IB(0.40, 0.46, 0.58, 0.93), 10),
                           ("IOSCor (torre este)", IB(0.71, 0.50, 0.92, 0.93), 14)]:
        fill(poly, BLOCK, [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT, PARKING])
        work_buildings.append((10 + 2 * 4, fl, poly, name))
    print("IOSCor: listo")
GC = {"nw": node_of(BV, "Avenida 3 de Abril"), "ne": node_of("Misiones", "Avenida 3 de Abril"), "sw": node_of(BV, RC)}
if all(GC.values()):
    se = (GC["ne"][0] + GC["sw"][0] - GC["nw"][0], GC["ne"][1] + GC["sw"][1] - GC["nw"][1])
    def gb(sv, tv):
        a = [GC["nw"][i] * (1 - sv) + GC["ne"][i] * sv for i in (0, 1)]
        b = [GC["sw"][i] * (1 - sv) + se[i] * sv for i in (0, 1)]
        return (a[0] * (1 - tv) + b[0] * tv, a[1] * (1 - tv) + b[1] * tv)
    GB = lambda s0, t0, s1, t1: [gb(s0, t0), gb(s1, t0), gb(s1, t1), gb(s0, t1)]
    excl = GB(0.0, 0.0, 0.76, 1.0)
    excl_polys.append(_P(excl)); excl_osm.append(_P(excl))
    fill(excl, YARD, [BLOCK, OSMB])
    lotg = GB(0.02, 0.03, 0.74, 0.46)
    fill(lotg, PARKING, [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT])   # playa de la estación (se entra con el auto)
    canopy = GB(0.32, 0.08, 0.70, 0.40)
    work_buildings.append((10 + 3 * 4, 2, canopy, "Estación de servicio (techo)"))   # techo en el aire: no ocupa el piso
    shop = GB(0.32, 0.46, 0.58, 0.93)
    fill(shop, BLOCK, [PARKING, YARD]); work_buildings.append((10 + 0 * 4 + 1, 1, shop, "Estación de servicio (tienda)"))
    for sv in (0.37, 0.51, 0.65):
        for tv in (0.15, 0.32):
            x, y = gb(sv, tv); work_props.setdefault("pillars", []).append([round(x, 2), round(y, 2), 5.2])
    print("estación de servicio: lista")

# ---- Estadio de Huracán (Club Atlético Huracán Corrientes), Av. Sarmiento y Av. Teniente Ibáñez.
# Predio y cancha de OSM (ways 1216478191 y 107758136); las tribunas, a mano mirando fotos del usuario:
# oeste grande de dos bandejas (rojo y azul, con cabina de prensa), norte baja roja y azul,
# este larga color óxido, sur de ladrillo con locales hacia Teniente Ibáñez; torres de luz y alambrado rojo.
HUR_CLUB = [proj(*ll) for ll in [(-27.48276, -58.8296), (-27.4841, -58.82905), (-27.4847, -58.83094), (-27.48468, -58.83097),
                                  (-27.48339, -58.83082), (-27.48328, -58.83076), (-27.48298, -58.83019), (-27.48285, -58.82985)]]
HA, HB, HC, HD = [proj(*ll) for ll in [(-27.48321, -58.82964), (-27.48344, -58.83037), (-27.48432, -58.83001), (-27.48408, -58.82931)]]
hcx, hcy = (HA[0] + HB[0] + HC[0] + HD[0]) / 4, (HA[1] + HB[1] + HC[1] + HD[1]) / 4
_va = ((HC[0] - HB[0] + HD[0] - HA[0]) / 2, (HC[1] - HB[1] + HD[1] - HA[1]) / 2)   # eje largo: de norte a sur
_vb = ((HA[0] - HB[0] + HD[0] - HC[0]) / 2, (HA[1] - HB[1] + HD[1] - HC[1]) / 2)   # eje corto: de oeste a este
HLA, HLB = math.hypot(*_va) * TILE_M / 2, math.hypot(*_vb) * TILE_M / 2              # medio largo y medio ancho (m)
hua = (_va[0] / math.hypot(*_va), _va[1] / math.hypot(*_va)); hub = (_vb[0] / math.hypot(*_vb), _vb[1] / math.hypot(*_vb))


def hm(am, bm):  # metros en el sistema de la cancha -> tiles
    return (hcx + (hua[0] * am + hub[0] * bm) / TILE_M, hcy + (hua[1] * am + hub[1] * bm) / TILE_M)


def HR(a0, b0, a1, b1):
    return [hm(a0, b0), hm(a0, b1), hm(a1, b1), hm(a1, b0)]


excl_polys.append(_P(HUR_CLUB)); excl_osm.append(_P(HUR_CLUB))
fill(HUR_CLUB, YARD, [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT, PARKING])
fill(HR(-HLA - 2, -HLB - 2, HLA + 2, HLB + 2), GRASS, [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT, PARKING])
for name, poly, fl in [("Huracán (tribuna oeste)", HR(-HLA + 4, -HLB - 21, HLA - 4, -HLB - 3), 5),
                       ("Huracán (tribuna norte)", HR(-HLA - 12, -HLB + 7, -HLA - 3, HLB - 7), 2),
                       ("Huracán (tribuna este)", HR(-HLA + 6, HLB + 3, HLA - 6, HLB + 14), 3),
                       ("Huracán (tribuna sur)", HR(HLA + 1.5, -HLB + 5, HLA + 9.5, HLB - 5), 3)]:
    fill(poly, BLOCK, [YARD, BLOCK, OSMB, GRASS, FOOTPATH, DIRT, PARKING])
    work_buildings.append((10 + 0 * 4, fl, poly, name))
PL, PW = HLA - 2.5, HLB - 3.5   # líneas de la cancha (un poco adentro del césped)
_pc = [hm(-PL, -PW), hm(-PL, PW), hm(PL, PW), hm(PL, -PW)]   # 0-1: línea de fondo norte; 1-2: lateral este
work_props.setdefault("pitches", []).append([round(v, 2) for p in _pc for v in p])
for s in (-1, 1):   # arcos: [x, y, eje de la línea de fondo, hacia afuera]
    x, y = hm(s * PL, 0)
    work_props.setdefault("goals", []).append([round(x, 2), round(y, 2), round(hub[0], 4), round(hub[1], 4), round(hua[0] * s, 4), round(hua[1] * s, 4)])
fa, fb = HLA + 1, HLB + 1.5     # alambrado rojo alrededor del campo de juego
_fc = [hm(-fa, -fb), hm(-fa, fb), hm(fa, fb), hm(fa, -fb)]
for i in range(4):
    (x1, y1), (x2, y2) = _fc[i], _fc[(i + 1) % 4]
    work_props["fences"].append([round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2), "cancha"])
for am, bm in [(-HLA + 9, -HLB - 24), (4, -HLB - 24), (HLA - 9, -HLB - 24), (-HLA + 4, HLB + 17), (HLA - 4, HLB + 17)]:
    x, y = hm(am, bm)
    work_props.setdefault("floodlights", []).append([round(x, 2), round(y, 2), 30])
print("estadio de Huracán: listo (cancha %.0f x %.0f m)" % (2 * HLA, 2 * HLB))

clipped = 0
bcount, bnames = 0, []
from shapely.geometry import Point as _Pt2
for kind, polys in ((0, ms_polys), (1, osm_polys), (2, [b[2] for b in work_buildings])):
  for oi, orig in enumerate(polys):
    if (kind == 0 and excl_polys) or (kind == 1 and not osm_names[oi] and excl_osm):
        cxp = sum(p[0] for p in orig) / len(orig); cyp = sum(p[1] for p in orig) / len(orig)
        if any(ex.contains(_Pt2(cxp, cyp)) for ex in (excl_polys if kind == 0 else excl_osm)):
            continue  # en la manzana especial mandan los edificios dibujados a mano
    parts = clip_building(orig)
    kcode = kind if kind < 2 else work_buildings[oi][0]
    clipped += len(parts) != 1
    floors = None
    for pts in parts:
        if pts[0] == pts[-1]:
            pts = pts[:-1]
        q = [(round((x + 0.5) * TS_PX), round((y + 0.5) * TS_PX)) for x, y in pts]
        dedup = [q[0]] + [b for a, b in zip(q, q[1:]) if a != b]
        if len(dedup) < 3:
            continue
        xs = [p[0] for p in dedup]; ys = [p[1] for p in dedup]
        if max(xs) < 0 or max(ys) < 0 or min(xs) > W * TS_PX or min(ys) > H * TS_PX:
            continue
        area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(dedup, dedup[1:] + dedup[:1]))) / 2 * (TILE_M / TS_PX) ** 2
        centro = max(0.0, 1 - math.hypot(sum(xs) / len(xs) / TS_PX - sx0, sum(ys) / len(ys) / TS_PX - sy0) * TILE_M / 1600)
        if floors is None:
            if kind == 2:
                floors = work_buildings[oi][1]
            elif kind == 1 and osm_levels[oi]:
                floors = osm_levels[oi]
            else:
                floors = real_floors(pts)
            if floors is None:
                h = rnd.random()
                floors = 1 + int(h * 2) if area < 250 else 2 + int(h * (3 + 10 * centro * centro))
            floors = min(floors, 34)
        nm = osm_names[oi] if kind == 1 else (work_buildings[oi][3] if kind == 2 and len(work_buildings[oi]) > 3 else "")
        if nm:
            if nm not in name_idx:
                name_idx[nm] = len(names); names.append(nm)
            bnames += [bcount, name_idx[nm]]
        bcount += 1
        bflat += [kcode, floors, len(dedup), dedup[0][0], dedup[0][1]]
        for a, b in zip(dedup, dedup[1:]):
            bflat += [b[0] - a[0], b[1] - a[1]]

# Semáforos y direcciones (para los carteles con numeración)
signals, addresses = [], []
if EXTRA.exists():
    ex = json.loads(EXTRA.read_text(encoding="utf8"))
    for lat, lon in ex["signals"]:
        x, y = proj(lat, lon)
        if 0 <= x < W and 0 <= y < H:
            signals += [round(x, 2), round(y, 2)]
    for lat, lon, street, num in ex["addresses"]:
        x, y = proj(lat, lon)
        if not (0 <= x < W and 0 <= y < H):
            continue
        if street not in name_idx:
            name_idx[street] = len(names); names.append(street)
        addresses += [round(x, 1), round(y, 1), name_idx[street], num]

# Recorridos de colectivos (data/colectivos.txt) convertidos a caminos sobre la red de calles
sys.path.insert(0, str(ROOT / "tools"))
import routes as _routes
bus_routes = []
_bt = ROOT / "data" / "colectivos.txt"
if _bt.exists():
    for r in _routes.build(_routes.parse(_bt.read_text(encoding="utf8")), node_xy, edges, names):
        if len(r["edges"]) >= 6:
            bus_routes.append({"line": r["line"], "ramal": r["ramal"], "dir": r["dir"], "edges": r["edges"]})
    print("recorridos de colectivos:", len(bus_routes), [f'{r["line"]}{r["ramal"]}-{r["dir"][0]}' for r in bus_routes])

# RLE (valor, largo<=255) + base64
flat = grid.flatten()
change = np.flatnonzero(np.diff(flat)) + 1
starts = np.concatenate(([0], change)); ends = np.concatenate((change, [flat.size]))
rle = bytearray()
for s0, e0 in zip(starts, ends):
    v = int(flat[s0]); n = int(e0 - s0)
    while n > 0:
        k = min(n, 255); rle += bytes((v, k)); n -= k

OUT.parent.mkdir(exist_ok=True)
data = {
    "w": W, "h": H, "tileMeters": TILE_M, "bbox": BBOX,
    "tiles": base64.b64encode(bytes(rle)).decode(),
    "nodes": [c for xy in node_xy for c in xy],
    "edges": [v for e in edges for v in e],
    "names": names, "spawn": [round(spawn[0], 1), round(spawn[1], 1)], "places": places, "paths": paths, "buildings": bflat, "bnames": bnames, "bridges": bridges, "routes": bus_routes,
    "signals": signals, "addresses": addresses, "props": work_props,
    "attribution": "Mapa © OpenStreetMap contributors (ODbL)",
}
OUT.write_text("// Generado por tools/build_map.py — Datos © OpenStreetMap contributors (ODbL)\n"
               "window.MAPDATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
               encoding="utf8")

PAL = np.array([[70, 60, 75], [60, 60, 68], [150, 150, 150], [70, 140, 60], [40, 90, 170], [220, 200, 140],
                [170, 100, 80], [110, 100, 90], [180, 90, 70], [90, 90, 100], [190, 170, 120], [86, 112, 72], [40, 90, 170], [70, 150, 70], [140, 116, 84]], dtype=np.uint8)
Image.fromarray(PAL[grid]).save(PREVIEW)
print(f"mapa {W}x{H} tiles ({W*TILE_M/1000:.1f} x {H*TILE_M/1000:.1f} km), rle {len(rle)} bytes, "
      f"nodos {len(node_xy)}, aristas {len(edges)}, spawn {spawn}, lugares {len(places)}")
print("edificios:", len(osm_polys), "OSM +", len(ms_polys), "satélite; recortados por calles:", clipped)
print("map.js:", OUT.stat().st_size, "bytes")
