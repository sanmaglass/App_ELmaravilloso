# -*- coding: utf-8 -*-
"""Generador de SHOWCASE: renderiza TODOS los estilos en todas sus modalidades
(formato feed/story, normal/descuento, amigable 1-2-3 productos) en un solo tablero.
Uso:  python tools/showcase.py            -> content/_previews/SHOWCASE.png
Pensado para QA visual rápido cada vez que se cambia el diseño."""
import sys, os, glob
sys.path.insert(0, os.path.dirname(__file__))
import templates as T
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # marketing/
def A(p): return os.path.join(HERE, p)

# 2 productos de prueba (formas distintas dentro del cuadro)
cuts = [c for c in glob.glob(A("assets/_cuts/*.png"))]
P1 = next((c for c in cuts if "milo" not in c.lower()), cuts[0]) if cuts else A("assets/milo-1kg-cut.png")
P2 = A("assets/milo-1kg-cut.png")

TH_W = 250  # ancho de cada miniatura story
def th(im, w=TH_W):
    im = im.convert("RGB"); im.thumbnail((w, w*2)); return im

def label_row(title):
    return ("__TITLE__", title)

# Construye filas: cada fila = (titulo, [ (etiqueta, PIL) ... ])
rows = []

# --- Fila 1+2: familia PREMIUM en STORY, 2 productos ---
prem = [("premium", T.style_premium), ("dark", T.premium_dark),
        ("giant", T.premium_giant), ("split", T.premium_split)]
promo = [("clasica", T.style_clasica), ("descuento", T.style_descuento)]

def render_story(fn, name, price, prod, **kw):
    try: return fn(name, price, prod, fmt="story", **kw)
    except TypeError: return fn(name, price, prod, **kw)

def render_feed(fn, name, price, prod):
    try: return fn(name, price, prod, fmt="feed")
    except TypeError: return fn(name, price, prod)

rows.append(("PREMIUM FAMILY · STORY 9:16 · producto A",
             [(nm, th(render_story(fn, "NESCAFE 400G", 11990, P1))) for nm, fn in prem]
             + [(nm, th(render_story(fn, "NESCAFE 400G", 11990, P1))) for nm, fn in promo]))

rows.append(("PROMO + premium · STORY · producto B (Milo)",
             [(nm, th(render_story(fn, "MILO 1KG", 6990, P2))) for nm, fn in prem]
             + [(nm, th(render_story(fn, "MILO 1KG", 6990, P2))) for nm, fn in promo]))

# --- Fila 3: FEED 1:1 (los 4 premium) ---
rows.append(("PREMIUM FAMILY · FEED 1:1 (Instagram foto cuadrada)",
             [(nm, th(render_feed(fn, "NESCAFE 400G", 11990, P1), TH_W)) for nm, fn in prem]))

# --- Fila 4: variante DESCUENTO (precio anterior -> badge %) ---
disc = []
for nm, fn in prem:
    try:
        im = fn("NESCAFE 400G", 8990, P1, price_old=12990, fmt="story")
        disc.append((nm+" -31%", th(im)))
    except TypeError:
        pass
disc.append(("descuento", th(render_story(T.style_descuento, "NESCAFE 400G", 8990, P1, price_old=12990))))
rows.append(("VARIANTE DESCUENTO (precio normal tachado + % ahorro)", disc))

# --- Fila ESCENA (lifestyle) en 3 moods, story + feed ---
import templates as _T
esc = [("escena calido", _T.style_escena), ("escena rojo", _T.escena_rojo), ("escena limpio", _T.escena_limpio)]
rows.append(("ESCENA / LIFESTYLE · STORY (calido · rojo · limpio) + FEED",
             [(nm, th(fn("NESCAFE 400G", 11990, P1, fmt="story"))) for nm, fn in esc]
             + [("escena FEED", th(_T.style_escena("NESCAFE 400G", 11990, P1, fmt="feed"), TH_W))]))

# --- Fila 5: AMIGABLE 1 / 2 / 3 productos (story) ---
def amig(n, headline):
    items = [{"path": P2, "price": 6990, "gram": "1 kg"},
             {"path": P1, "price": 11990, "gram": "400 g"},
             {"path": P2, "price": 1290, "gram": "200 g"}][:n]
    return T.style_amigable("Combo", 0, items, pal="marca", headline=headline, fmt2="story")
rows.append(("AMIGABLE multi-producto · STORY (1 / 2 / 3 productos)",
             [("amigable x1", th(amig(1, "PRECIAZO"))),
              ("amigable x2", th(amig(2, "OFERTON"))),
              ("amigable x3", th(amig(3, "IMPERDIBLE")))]))

# ---- Componer tablero ----
PAD = 10; TITLE_H = 30; LBL_H = 18
def row_height(items):
    return TITLE_H + LBL_H + max((im.height for _, im in items), default=0) + PAD*2

board_w = max(PAD + sum(im.width + PAD for _, im in items) for _, items in rows) + PAD
board_h = sum(row_height(items) for _, items in rows)
board = Image.new("RGB", (board_w, board_h), (28, 28, 32))
d = ImageDraw.Draw(board)
y = 0
for title, items in rows:
    d.rectangle([0, y, board_w, y+TITLE_H], fill=(150, 18, 24))
    d.text((PAD, y+7), title, fill=(255, 255, 255))
    yy = y + TITLE_H + LBL_H
    x = PAD
    for lbl, im in items:
        d.text((x, y+TITLE_H+2), lbl, fill=(255, 220, 60))
        board.paste(im, (x, yy))
        x += im.width + PAD
    y += row_height(items)

out = A("content/_previews/SHOWCASE.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
board.save(out)
print("SHOWCASE ->", out, board.size)
