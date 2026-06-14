#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Motor de video del Estudio — El Maravilloso.
Toma una foto de producto (idealmente con fondo recortado), nombre y precio,
y genera un video vertical 1080x1920 (TikTok / Reels) con movimiento:
zoom suave del producto, precio que aparece con "pop", colores de marca.

Uso:
  python make_video.py --product ruta.png --name "MILO BOLSA 1 KG" \
                       --price 7190 --out salida.mp4 [--tag "OFERTA DE LA SEMANA"]
"""
import argparse, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import templates as T

# ---- Marca ----
RED      = (237, 28, 36)
RED_DARK = (176, 16, 24)
RED_HI   = (242, 70, 78)
BLUE     = (0, 102, 179)
WHITE    = (255, 255, 255)
YELLOW   = (255, 214, 10)
CREAM    = (245, 242, 236)
INK      = (28, 28, 30)
W, H, FPS = 1080, 1920, 30

FONTS = "C:/Windows/Fonts/"
def font(name, size):
    names = name if isinstance(name, (list, tuple)) else [name]
    for n in list(names) + ["arialbd.ttf", "arial.ttf"]:
        p = os.path.join(FONTS, n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def f_impact(s): return font("impact.ttf", s)
def f_bold(s):   return font("arialbd.ttf", s)
def f_cond(s):   return font(["bahnschrift.ttf", "ariblk.ttf"], s)

def fmt_price(p):
    return "$" + format(int(p), ",d").replace(",", ".")

# ---- easings ----
def clamp01(x): return max(0.0, min(1.0, x))
def ease_out(x): return 1 - (1 - x) ** 3
def ease_out_back(x):
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2

def text_img(txt, fnt, fill, stroke=0, stroke_fill=(0, 0, 0)):
    """Renderiza texto a su propia imagen RGBA ajustada."""
    tmp = Image.new("RGBA", (10, 10))
    d = ImageDraw.Draw(tmp)
    bb = d.textbbox((0, 0), txt, font=fnt, stroke_width=stroke)
    w, h = bb[2] - bb[0] + 8, bb[3] - bb[1] + 8
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((4 - bb[0], 4 - bb[1]), txt, font=fnt, fill=fill,
                            stroke_width=stroke, stroke_fill=stroke_fill)
    return im

def set_alpha(im, a):
    if a >= 1.0: return im
    r, g, b, al = im.split()
    al = al.point(lambda v: int(v * clamp01(a)))
    return Image.merge("RGBA", (r, g, b, al))

def paste_center(base, im, cx, cy, scale=1.0, alpha=1.0):
    if scale <= 0 or alpha <= 0: return
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))),
                       Image.LANCZOS)
    im = set_alpha(im, alpha)
    base.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))

def make_background():
    """Rojo de marca con degradado radial + rayos suaves (energía retail)."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W / 2, H * 0.42
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (W * 0.85)
    d = np.clip(d, 0, 1)
    bg = np.zeros((H, W, 3), np.float32)
    for i, (hi, lo) in enumerate(zip(RED_HI, RED_DARK)):
        bg[..., i] = hi * (1 - d) + lo * d
    base = Image.fromarray(bg.astype(np.uint8), "RGB").convert("RGBA")
    # rayos sunburst tenues
    rays = Image.new("L", (W, H), 0)
    rd = ImageDraw.Draw(rays)
    n = 24
    for k in range(n):
        a0 = (k / n) * 2 * math.pi
        if k % 2: continue
        pts = [(cx, cy)]
        for da in (-0.13, 0.13):
            pts.append((cx + math.cos(a0 + da) * 1600, cy + math.sin(a0 + da) * 1600))
        rd.polygon(pts, fill=26)
    rays = rays.filter(ImageFilter.GaussianBlur(6))
    glow = Image.new("RGBA", (W, H), RED_HI + (0,))
    glow.putalpha(rays)
    base.alpha_composite(glow)
    return base

def starburst(size, color, spikes=16):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    pts = []
    for i in range(spikes * 2):
        ang = (i / (spikes * 2)) * 2 * math.pi
        r = c * (1.0 if i % 2 == 0 else 0.74)
        pts.append((c + math.cos(ang) * r, c + math.sin(ang) * r))
    d.polygon(pts, fill=color + (255,))
    return im

def build(args):
    bg = make_background()
    # producto
    prod = Image.open(args.product).convert("RGBA")
    maxw, maxh = int(W * 0.72), int(H * 0.34)
    sc = min(maxw / prod.width, maxh / prod.height)
    prod = prod.resize((int(prod.width * sc), int(prod.height * sc)), Image.LANCZOS)
    # sombra del producto
    shadow = Image.new("RGBA", prod.size, (0, 0, 0, 0))
    shadow.putalpha(prod.split()[3].point(lambda v: int(v * 0.45)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))

    # capas de texto
    tag_im   = text_img(args.tag.upper(), f_impact(74), WHITE, 3, RED_DARK)
    name_im  = text_img(args.name.upper(), f_bold(62), WHITE, 2, RED_DARK)
    price_im = text_img(fmt_price(args.price), f_impact(240), RED, 0)
    burst    = starburst(600, YELLOW)
    foot1_im = text_img("DISTRIBUIDORA EL MARAVILLOSO", f_bold(40), WHITE)
    foot2_im = text_img("HUALPEN  ·  PUBLICO Y NEGOCIOS  ·  DESPACHO", f_bold(34), YELLOW)

    dur = args.seconds
    nframes = int(dur * FPS)
    ff = imageio_writer(args.out)
    cx = W / 2
    for fi in range(nframes):
        t = fi / FPS
        frame = bg.copy()

        # --- tag superior (entra desde arriba) ---
        a = ease_out(clamp01(t / 0.6))
        ty = 230 + (1 - a) * -80
        paste_center(frame, tag_im, cx, ty, 1.0, a)

        # --- producto: fade + zoom Ken Burns + float ---
        ap = ease_out(clamp01((t - 0.3) / 0.7))
        zoom = 1.0 + 0.10 * ease_out(clamp01(t / dur))
        floaty = math.sin(t * 1.6) * 14
        pcy = H * 0.40 + floaty
        paste_center(frame, shadow, cx + 10, pcy + prod.height * 0.42 * zoom + 18,
                     zoom, ap * 0.8)
        paste_center(frame, prod, cx, pcy, zoom, ap)

        # --- nombre ---
        an = ease_out(clamp01((t - 1.0) / 0.5))
        paste_center(frame, name_im, cx, H * 0.605, 1.0, an)

        # --- precio con starburst (pop overshoot ~1.8s) ---
        if t >= 1.7:
            pr = clamp01((t - 1.7) / 0.5)
            psc = ease_out_back(pr)
            pulse = 1 + 0.03 * math.sin((t - 2.2) * 3.2) if t > 2.2 else 1
            pcy2 = H * 0.82
            paste_center(frame, burst, cx, pcy2, psc * (1 + 0.02 * math.sin(t * 1.5)),
                         clamp01(pr * 1.2))
            paste_center(frame, price_im, cx, pcy2, psc * pulse, clamp01(pr * 1.3))

        # --- footer ---
        aft = ease_out(clamp01((t - 0.8) / 0.6))
        paste_center(frame, foot1_im, cx, H - 150, 1.0, aft)
        paste_center(frame, foot2_im, cx, H - 96, 1.0, aft)

        ff.append_data(np.asarray(frame.convert("RGB")))
    ff.close()
    print("OK ->", args.out, f"({nframes} frames, {dur}s)")

def build_premium(args):
    """Estilo Premium animado: fondo claro, look catalogo, movimiento sutil/elegante."""
    cx = W / 2
    base = Image.new("RGBA", (W, H), CREAM + (255,))
    bd = ImageDraw.Draw(base)
    bd.rectangle([0, 0, W, 150], fill=RED)
    bd.rectangle([0, H - 150, W, H], fill=RED)

    lg = T.logo(330)
    pill = Image.new("RGBA", (300, 72), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    pd.rounded_rectangle([0, 0, 299, 71], radius=36, fill=RED)
    pd.text((150, 36), args.tag.upper(), font=f_cond(46), fill=WHITE, anchor="mm")

    prod = Image.open(args.product).convert("RGBA")
    sc = min((W * 0.72) / prod.width, (H * 0.40) / prod.height)
    prod = prod.resize((int(prod.width * sc), int(prod.height * sc)), Image.LANCZOS)
    shadow = Image.new("RGBA", prod.size, (0, 0, 0, 0))
    shadow.putalpha(prod.split()[3].point(lambda v: int(v * 0.30)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))

    name_im  = text_img(args.name.upper(), f_cond(70), INK)
    price_im = text_img(fmt_price(args.price), f_impact(220), RED)
    foot_im  = text_img("HUALPEN  ·  PUBLICO Y NEGOCIOS  ·  DESPACHO", f_bold(34), WHITE)

    dur = args.seconds
    nframes = int(dur * FPS)
    ff = imageio_writer(args.out)
    for fi in range(nframes):
        t = fi / FPS
        frame = base.copy()
        paste_center(frame, lg, cx, 76, 1.0, ease_out(clamp01(t / 0.6)))
        paste_center(frame, pill, cx, 300, 1.0, ease_out(clamp01((t - 0.3) / 0.6)))

        apr = ease_out(clamp01((t - 0.3) / 0.7))
        zoom = 1.0 + 0.08 * ease_out(clamp01(t / dur))
        pcy = H * 0.45 + math.sin(t * 1.5) * 12
        paste_center(frame, shadow, cx + 8, pcy + prod.height * 0.46 * zoom + 14, zoom, apr * 0.7)
        paste_center(frame, prod, cx, pcy, zoom, apr)

        an = ease_out(clamp01((t - 1.0) / 0.6))
        paste_center(frame, name_im, cx, H * 0.70 + (1 - an) * 30, 1.0, an)

        lw = int(300 * ease_out(clamp01((t - 1.3) / 0.5)))
        if lw > 4:
            ImageDraw.Draw(frame).line([(cx - lw / 2, H * 0.735), (cx + lw / 2, H * 0.735)],
                                       fill=RED, width=6)
        if t >= 1.8:
            pr = clamp01((t - 1.8) / 0.5)
            paste_center(frame, price_im, cx, H * 0.80, 0.6 + 0.4 * ease_out_back(pr),
                         clamp01(pr * 1.3))

        paste_center(frame, foot_im, cx, H - 76, 1.0, 1.0)
        ff.append_data(np.asarray(frame.convert("RGB")))
    ff.close()
    print("OK ->", args.out, f"(premium, {nframes} frames, {dur}s)")

def imageio_writer(out):
    import imageio
    return imageio.get_writer(out, fps=FPS, codec="libx264", quality=8,
                              macro_block_size=8, pixelformat="yuv420p")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--price", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tag", default="OFERTA DE LA SEMANA")
    ap.add_argument("--seconds", type=float, default=6.0)
    ap.add_argument("--style", default="premium", choices=["clasica", "premium"])
    args = ap.parse_args()
    if args.style == "premium":
        if args.tag == "OFERTA DE LA SEMANA":
            args.tag = "OFERTA"
        build_premium(args)
    else:
        build(args)
