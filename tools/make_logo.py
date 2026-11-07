"""Genera el logo de CHIPA CITY en pixel art (diseño original).

- Letras de bloque propias, con los colores dorados de un chipa recién horneado.
- La "A" de CHIPA es la torre en A del Puente General Belgrano, con sus tensores y el tablero.
- El punto sobre la "I" de CITY es un chipa.
Salidas: game/logo.svg (para el juego), game/logo.png (para el README) y game/icon.png (ícono de la pestaña).
"""
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAME = ROOT / "game"

F = {  # letras de 6x8 (la A es especial)
    "C": [".####.", "##..##", "##....", "##....", "##....", "##....", "##..##", ".####."],
    "H": ["##..##", "##..##", "##..##", "######", "######", "##..##", "##..##", "##..##"],
    "I": ["######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##..", "######"],
    "P": ["#####.", "##..##", "##..##", "##..##", "#####.", "##....", "##....", "##...."],
    "A": ["...#...", "..###..", "..#.#..", ".##.##.", ".#####.", "##...##", "##...##", "#.....#"],
    "T": ["######", "######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##.."],
    "Y": ["##..##", "##..##", "##..##", ".####.", "..##..", "..##..", "..##..", "..##.."],
    "i": ["..##..", "..##..", "..##..", "..##..", "..##..", "..##..", "..##..", "..##.."],  # I sin barras: lleva el chipa
}

W, H = 112, 62  # grilla del logo en "píxeles gordos"
px = {}  # (x, y) -> color


def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        px[(x, y)] = c


def word(text, x0, y0, scale, colors, gap):
    cells = []
    x = x0
    for ch in text:
        g = F[ch]
        for r, row in enumerate(g):
            for c, v in enumerate(row):
                if v == "#":
                    for dy in range(scale):
                        for dx in range(scale):
                            cells.append((x + c * scale + dx, y0 + r * scale + dy, colors[min(len(colors) - 1, (r * scale + dy) * len(colors) // (8 * scale))]))
        x += len(g[0]) * scale + gap
    return cells, x - gap


# --- fondo: el río y el tablero del puente que pasa por la A
top, tw = word("CHIPA", 0, 0, 2, ["#fff2a8"], 2)
total = tw
x0 = (W - total) // 2
TOPY = 10
chipa, xend = word("CHIPA", x0, TOPY, 2, ["#fff2a8", "#ffe070", "#ffc83a", "#f2a72a", "#d9861c", "#b8661a"], 2)
# posición de la A (última letra)
a_x = xend - 7 * 2 + 1
a_apex = (a_x + 6, 1)   # la torre sobresale arriba de la palabra
deck_y = TOPY + 4 * 2 + 1  # fila de la barra de la A = el tablero
# tensores: del vértice de la A al tablero, en abanico a los dos lados
cables = []
# patas de la torre por encima de la letra
for t in range(0, TOPY + 1):
    for sgn in (1, -1):
        cables.append((round(a_apex[0] + sgn * t * 6 / TOPY), a_apex[1] + t))
for k in range(1, 8):
    for sgn in (1, -1):
        ex, ey = a_apex[0] + sgn * (5 + k * 6), deck_y
        n = max(abs(ex - a_apex[0]), abs(ey - a_apex[1]))
        for i in range(n + 1):
            cables.append((round(a_apex[0] + (ex - a_apex[0]) * i / n), round(a_apex[1] + (ey - a_apex[1]) * i / n)))
deck = [(x, y) for x in range(2, W - 2) for y in (deck_y, deck_y + 1)]

CY = 36
city, cend = word("CiTY", 0, 0, 2, ["#fff"], 5)
cx0 = (W - cend) // 2 + 1
city, cend = word("CiTY", cx0, CY, 2, ["#ffd0e4", "#ff9cc8", "#f06aa8", "#d84a8c", "#b83074"], 5)
# el chipa como punto de la i (segunda letra)
i_cx = cx0 + 6 * 2 + 5 + 6
chip = []
for y in range(-4, 5):
    for x in range(-5, 6):
        if (x / 5.4) ** 2 + (y / 4.4) ** 2 <= 1:
            chip.append((i_cx + x, CY - 6 + y))

# --- capas: sombra, contorno, relleno
shadow, outline = "#1a0e08", "#4a2410"
fill_layers = []
for (x, y) in deck:
    put(x, y, "#9aa0a8")
for (x, y) in cables:
    put(x, y, "#e8eef4")
solid = {(x, y) for x, y, _ in chipa} | {(x, y) for x, y, _ in city} | set(chip)
for (x, y) in solid:  # sombra desplazada
    put(x + 2, y + 2, shadow)
for (x, y) in solid:  # contorno de 1 píxel
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if (x + dx, y + dy) not in solid:
                put(x + dx, y + dy, outline)
for x, y, c in chipa + city:
    put(x, y, c)
# el chipa: dorado con la costra resquebrajada y brillo
for (x, y) in chip:
    put(x, y, "#e8a838")
CC = CY - 6
for (x, y) in [(i_cx - 2, CC - 3), (i_cx - 3, CC - 2), (i_cx - 1, CC - 2), (i_cx + 1, CC - 3), (i_cx + 2, CC - 2), (i_cx, CC), (i_cx + 3, CC), (i_cx - 3, CC + 1),
               (i_cx - 1, CC + 2), (i_cx + 2, CC + 2)]:
    put(x, y, "#a8601c")
for (x, y) in [(i_cx - 3, CC - 3), (i_cx - 2, CC - 4), (i_cx - 4, CC - 2), (i_cx - 1, CC - 4)]:
    put(x, y, "#fff2b0")
# subrayado tipo ruta: franja con "CORRIENTES"
SUB = {  # mini letras 3x5
    "C": ["###", "#..", "#..", "#..", "###"], "O": ["###", "#.#", "#.#", "#.#", "###"], "R": ["##.", "#.#", "##.", "#.#", "#.#"],
    "I": ["#", "#", "#", "#", "#"], "E": ["###", "#..", "##.", "#..", "###"], "N": ["#..#", "##.#", "#.##", "#..#", "#..#"],
    "T": ["###", ".#.", ".#.", ".#.", ".#."], "S": ["###", "#..", "###", "..#", "###"], " ": ["."],
}
label = "CORRIENTES"
lw = sum(len(SUB[ch][0]) + 1 for ch in label) - 1
lx, ly = (W - lw) // 2, 55
for x in range(lx - 3, lx + lw + 3):
    for y in range(ly - 2, ly + 6):
        put(x, y, "#1f7a4c")
for x in range(lx - 3, lx + lw + 3):
    put(x, ly - 2, "#f4f4f0"); put(x, ly + 5, "#f4f4f0")
x = lx
for ch in label:
    g = SUB[ch]
    for r, row in enumerate(g):
        for c, v in enumerate(row):
            if v == "#":
                put(x + c, ly + r, "#f4f4f0")
    x += len(g[0]) + 1

# --- salida SVG (rectángulos nítidos) y PNG
rects = "".join(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{c}"/>' for (x, y), c in sorted(px.items()))
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W * 8}" height="{H * 8}" shape-rendering="crispEdges">'
       f'<title>CHIPA CITY</title>{rects}</svg>')
(GAME / "logo.svg").write_text(svg, encoding="utf8")
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
for (x, y), c in px.items():
    img.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
img.resize((W * 8, H * 8), Image.NEAREST).save(GAME / "logo.png")
# ícono: el chipa solo
ico = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
for (x, y) in chip:
    ico.putpixel((x - i_cx + 8, y - (CY - 6) + 8), (232, 168, 56, 255))
for (x, y) in [(5, 5), (4, 6), (6, 6), (9, 5), (10, 6), (8, 8), (11, 8), (5, 9), (7, 10), (10, 10)]:
    ico.putpixel((x, y), (168, 96, 28, 255))
ico.resize((64, 64), Image.NEAREST).save(GAME / "icon.png")
print("logo:", W, "x", H, "píxeles,", len(px), "celdas ->", GAME / "logo.svg")
