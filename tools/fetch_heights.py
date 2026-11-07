"""Alturas reales de edificios: Google Open Buildings 2.5D Temporal (año 2023).

Lee por HTTP solo la ventana del mapa del juego (no baja el archivo de 700 MB entero) y la remuestrea
a la grilla de tiles del juego. Licencia de los datos: CC BY 4.0 / ODbL.
https://sites.research.google/gr/open-buildings/temporal/

Salida: data/heights.npy  (float32, metros, tamaño H x W de la grilla; 0 = sin edificio)
Requiere: pip install rasterio
"""
import math, pathlib
import numpy as np
import rasterio
from rasterio.windows import from_bounds

ROOT = pathlib.Path(__file__).resolve().parent.parent
BBOX = (-27.4850, -58.8720, -27.4520, -58.8150)  # sur, oeste, norte, este (igual que build_map.py)
TILE_M = 2.25  # igual que build_map.py
URL = "/vsicurl/https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/94454_2023_06_30/tile_NdttH0yYAGY.tif"
RES = 2.0  # metros por píxel de lectura (el dato efectivo es ~4 m)

S, W, N, E = BBOX
LAT0 = (S + N) / 2
MX = math.cos(math.radians(LAT0)) * 111320.0
MY = 110574.0
GW = int(round((E - W) * MX / TILE_M))
GH = int(round((N - S) * MY / TILE_M))


def utm21s(lat, lon):
    """Lat/lon (grados, arrays) -> UTM zona 21 sur (EPSG:32721)."""
    a = 6378137.0; f = 1 / 298.257223563; k0 = 0.9996; e2 = f * (2 - f); ep2 = e2 / (1 - e2)
    lon0 = math.radians(-57.0); phi = np.radians(lat); lam = np.radians(lon)
    Nn = a / np.sqrt(1 - e2 * np.sin(phi) ** 2); T = np.tan(phi) ** 2; C = ep2 * np.cos(phi) ** 2; A = np.cos(phi) * (lam - lon0)
    M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * np.sin(2 * phi)
             + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * np.sin(4 * phi) - (35 * e2 ** 3 / 3072) * np.sin(6 * phi))
    x = k0 * Nn * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000
    y = k0 * (M + Nn * np.tan(phi) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24
                                       + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720)) + 10000000
    return x, y


# centros de cada tile del juego en lat/lon -> UTM
tx, ty = np.meshgrid(np.arange(GW) + 0.5, np.arange(GH) + 0.5)
lon = W + tx * TILE_M / MX
lat = N - ty * TILE_M / MY
ux, uy = utm21s(lat, lon)
pad = 20
x0, x1, y0, y1 = ux.min() - pad, ux.max() + pad, uy.min() - pad, uy.max() + pad
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
    with rasterio.open(URL) as src:
        print("raster:", src.width, "x", src.height, src.res, src.crs, "overviews:", src.overviews(2))
        win = from_bounds(x0, y0, x1, y1, src.transform)
        ow, oh = int((x1 - x0) / RES), int((y1 - y0) / RES)
        h = src.read(2, window=win, out_shape=(oh, ow)).astype(np.float32)   # building_height
        pres = src.read(3, window=win, out_shape=(oh, ow)).astype(np.float32)  # building_presence
print("ventana leída:", h.shape)
h[(h < 0) | (pres < 0.5)] = 0
# muestreo: máximo de 2x2 píxeles alrededor de cada centro de tile
col = ((ux - x0) / RES).astype(int).clip(0, ow - 2)
row = ((y1 - uy) / RES).astype(int).clip(0, oh - 2)
grid = np.maximum.reduce([h[row, col], h[row + 1, col], h[row, col + 1], h[row + 1, col + 1]])
out = ROOT / "data" / "heights.npy"
np.save(out, grid.astype(np.float32))
nz = grid[grid > 0]
print(f"grilla {GW}x{GH}; tiles con edificio: {nz.size}; altura media {nz.mean():.1f} m; p95 {np.percentile(nz, 95):.1f} m; máx {nz.max():.1f} m")
