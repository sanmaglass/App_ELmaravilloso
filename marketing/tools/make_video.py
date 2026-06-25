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
import argparse, math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import templates as T
try:
    import audio as AU
except Exception:
    AU = None

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
FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
def font(name, size):
    """Busca en assets/fonts/ primero, luego Windows; NUNCA crashea."""
    names = name if isinstance(name, (list, tuple)) else [name]
    for n in names:
        for base in (FONTS_DIR, FONTS):
            p = n if os.path.isabs(n) else os.path.join(base, n)
            if os.path.exists(p):
                try: return ImageFont.truetype(p, size)
                except Exception: pass
    for n in ["arialbd.ttf", "arial.ttf"]:
        p = os.path.join(FONTS, n)
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()

def f_price(s):   return font(["Anton-Regular.ttf", "impact.ttf"], s)
def f_display(s): return font(["BebasNeue-Regular.ttf", "Anton-Regular.ttf", "impact.ttf"], s)
def f_name(s):    return font(["Montserrat-ExtraBold.ttf", "ariblk.ttf", "arialbd.ttf"], s)
def f_ui(s):      return font(["Montserrat-SemiBold.ttf", "arialbd.ttf"], s)
def f_strike(s):  return font(["Montserrat-Bold.ttf", "arialbd.ttf"], s)
# alias compatibles
def f_impact(s): return f_price(s)
def f_bold(s):   return f_ui(s)
def f_cond(s):   return f_display(s)

def fmt_price(p):
    return "$" + format(int(p), ",d").replace(",", ".")

# ---- easings ----
def clamp01(x): return max(0.0, min(1.0, x))
def ease_out(x): return 1 - (1 - x) ** 3
def ease_out_back(x):
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
def ease_out_quint(x): return 1 - (1 - x) ** 5
def ease_out_back_soft(x):
    c1, c3 = 1.10, 2.10
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
def ease_spring(x):
    """Rebote elástico suave: 0.55 -> ~1.12 -> 1.0."""
    if x <= 0: return 0.0
    if x >= 1: return 1.0
    return 1 - math.cos(x * math.pi * 1.5) * math.exp(-3.2 * x)
def lerp(a, b, t): return a + (b - a) * t
def seg(t, t0, t1):
    """Progreso 0..1 dentro del segmento [t0,t1]."""
    if t1 <= t0: return 1.0 if t >= t1 else 0.0
    return clamp01((t - t0) / (t1 - t0))

# ---- profundidad / luz ----
def drop_shadow_ellipse(w, op=0.30):
    """Sombra de contacto premium: halo difuso + núcleo oscuro concentrado bajo la base."""
    sw, sh = int(w * 0.62), int(w * 0.10); pad = 60
    cw, ch = sw + pad * 2, sh + pad * 2
    halo = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse([pad - 14, pad - 6, pad + sw - 1 + 14, pad + sh - 1 + 6],
                                 fill=(38, 28, 26, int(255 * op * 0.55)))
    halo = halo.filter(ImageFilter.GaussianBlur(26))
    core = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(core).ellipse([pad + int(sw * 0.16), pad + int(sh * 0.10),
                                  pad + int(sw * 0.84), pad + sh - 1 - int(sh * 0.10)],
                                 fill=(28, 20, 18, int(255 * op)))
    core = core.filter(ImageFilter.GaussianBlur(11))
    el = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    el.alpha_composite(halo); el.alpha_composite(core)
    return el

def shine_sweep(size, pos):
    """Banda de brillo diagonal; pos 0..1 la recorre de izq a der."""
    w, h = size
    sh = Image.new("L", (w, h), 0); d = ImageDraw.Draw(sh)
    x = int(lerp(-w * 0.4, w * 1.4, pos)); bw = int(w * 0.22)
    d.polygon([(x, 0), (x + bw, 0), (x + bw - h * 0.4, h), (x - h * 0.4, h)], fill=120)
    return sh.filter(ImageFilter.GaussianBlur(28))

def apply_shine(im, pos, strength=1.0):
    """Aplica brillo sobre las zonas opacas de im (RGBA)."""
    if pos < 0 or pos > 1: return im
    sh = shine_sweep(im.size, pos)
    mask = im.split()[3]
    sh = ImageChops.multiply(sh, mask)
    glow = Image.new("RGBA", im.size, (255, 255, 255, 0))
    glow.putalpha(sh.point(lambda v: int(v * 0.5 * strength)))
    out = im.copy(); out.alpha_composite(glow); return out

def brand_glow(cx, cy, r, color=(0, 102, 179), op=0.18):
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dd = np.clip(np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r, 0, 1)
    L = ((1 - dd) * 255 * op).astype(np.uint8)
    g.putalpha(Image.fromarray(L, "L"))
    g_rgb = Image.new("RGBA", (W, H), color + (0,)); g_rgb.putalpha(Image.fromarray(L, "L"))
    return g_rgb

def radial_vignette(op=0.16):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W / 2, H * 0.5
    dd = np.clip(np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (W * 0.85), 0, 1)
    L = (dd * 255 * op).astype(np.uint8)
    v = Image.new("RGBA", (W, H), (20, 12, 10, 0)); v.putalpha(Image.fromarray(L, "L"))
    return v

def radial_vignette_dark(op=0.30):
    """Viñeta más oscura para look dark."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W / 2, H * 0.5
    dd = np.clip(np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (W * 0.75), 0, 1)
    L = (dd * 255 * op).astype(np.uint8)
    v = Image.new("RGBA", (W, H), (8, 5, 4, 0)); v.putalpha(Image.fromarray(L, "L"))
    return v

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

def starburst(size, color, spikes=16, inner=0.74):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    pts = []
    for i in range(spikes * 2):
        ang = (i / (spikes * 2)) * 2 * math.pi
        r = c * (1.0 if i % 2 == 0 else inner)
        pts.append((c + math.cos(ang) * r, c + math.sin(ang) * r))
    d.polygon(pts, fill=color + (255,))
    return im

def _finalize(args, silent, beats):
    """Muxea audio sobre el MP4 mudo. Si falla o no se pide, deja el video válido."""
    if getattr(args, "audio", "on") == "off" or AU is None:
        if silent != args.out and os.path.exists(silent):
            os.replace(silent, args.out)
        print("  (sin audio)")
        return
    ok = AU.add_audio(silent, args.out, float(args.seconds), beats)
    print("  audio:", "OK (con sonido)" if ok else "mudo (fallback)")

def build(args):
    cb = getattr(args, "on_progress", None)
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
    silent = os.path.splitext(args.out)[0] + ".silent.mp4"
    ff = imageio_writer(silent)
    cx = W / 2
    for fi in range(nframes):
        t = fi / FPS
        frame = bg.copy()
        if cb and (fi % 5 == 0 or fi == nframes - 1):
            cb(int(fi / nframes * 100))

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
    beats = {"whoosh_tag": 0.30, "whoosh_prod": 0.45, "price": 1.70, "footer": dur - 0.5}
    _finalize(args, silent, beats)
    print("OK ->", args.out, f"({nframes} frames, {dur}s)")

GOLD = (198, 160, 92)
RED_INK = (92, 8, 14)
GREY_STRIKE = (154, 154, 154)
RED_DEEP = (138, 12, 20)
CREAM_HI = (250, 248, 243)
INK_SOFT = (90, 84, 78)

# ---------------------------------------------------------------------------
# _build_look: motor de animación premium unificado, con config por look
# ---------------------------------------------------------------------------
def _build_look(args, look="premium"):
    """
    Motor de animación premium para los 4 looks: premium, dark, giant, split.
    El timeline de animación es idéntico en todos; solo cambia la estética (fondo,
    colores, posiciones de producto/precio, filetes).
    """
    cb = getattr(args, "on_progress", None)
    cx = W / 2
    args.price = int(re.sub(r"[^0-9]", "", str(args.price)) or 0)
    price_old = getattr(args, "price_old", None)
    price_old = int(re.sub(r"[^0-9]", "", str(price_old)) or 0) if price_old else None
    if price_old == 0: price_old = None
    unit = getattr(args, "unit", "c/u")

    # ----------------------------------------------------------------
    # CONFIG POR LOOK — solo estética, no lógica
    # ----------------------------------------------------------------
    if look == "dark":
        # Fondo oscuro con halo radial cálido (replica premium_dark de templates.py)
        base = Image.new("RGBA", (W, H), (20, 17, 15, 255))
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        dd = np.clip(np.sqrt((xx - cx) ** 2 + (yy - H * 0.42) ** 2) / (W * 0.7), 0, 1)
        halo = Image.new("RGBA", (W, H), (60, 30, 28, 0))
        L_halo = Image.fromarray(((1 - dd) * 120).astype(np.uint8), "L")
        halo.putalpha(L_halo)
        base.alpha_composite(halo)
        # Barras RED_DEEP con filete GOLD
        bar = int(H * 0.078)
        ImageDraw.Draw(base).rectangle([0, 0, W, bar], fill=RED_DEEP)
        ImageDraw.Draw(base).rectangle([0, H - bar, W, H], fill=RED_DEEP)
        ImageDraw.Draw(base).rectangle([0, bar - 2, W, bar], fill=GOLD)
        ImageDraw.Draw(base).rectangle([0, H - bar, W, H - bar + 2], fill=GOLD)
        cfg = {
            "bar": bar,
            "name_color": CREAM_HI,
            "price_color": (255, 90, 96),
            "footer_color": CREAM_HI,
            "glow": brand_glow(cx, H * 0.44, W * 0.55, (80, 40, 30), 0.10),  # glow cálido tenue
            "vign": radial_vignette_dark(0.28),
            "prod_cy": H * 0.44,
            "prod_maxw": W * 0.72,
            "prod_maxh": H * 0.40,
            "name_y": H * 0.665,
            "price_y": int(H * 0.815),
            "filetes": "gold_only",    # un solo filete GOLD
            "logo_asset": "normal",    # usa logo.png (lockup transparente) como premium
        }
    elif look == "giant":
        # Fondo crema estándar, precio gigante en tercio inferior
        base = T.bg_cream(W, H)
        bar = int(H * 0.078)
        T.bar_red(base, 0, bar, "bottom")
        T.bar_red(base, H - bar, H, "top")
        cfg = {
            "bar": bar,
            "name_color": INK,
            "price_color": RED,
            "footer_color": CREAM_HI,
            "glow": brand_glow(cx, H * 0.44, W * 0.55, BLUE, 0.10),
            "vign": radial_vignette(0.14),
            "prod_cy": H * 0.30,       # producto más arriba
            "prod_maxw": W * 0.56,     # producto más chico
            "prod_maxh": H * 0.30,
            "name_y": H * 0.475,       # nombre en H*0.475
            "price_y": int(H * 0.72),  # precio gigante en tercio inferior
            "filetes": "none",
            "logo_asset": "normal",
        }
    elif look == "split":
        # Fondo crema + banda roja diagonal inferior
        base = T.bg_cream(W, H)
        bar = int(H * 0.078)
        T.bar_red(base, 0, bar, "bottom")
        # Banda diagonal inferior (replica premium_split de templates.py)
        split_band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(split_band).polygon(
            [(0, int(H * 0.62)), (W, int(H * 0.52)), (W, H), (0, H)],
            fill=RED + (255,)
        )
        ImageDraw.Draw(split_band).line(
            [(0, int(H * 0.62)), (W, int(H * 0.52))], fill=GOLD, width=4
        )
        base.alpha_composite(split_band)
        cfg = {
            "bar": bar,
            "name_color": CREAM_HI,     # nombre sobre rojo
            "price_color": CREAM_HI,    # precio sobre rojo en crema
            "footer_color": YELLOW,
            "glow": None,               # sin glow en split
            "vign": radial_vignette(0.12),
            "prod_cy": H * 0.40,        # producto centrado sobre la banda
            "prod_maxw": W * 0.66,
            "prod_maxh": H * 0.36,
            "name_y": H * 0.685,        # nombre sobre la banda roja
            "price_y": int(H * 0.84),   # precio sobre rojo
            "filetes": "none",
            "logo_asset": "normal",
            "logo_cx": W * 0.26,        # logo arriba-izquierda
            "logo_cy_factor": 0.07,     # cy relativo a H
        }
    else:
        # PREMIUM (default): exactamente como el build_premium original
        base = T.bg_cream(W, H)
        bar = int(H * 0.068)
        T.bar_red(base, 0, bar, "bottom")
        T.bar_red(base, H - bar, H, "top")
        cfg = {
            "bar": bar,
            "name_color": INK,
            "price_color": RED,
            "footer_color": (250, 248, 243),
            "glow": brand_glow(cx, H * 0.44, W * 0.55, BLUE, 0.16),
            "vign": radial_vignette(0.16),
            "prod_cy": H * 0.44,
            "prod_maxw": W * 0.72,
            "prod_maxh": H * 0.40,
            "name_y": H * 0.665,
            "price_y": int(H * 0.815),
            "filetes": "red_gold_blue",
            "logo_asset": "normal",
        }

    # ---- Assets comunes ----
    # Logo: SIEMPRE logo.png (lockup horizontal transparente con texto), como premium.
    # NO usar logo-dark.png (esfera 3D sobre fondo negro opaco) — se ve mal sobre la barra.
    # Se escala por ALTURA para que CALCE dentro de la barra roja sin cortarse arriba.
    _logo_src = Image.open(os.path.join(T.ASSETS, "logo.png")).convert("RGBA")
    _bb = _logo_src.getbbox()          # recorta el aire transparente para que el logo no quede chico
    if _bb:
        _logo_src = _logo_src.crop(_bb)
    _logo_h = int(H * 0.060) if look == "split" else int(cfg["bar"] * 0.82)
    _logo_sc = _logo_h / _logo_src.height
    if _logo_src.width * _logo_sc > W * 0.50:      # tope de ancho por si el lockup es muy largo
        _logo_sc = (W * 0.50) / _logo_src.width
    lg = _logo_src.resize((max(1, int(_logo_src.width * _logo_sc)),
                           max(1, int(_logo_src.height * _logo_sc))), Image.LANCZOS)

    # Producto
    prod = Image.open(args.product).convert("RGBA")
    prod = T.defringe(prod)
    scp = min(cfg["prod_maxw"] / prod.width, cfg["prod_maxh"] / prod.height)
    prod = prod.resize((int(prod.width * scp), int(prod.height * scp)), Image.LANCZOS)
    floor = drop_shadow_ellipse(prod.width, op=0.30)

    # Textos
    name_im = text_img(args.name.upper(), f_display(72 if look != "giant" else 64), cfg["name_color"])

    # Bloque precio: número + símbolo separados para el pop animado
    num_str = fmt_price(args.price)[1:]  # sin el $
    price_sz = 310 if look != "giant" else 360   # giant usa tamaño más grande
    price_im = text_img(num_str, f_price(price_sz), cfg["price_color"])
    price_sh = text_img(num_str, f_price(price_sz), (30, 12, 14, 150)).filter(ImageFilter.GaussianBlur(6))
    dollar_sz = 118 if look != "giant" else 136
    dollar_im = text_img("$", f_price(dollar_sz), cfg["price_color"])

    foot_im = text_img("HUALPEN  ·  PUBLICO Y NEGOCIOS  ·  DESPACHO", f_ui(34), cfg["footer_color"])
    unit_im = text_img(" ".join(unit.upper()), f_ui(30), INK_SOFT if look not in ("dark", "split") else CREAM_HI)

    # Para giant: pill de unidad sobre el fondo (se dibuja en frame)
    tag_im = _make_tag_pill(args.tag)
    old_im = None
    badge = None
    if price_old:
        old_color = GREY_STRIKE if look not in ("split",) else CREAM_HI
        old_im = text_img("Normal " + fmt_price(price_old), f_strike(42), old_color)
        pct = round((1 - args.price / price_old) * 100)
        badge = _make_badge(pct)
    cta_im = text_img("APROVECHA HOY  ·  PIDE POR WHATSAPP", f_ui(36), WHITE)

    dur = args.seconds
    nframes = int(dur * FPS)
    silent = os.path.splitext(args.out)[0] + ".silent.mp4"
    ff = imageio_writer(silent)

    for fi in range(nframes):
        t = fi / FPS
        frame = base.copy()
        if cb and (fi % 5 == 0 or fi == nframes - 1):
            cb(int(fi / nframes * 100))

        # Glow de marca (opcional según look)
        if cfg.get("glow") is not None:
            frame.alpha_composite(cfg["glow"])

        # ---- Logo ----
        la = ease_out(clamp01(t / 0.6))
        if look == "split":
            logo_cx = cfg.get("logo_cx", W * 0.26)
            logo_cy = H * cfg.get("logo_cy_factor", 0.07)
            paste_center(frame, lg, logo_cx, logo_cy + (1 - la) * -30, 1.0, la)
        else:
            bar = cfg["bar"]
            paste_center(frame, lg, cx, bar * 0.5 + (1 - la) * -30, 1.0, la)

        # ---- Sello OFERTA o badge % ----
        if badge is None:
            ta = ease_out_back_soft(clamp01((t - 0.15) / 0.5))
            if ta > 0.02 and look not in ("split",):
                paste_center(frame, tag_im, W * 0.155, cfg["bar"] + H * 0.052, ta, clamp01(ta * 1.3))
            elif ta > 0.02 and look == "split":
                # en split, el sello va arriba derecha (ribbon en static pero pill animada aquí)
                paste_center(frame, tag_im, W * 0.82, H * 0.16, ta, clamp01(ta * 1.3))
        else:
            ba = ease_out_back_soft(clamp01((t - 0.4) / 0.6))
            if ba > 0.02:
                bsp = badge.rotate(-10 + (1 - ba) * 60, expand=True, resample=Image.BICUBIC)
                paste_center(frame, bsp, W - 175, H * 0.235, ba, clamp01(ba * 1.3))

        # ---- Producto: back suave + Ken Burns + float + sway ----
        apr = ease_out_back_soft(clamp01((t - 0.3) / 0.7))
        zoom = (1.0 + 0.08 * ease_out(clamp01(t / dur))) * (0.92 + 0.08 * clamp01((t - 0.3) / 0.5))
        floaty = math.sin(t * 1.5) * 12
        sway = math.sin(t * 0.9) * 5
        pcy = cfg["prod_cy"] + floaty
        paste_center(frame, floor, cx, pcy + prod.height * 0.50 * zoom, zoom, 0.9)
        prod_f = prod
        sp = seg(t, 1.0, 1.8)
        if 0 < sp < 1:
            prod_f = apply_shine(prod, sp, 0.9)
        paste_center(frame, prod_f, cx + sway, pcy, zoom, clamp01(apr))

        # ---- Nombre + filetes ----
        an = ease_out(clamp01((t - 0.7) / 0.5))
        ny = cfg["name_y"]
        paste_center(frame, name_im, cx, ny + (1 - an) * 28, 1.0, an)

        # Filetes según look
        filetes = cfg.get("filetes", "none")
        if filetes != "none":
            lw = int(180 * ease_out(clamp01((t - 1.0) / 0.5)))
            if lw > 4:
                dd = ImageDraw.Draw(frame)
                if filetes == "red_gold_blue":
                    dd.line([(cx - lw, ny + 58), (cx + lw, ny + 58)], fill=RED, width=6)
                    dd.line([(cx - lw, ny + 66), (cx + lw, ny + 66)], fill=GOLD, width=3)
                    dd.line([(cx - min(lw, 70), ny + 74), (cx + min(lw, 70), ny + 74)], fill=BLUE, width=3)
                elif filetes == "gold_only":
                    dd.line([(cx - lw, ny + 58), (cx + lw, ny + 58)], fill=GOLD, width=5)

        # ---- PRECIO POP con resorte (clímax sync con SFX) ----
        py = cfg["price_y"]
        if t >= 1.4:
            pr = clamp01((t - 1.4) / 0.55)
            psc = lerp(0.55, 1.0, ease_spring(pr))
            if t > 1.55:
                psc *= 1 + 0.045 * math.sin((t - 1.55) * 7.0) * math.exp(-(t - 1.55) * 2.2)
            pa = clamp01(pr * 1.4)
            num = price_im
            sp2 = seg(t, 1.55, 2.1)
            if 0 < sp2 < 1:
                num = apply_shine(price_im, sp2, 1.0)
            gap = 8
            total = dollar_im.width + gap + num.width
            x_left = cx - (total * psc) / 2
            ntop = py - num.height / 2 * psc
            paste_center(frame, price_sh, cx + 4, py + 7, psc, pa * 0.6)
            paste_center(frame, dollar_im,
                         x_left + dollar_im.width / 2 * psc,
                         ntop + dollar_im.height / 2 * psc,
                         psc, pa)
            paste_center(frame, num,
                         x_left + (dollar_im.width + gap + num.width / 2) * psc,
                         py, psc, pa)
            num_bottom = py + num.height / 2 * psc

            # Tachado "Normal $X"
            if old_im is not None:
                oa = clamp01((t - 1.2) / 0.4)
                oy = ntop - 30
                paste_center(frame, old_im, cx, oy, 1.0, oa)
                if oa > 0.5:
                    ow = old_im.width
                    strike_color = RED if look not in ("split",) else YELLOW
                    ImageDraw.Draw(frame).line(
                        [(cx - ow / 2, oy), (cx + ow / 2, oy)],
                        fill=strike_color, width=5
                    )

            # Unidad (para giant: pill GOLD animada; para el resto: texto fino)
            ua = clamp01((t - 1.7) / 0.4)
            if ua > 0.02:
                if look == "giant":
                    # Pill GOLD con texto RED_INK
                    pill_w = int(260 * psc)
                    pill_h = int(56 * psc)
                    pill_y = int(num_bottom + 30)
                    pill_img = Image.new("RGBA", (pill_w + 20, pill_h + 20), (0, 0, 0, 0))
                    pill_d = ImageDraw.Draw(pill_img)
                    pill_d.rounded_rectangle([10, 10, pill_w + 10, pill_h + 10],
                                             radius=pill_h // 2, fill=GOLD + (int(255 * ua),))
                    unit_txt = unit.upper()
                    fnt_pill = f_ui(int(32 * psc))
                    pill_d.text(((pill_w + 20) / 2, (pill_h + 20) / 2),
                                unit_txt, font=fnt_pill, fill=RED_INK, anchor="mm")
                    paste_center(frame, pill_img, cx, pill_y, 1.0, ua)
                else:
                    paste_center(frame, unit_im, cx, num_bottom + 22, 1.0, ua)

        # ---- CTA de cierre ----
        if t >= dur - 1.6:
            ca = ease_out(clamp01((t - (dur - 1.6)) / 0.5))
            cy_band = H - cfg["bar"] - 70
            band = Image.new("RGBA", (W, 88), (237, 28, 36, int(235 * ca)))
            frame.alpha_composite(band, (0, int(cy_band - 44)))
            ImageDraw.Draw(frame).rectangle([0, int(cy_band - 44), W, int(cy_band - 41)], fill=GOLD)
            paste_center(frame, cta_im, cx, cy_band, 1.0, ca)

        # ---- Footer + viñeta ----
        paste_center(frame, foot_im, cx, H - cfg["bar"] * 0.5, 1.0, 1.0)
        frame.alpha_composite(cfg["vign"])

        ff.append_data(np.asarray(frame.convert("RGB")))

    ff.close()
    beats = {"whoosh_tag": 0.20, "whoosh_prod": 0.45, "price": 1.50, "footer": dur - 1.4}
    _finalize(args, silent, beats)
    print("OK ->", args.out, f"({look}, {nframes} frames, {dur}s)")


# ---------------------------------------------------------------------------
# build_premium: mantiene API pública, delega a _build_look("premium")
# ---------------------------------------------------------------------------
def build_premium(args):
    """Premium nivel agencia: fondo crema con profundidad, motion fluido, shine, pop con resorte."""
    _build_look(args, "premium")


# ---------------------------------------------------------------------------
# render: punto de entrada unificado
# ---------------------------------------------------------------------------
def render(args):
    """Despacha al look correcto según args.style."""
    style = getattr(args, "style", "premium")
    if style in ("premium", "dark", "giant", "split"):
        _build_look(args, style)
    elif style == "clasica":
        build(args)
    else:
        # default: premium
        _build_look(args, "premium")


def _make_tag_pill(text):
    """Sello OFERTA tipo ticket (rojo + filete oro), como imagen para animar."""
    s = text.upper()
    fnt = f_display(54)
    tmp = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    bb = tmp.textbbox((0, 0), s, font=fnt); tw = bb[2] - bb[0]
    w, h = tw + 72, 82
    im = Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([20, 24, im.width - 20, im.height - 16],
                                         radius=h // 2, fill=(30, 10, 12, 90))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(12)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([20, 20, 20 + w, 20 + h], radius=h // 2, fill=RED)
    d.rounded_rectangle([20, 20, 20 + w, 20 + h], radius=h // 2, outline=GOLD, width=3)
    d.text((20 + w / 2, 20 + h / 2), s, font=fnt, fill=(250, 248, 243), anchor="mm")
    return im

def _make_badge(pct):
    size = 300
    star = starburst(size, RED, spikes=18, inner=0.78)
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0)); rd = ImageDraw.Draw(ring)
    rd.ellipse([26, 26, size - 26, size - 26], outline=GOLD, width=6)
    rd.ellipse([40, 40, size - 40, size - 40], outline=(250, 247, 240), width=4)
    star.alpha_composite(ring)
    d = ImageDraw.Draw(star)
    d.text((size / 2, size / 2 - 26), f"-{pct}%", font=f_price(96), fill=WHITE, anchor="mm")
    d.text((size / 2, size / 2 + 44), "DCTO", font=f_name(36), fill=WHITE, anchor="mm")
    return star

def imageio_writer(out):
    import imageio
    return imageio.get_writer(
        out, fps=FPS, codec="libx264", bitrate="9M",
        macro_block_size=8, pixelformat="yuv420p",
        ffmpeg_params=["-profile:v", "high", "-level", "4.0",
                       "-movflags", "+faststart",
                       "-x264-params", "keyint=60:min-keyint=30"])

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--price", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tag", default="OFERTA DE LA SEMANA")
    ap.add_argument("--price-old", dest="price_old", default=None)
    ap.add_argument("--unit", default="c/u")
    ap.add_argument("--audio", default="on", choices=["on", "off"])
    ap.add_argument("--cta", default="on")
    ap.add_argument("--seconds", type=float, default=6.0)
    ap.add_argument("--style", default="premium",
                    choices=["clasica", "premium", "dark", "giant", "split"])
    args = ap.parse_args()
    args.price = int(re.sub(r"[^0-9]", "", str(args.price)) or 0)
    if args.price_old:
        args.price_old = int(re.sub(r"[^0-9]", "", str(args.price_old)) or 0) or None
    if args.style == "premium" and args.tag == "OFERTA DE LA SEMANA":
        args.tag = "OFERTA"
    render(args)
