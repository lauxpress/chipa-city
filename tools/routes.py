"""Convierte los recorridos de data/colectivos.txt en caminos sobre la red de calles del mapa.

Cada recorrido es una lista de calles en orden. Se buscan las esquinas donde se cruza cada calle con la siguiente
y se unen con el camino más corto de la red, prefiriendo ir por la calle del recorrido. Las calles que quedan fuera
del área del juego se saltean. Lo usa tools/build_map.py.
"""
import difflib, heapq, math, re, unicodedata

STOP = {"av", "avenida", "gdor", "gobernador", "tte", "teniente", "dr", "doctor", "sargento", "sgto", "pje", "pasaje",
        "gral", "general", "calle", "de", "del", "la", "el", "los", "las", "y", "bo", "b", "pres", "presidente"}


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\(.*?\)", " ", s)
    return [t for t in re.findall(r"[a-z0-9]+", s)]


def toks(s):
    t = norm(s)
    k = [x for x in t if x not in STOP]
    return k or t


def match_name(route_name, osm_names):
    """Nombre de OSM que mejor corresponde a una calle del recorrido (o None)."""
    rt = toks(route_name)
    best, bs = None, 0.0
    for nm in osm_names:
        ot = toks(nm)
        if not ot:
            continue
        score = 0.0
        for a in rt:
            sc = max((difflib.SequenceMatcher(None, a, b).ratio() if len(a) > 1 else (1.0 if b.startswith(a) else 0)) for b in ot)
            score += sc
        score /= len(rt)
        score -= 0.04 * max(0, len(ot) - len(rt))  # penaliza nombres con muchas palabras de más
        if score > bs:
            best, bs = nm, score
    return best if bs >= 0.82 else None


def parse(text):
    routes, cur = [], None
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"L[IÍ]NEA\s+(\d+),\s*RAMAL\s*\W*([A-Z])", line, re.I)
        if m:
            cur = {"line": m.group(1), "ramal": m.group(2).upper()}
            continue
        m = re.match(r"(IDA|REGRESO):\s*(.*)", line, re.I)
        if m and cur:
            streets = [s.strip(" .") for s in m.group(2).split(" - ")]
            streets = [re.split(r"\s+y\s+", s)[0] for s in streets if s]
            routes.append({**cur, "dir": m.group(1).upper(), "streets": streets})
    return routes


def build(routes, node_xy, edges, names):
    """edges: lista de (A, B, flags, name_idx) con aristas dirigidas. Devuelve índices de aristas por recorrido."""
    osm = sorted({names[ni] for (a, b, f, ni) in edges if (f & 1) and names[ni]})  # solo calles transitables
    out_edges = {}
    by_name_nodes = {}
    for i, (a, b, f, ni) in enumerate(edges):
        if not (f & 1):
            continue
        out_edges.setdefault(a, []).append(i)
        by_name_nodes.setdefault(names[ni], set()).update((a, b))

    def dist(a, b):
        return math.hypot(node_xy[a][0] - node_xy[b][0], node_xy[a][1] - node_xy[b][1])

    def path(s, t, prefer):
        best = {s: 0.0}; prev = {}
        pq = [(0.0, s)]
        while pq:
            d, u = heapq.heappop(pq)
            if u == t:
                break
            if d > best.get(u, 1e18):
                continue
            for e in out_edges.get(u, []):
                a, b, f, ni = edges[e]
                w = dist(a, b) * (1.0 if names[ni] in prefer else 2.5)
                nd = d + w
                if nd < best.get(b, 1e18):
                    best[b] = nd; prev[b] = e; heapq.heappush(pq, (nd, b))
        if t not in prev and s != t:
            return None
        seq, u = [], t
        while u != s:
            e = prev[u]; seq.append(e); u = edges[e][0]
        return seq[::-1]

    result = []
    for r in routes:
        matched = [match_name(s, osm) for s in r["streets"]]
        seq = [m for m in matched if m]
        # esquinas entre calles consecutivas del recorrido (que existan en el mapa)
        joints, last = [], None
        for a, b in zip(seq, seq[1:]):
            if a == b:
                continue
            common = by_name_nodes.get(a, set()) & by_name_nodes.get(b, set())
            if not common:
                continue
            if last is None:
                j = min(common)
            else:
                j = min(common, key=lambda n: dist(n, last))
            joints.append((j, a, b)); last = j
        edges_seq = []
        for (j1, a1, b1), (j2, a2, b2) in zip(joints, joints[1:]):
            if j1 == j2:
                continue
            p = path(j1, j2, {b1, a2})
            if p is None or sum(dist(edges[e][0], edges[e][1]) for e in p) > 5 * dist(j1, j2) + 60:
                continue
            edges_seq += p
        result.append({"line": r["line"], "ramal": r["ramal"], "dir": r["dir"], "edges": edges_seq,
                       "matched": sum(1 for m in matched if m), "total": len(matched)})
    return result
