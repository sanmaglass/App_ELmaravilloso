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
import argparse, math, os, re, sys, random
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
        # Solo barra inferior RED_DEEP con filete GOLD (superior quitada — header_pro la reemplaza)
        bar = int(H * 0.078)
        ImageDraw.Draw(base).rectangle([0, H - bar, W, H], fill=RED_DEEP)
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
        # Solo barra inferior (superior quitada — header_pro la reemplaza)
        base = T.bg_cream(W, H)
        bar = int(H * 0.078)
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
        # Solo barra inferior implícita en la banda diagonal (superior quitada — header_pro la reemplaza)
        base = T.bg_cream(W, H)
        bar = int(H * 0.078)
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
        # Solo barra inferior (superior quitada — header_pro la reemplaza)
        base = T.bg_cream(W, H)
        bar = int(H * 0.068)
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
    # Header: header_pro.png (lower-third 2560x1440, fondo transparente, esfera M + banda marca).
    # Se escala a ancho = 52% del frame, manteniendo ratio.
    _hdr = Image.open(os.path.join(T.ASSETS, "header_clean.png")).convert("RGBA")
    _hsc = (W * 0.52) / _hdr.width
    _hdr = _hdr.resize((int(_hdr.width * _hsc), int(_hdr.height * _hsc)), Image.LANCZOS)

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

    # ---- Efectos de variedad: leer de args (ya elegidos en render()) ----
    entry_style    = getattr(args, "entry_style", "zoom_bounce")
    ambient_effects = getattr(args, "ambient_effects", [])
    price_style    = getattr(args, "price_style", "pop")

    dur = args.seconds
    nframes = int(dur * FPS)

    # ---- Precalcular assets de ambiente (fuera del loop) ----
    sunburst_base = None
    if "sunburst" in ambient_effects:
        sunburst_base = _make_sunburst_base(cx, int(cfg["prod_cy"]))

    particles = None
    if "particles" in ambient_effects:
        # Usar RNG determinista si hay seed
        seed_val = getattr(args, "seed", None)
        p_rng = random.Random(seed_val)
        particles = _make_particles(p_rng)

    glow_base = cfg.get("glow")  # para breathe

    # Parámetros de timing del precio según estilo
    # pop: empieza t=1.4, dura 0.55 → asentado ~1.95
    # slot: empieza t=1.4, dura 0.8 → asentado ~2.20
    # count_up: empieza t=1.4, dura 0.55 → asentado ~1.95
    PRICE_START = 1.4
    PRICE_SETTLE = {
        "pop":      PRICE_START + 0.55,
        "slot":     PRICE_START + 0.80,
        "count_up": PRICE_START + 0.55,
    }
    price_settled_at = PRICE_SETTLE.get(price_style, PRICE_START + 0.55)

    # Para slot: preparar fuente de dígitos (misma que price_im pero necesitamos el objeto)
    slot_font = f_price(310 if look != "giant" else 360)

    silent = os.path.splitext(args.out)[0] + ".silent.mp4"
    ff = imageio_writer(silent)

    for fi in range(nframes):
        t = fi / FPS
        frame = base.copy()
        if cb and (fi % 5 == 0 or fi == nframes - 1):
            cb(int(fi / nframes * 100))

        # ---- Ambiente: sunburst DETRÁS del glow (capa más inferior) ----
        if sunburst_base and t > 0.2:
            _render_sunburst(frame, sunburst_base, t, cx, cfg["prod_cy"])

        # Glow de marca (opcional según look) + breathe
        if glow_base is not None:
            if "breathe" in ambient_effects:
                breathe_op = _get_breathe_alpha(t)
                # Reusar glow_base con alpha modulado
                _gl = set_alpha(glow_base, breathe_op / 0.18)  # normalizado respecto a op base
                frame.alpha_composite(_gl)
            else:
                frame.alpha_composite(glow_base)

        # ---- Header (header_pro.png) — arriba-izquierda en todos los looks ----
        la = ease_out(clamp01(t / 0.6))
        _hdr_cx = 30 + _hdr.width / 2
        _hdr_cy = 24 + _hdr.height / 2 + (1 - la) * -30
        paste_center(frame, _hdr, _hdr_cx, _hdr_cy, 1.0, la)

        # ---- Sello OFERTA o badge % ----
        if badge is None:
            ta = ease_out_back_soft(clamp01((t - 0.15) / 0.5))
            if ta > 0.02:
                _tag_cx = W - tag_im.width * ta / 2 - 40
                _tag_cy = cfg["bar"] + H * 0.052
                paste_center(frame, tag_im, _tag_cx, _tag_cy, ta, clamp01(ta * 1.3))
        else:
            ba = ease_out_back_soft(clamp01((t - 0.4) / 0.6))
            if ba > 0.02:
                bsp = badge.rotate(-10 + (1 - ba) * 60, expand=True, resample=Image.BICUBIC)
                paste_center(frame, bsp, W - 175, H * 0.235, ba, clamp01(ba * 1.3))

        # ---- Producto: animación de entrada elegida al azar ----
        zoom_kb = (1.0 + 0.08 * ease_out(clamp01(t / dur)))  # Ken Burns siempre
        floaty = math.sin(t * 1.5) * 12
        sway   = math.sin(t * 0.9) * 5
        pcy = cfg["prod_cy"]

        # t_entry: progreso de la entrada (0..1 durante los primeros 1s)
        ENTRY_START = 0.3
        ENTRY_DUR   = 0.7
        t_entry = clamp01((t - ENTRY_START) / ENTRY_DUR)

        prod_sc, prod_a, ox, oy, prod_animated = _entry_transform(
            prod, entry_style, t_entry, floaty, sway)

        # Aplicar Ken Burns encima de la escala de entrada
        final_sc = prod_sc * zoom_kb

        # Brillo de producto (shine sweep)
        sp = seg(t, 1.0, 1.8)
        if 0 < sp < 1:
            prod_animated = apply_shine(prod_animated, sp, 0.9)

        # Sombra (siempre con escala base)
        paste_center(frame, floor, cx + ox, pcy + oy + prod.height * 0.50 * final_sc,
                     final_sc, 0.9 * prod_a)
        paste_center(frame, prod_animated, cx + ox, pcy + oy, final_sc, prod_a)

        # ---- Partículas de ambiente (encima del producto, opacidad baja) ----
        if particles and t > 0.5:
            _render_particles(frame, particles, t - 0.5)

        # ---- Nombre + filetes ----
        an = ease_out(clamp01((t - 0.7) / 0.5))
        ny = cfg["name_y"]
        paste_center(frame, name_im, cx, ny + (1 - an) * 28, 1.0, an)

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

        # ---- PRECIO: revelado según price_style ----
        py = cfg["price_y"]
        num_bottom = py + price_im.height / 2  # fallback
        if t >= PRICE_START:
            t_rev = t - PRICE_START  # tiempo desde que empieza el precio

            if price_style == "pop":
                # Original: pop con resorte
                pr = clamp01(t_rev / 0.55)
                psc = lerp(0.55, 1.0, ease_spring(pr))
                if t > PRICE_START + 0.15:
                    psc *= 1 + 0.045 * math.sin((t - PRICE_START - 0.15) * 7.0) * math.exp(-(t - PRICE_START - 0.15) * 2.2)
                pa = clamp01(pr * 1.4)
                num = price_im
                sp2 = seg(t, PRICE_START + 0.15, PRICE_START + 0.70)
                if 0 < sp2 < 1:
                    num = apply_shine(price_im, sp2, 1.0)
                gap = 8
                total = dollar_im.width + gap + num.width
                x_left = cx - (total * psc) / 2
                ntop = py - num.height / 2 * psc
                paste_center(frame, price_sh, cx + 4, py + 7, psc, pa * 0.6)
                paste_center(frame, dollar_im,
                             x_left + dollar_im.width / 2 * psc,
                             ntop + dollar_im.height / 2 * psc, psc, pa)
                paste_center(frame, num,
                             x_left + (dollar_im.width + gap + num.width / 2) * psc,
                             py, psc, pa)
                num_bottom = py + num.height / 2 * psc

            elif price_style == "slot":
                # Slot machine: dígitos giran y frenan escalonados
                dur_slot = 0.80
                psc = lerp(0.70, 1.0, ease_out(clamp01(t_rev / 0.25)))
                pa = clamp01(t_rev / 0.25 * 1.4)
                slot_im = _build_price_digits_slot(
                    num_str, slot_font, cfg["price_color"], t_rev, dur_slot)
                gap = 8
                total = dollar_im.width + gap + slot_im.width
                x_left = cx - (total * psc) / 2
                ntop = py - slot_im.height / 2 * psc
                paste_center(frame, dollar_im,
                             x_left + dollar_im.width / 2 * psc,
                             ntop + dollar_im.height / 2 * psc, psc, pa)
                paste_center(frame, slot_im,
                             x_left + (dollar_im.width + gap + slot_im.width / 2) * psc,
                             py, psc, pa)
                num_bottom = py + slot_im.height / 2 * psc
                # Brillo al asentarse (cuando el último dígito frenó)
                if t_rev >= dur_slot:
                    shine_t = clamp01((t_rev - dur_slot) / 0.5)
                    if 0 < shine_t < 1:
                        num_shined = apply_shine(price_im, shine_t, 0.8)
                        paste_center(frame, num_shined,
                                     x_left + (dollar_im.width + gap + price_im.width / 2) * psc,
                                     py, psc, min(pa, shine_t * 0.6))

            elif price_style == "count_up":
                # Contador que sube de 0 al precio
                dur_count = 0.55
                cur_val = _count_up_value(args.price, t_rev, dur_count)
                cur_str = format(cur_val, ",d").replace(",", ".")
                cur_im = text_img(cur_str, slot_font, cfg["price_color"])
                cur_sh = text_img(cur_str, slot_font, (30, 12, 14, 150)).filter(ImageFilter.GaussianBlur(6))
                psc = lerp(0.80, 1.0, ease_out(clamp01(t_rev / dur_count)))
                pa = clamp01(t_rev / 0.25 * 1.4)
                gap = 8
                total = dollar_im.width + gap + cur_im.width
                x_left = cx - (total * psc) / 2
                ntop = py - cur_im.height / 2 * psc
                paste_center(frame, cur_sh, cx + 4, py + 7, psc, pa * 0.6)
                paste_center(frame, dollar_im,
                             x_left + dollar_im.width / 2 * psc,
                             ntop + dollar_im.height / 2 * psc, psc, pa)
                paste_center(frame, cur_im,
                             x_left + (dollar_im.width + gap + cur_im.width / 2) * psc,
                             py, psc, pa)
                num_bottom = py + cur_im.height / 2 * psc
                # Brillo al asentarse
                if t_rev >= dur_count:
                    shine_t = clamp01((t_rev - dur_count) / 0.5)
                    if 0 < shine_t < 1:
                        num_shined = apply_shine(price_im, shine_t, 1.0)
                        paste_center(frame, num_shined,
                                     x_left + (dollar_im.width + gap + price_im.width / 2) * psc,
                                     py, psc, shine_t * 0.5)

            # Tachado "Normal $X" (común a todos los price_styles)
            ntop = py - price_im.height / 2  # aproximado para el tachado
            if old_im is not None:
                oa = clamp01((t - 1.2) / 0.4)
                oy_old = ntop - 30
                paste_center(frame, old_im, cx, oy_old, 1.0, oa)
                if oa > 0.5:
                    ow = old_im.width
                    strike_color = RED if look not in ("split",) else YELLOW
                    ImageDraw.Draw(frame).line(
                        [(cx - ow / 2, oy_old), (cx + ow / 2, oy_old)],
                        fill=strike_color, width=5
                    )

            # Unidad
            psc_unit = 1.0
            if price_style == "pop":
                pr2 = clamp01((t - PRICE_START) / 0.55)
                psc_unit = lerp(0.55, 1.0, ease_spring(pr2))
            ua = clamp01((t - (PRICE_START + 0.3)) / 0.4)
            if ua > 0.02:
                if look == "giant":
                    pill_w = int(260 * psc_unit)
                    pill_h = int(56 * psc_unit)
                    pill_y = int(num_bottom + 30)
                    pill_img = Image.new("RGBA", (pill_w + 20, pill_h + 20), (0, 0, 0, 0))
                    pill_d = ImageDraw.Draw(pill_img)
                    pill_d.rounded_rectangle([10, 10, pill_w + 10, pill_h + 10],
                                             radius=pill_h // 2, fill=GOLD + (int(255 * ua),))
                    fnt_pill = f_ui(int(32 * psc_unit))
                    pill_d.text(((pill_w + 20) / 2, (pill_h + 20) / 2),
                                unit.upper(), font=fnt_pill, fill=RED_INK, anchor="mm")
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
    # SFX: beat del precio sincronizado al momento real de asentamiento
    beats = {"whoosh_tag": 0.20, "whoosh_prod": 0.45,
             "price": price_settled_at, "footer": dur - 1.4}
    _finalize(args, silent, beats)
    print("OK ->", args.out, f"({look}, {nframes} frames, {dur}s)")


# ---------------------------------------------------------------------------
# build_premium: mantiene API pública, delega a _build_look("premium")
# ---------------------------------------------------------------------------
def build_premium(args):
    """Premium nivel agencia: fondo crema con profundidad, motion fluido, shine, pop con resorte."""
    _build_look(args, "premium")


# ---------------------------------------------------------------------------
# MOTOR DE VARIEDAD ALEATORIA
# ---------------------------------------------------------------------------
# Opciones disponibles para cada dimensión de variedad
ENTRY_STYLES  = ["zoom_bounce", "slide_up", "spin_in", "flip3d", "drop"]
AMBIENT_POOL  = ["particles", "sunburst", "breathe"]
PRICE_STYLES  = ["pop", "slot", "count_up"]
LOOK_STYLES   = ["premium", "dark", "giant", "split"]

def _pick_variety(args, rng):
    """Elige aleatoriamente entrada/ambiente/precio/look. Respeta valores ya fijados en args."""
    # Entrada del producto
    if not getattr(args, "entry_style", None):
        args.entry_style = rng.choice(ENTRY_STYLES)
    # Efectos de ambiente (0, 1 o 2 al azar)
    if not getattr(args, "ambient_effects", None):
        n = rng.randint(0, 2)
        pool = AMBIENT_POOL[:]
        rng.shuffle(pool)
        args.ambient_effects = pool[:n]
    # Estilo de revelado del precio
    if not getattr(args, "price_style", None):
        args.price_style = rng.choice(PRICE_STYLES)

def _init_rng(args):
    """Inicializa el RNG. Si --seed se pasó, es reproducible; si no, azar real."""
    seed = getattr(args, "seed", None)
    if seed is None:
        rng = random.Random()
    else:
        rng = random.Random(int(seed))
    return rng

# ---- Efectos de ambiente — helpers precalculados ----

def _make_sunburst_base(cx, cy, n_rays=18):
    """Genera la imagen de rayos UNA VEZ; se rota por frame."""
    size = max(W, H) * 2
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    for k in range(n_rays):
        a0 = (k / n_rays) * 2 * math.pi
        pts = [(c, c)]
        for da in (-0.09, 0.09):
            pts.append((c + math.cos(a0 + da) * size, c + math.sin(a0 + da) * size))
        d.polygon(pts, fill=(255, 190, 40, 18))
    return im

def _render_sunburst(frame, sunburst_base, t, cx, cy):
    """Rota y pega rayos detrás; muy liviano (solo paste)."""
    angle = t * 3.5  # grados por segundo
    rot = sunburst_base.rotate(angle, expand=False, center=(sunburst_base.width // 2, sunburst_base.height // 2))
    bw, bh = rot.size
    ox = int(cx - bw / 2)
    oy = int(cy - bh / 2)
    # recortar al frame
    sx = max(0, -ox); sy = max(0, -oy)
    ex = min(bw, W - ox); ey = min(bh, H - oy)
    if ex > sx and ey > sy:
        crop = rot.crop((sx, sy, ex, ey))
        frame.alpha_composite(crop, (max(0, ox), max(0, oy)))

def _make_particles(rng, n=16):
    """Precalcula partículas (posición base, velocidad, fase, tamaño, color)."""
    particles = []
    for _ in range(n):
        particles.append({
            "x": rng.randint(80, W - 80),
            "y": rng.randint(int(H * 0.15), int(H * 0.80)),
            "vx": rng.uniform(-12, 12),
            "vy": rng.uniform(-25, -8),
            "phase": rng.uniform(0, math.pi * 2),
            "size": rng.randint(5, 14),
            "color": rng.choice([YELLOW, WHITE, (255, 230, 80)]),
            "alpha": rng.randint(55, 130),
        })
    return particles

def _render_particles(frame, particles, t):
    """Dibuja partículas flotantes por frame."""
    d = ImageDraw.Draw(frame)
    for p in particles:
        x = p["x"] + p["vx"] * t + math.sin(t * 1.1 + p["phase"]) * 18
        y = p["y"] + p["vy"] * t + math.cos(t * 0.9 + p["phase"]) * 12
        # pulso de opacidad suave
        a = int(p["alpha"] * (0.5 + 0.5 * math.sin(t * 2.0 + p["phase"])))
        a = max(0, min(255, a))
        s = p["size"]
        col = p["color"] + (a,)
        d.ellipse([x - s, y - s, x + s, y + s], fill=col)

def _get_breathe_alpha(t, base_op=0.18):
    """Alfa sinusoidal lenta para breathe (pulso del glow)."""
    return base_op * (0.7 + 0.3 * math.sin(t * 1.4))

# ---- Entrada del producto — helpers ----

def _entry_transform(prod, entry_style, t_entry, floaty, sway):
    """
    Devuelve (scale, alpha, offset_x, offset_y, rotated_prod).
    t_entry: progreso 0..1 de la animación de entrada.
    """
    te = clamp01(t_entry)
    ox, oy = sway, floaty
    rot_prod = prod  # por defecto sin rotar

    if entry_style == "zoom_bounce":
        sc = ease_out_back_soft(te)
        a = clamp01(te * 1.3)

    elif entry_style == "slide_up":
        sc = 1.0
        a = clamp01(te * 1.5)
        oy = floaty + (1 - ease_out_quint(te)) * 220

    elif entry_style == "spin_in":
        sc = lerp(0.55, 1.0, ease_out_back_soft(te))
        a = clamp01(te * 1.3)
        # rotación decrece de -160 a 0
        deg = lerp(-160, 0, ease_out_quint(te))
        if deg != 0:
            rot_prod = prod.rotate(deg, expand=False, resample=Image.BICUBIC)
        else:
            rot_prod = prod

    elif entry_style == "flip3d":
        # Simula flip horizontal: escala X de 0.05→1.0
        flip_t = ease_out_quint(te)
        sc_x = lerp(0.05, 1.0, flip_t)
        # Squish: resize horizontal manteniendo alto
        new_w = max(1, int(prod.width * sc_x))
        rot_prod = prod.resize((new_w, prod.height), Image.LANCZOS)
        sc = 1.0
        a = clamp01(te * 1.5)

    elif entry_style == "drop":
        sc = 1.0
        a = clamp01(te * 1.5)
        # Cae desde arriba: offset Y de -300 a 0
        land_t = ease_out_quint(te)
        oy = floaty + (1 - land_t) * (-300)
        # Squash al aterrizar (solo cuando te > 0.80)
        if te > 0.80:
            squash_t = (te - 0.80) / 0.20
            # Escala Y: 1.0 -> 1.10 -> 0.92 -> 1.0
            sy_factor = 1.0 + math.sin(squash_t * math.pi) * 0.10 * math.exp(-squash_t * 2.5)
            new_h = max(1, int(prod.height * sy_factor))
            rot_prod = prod.resize((prod.width, new_h), Image.LANCZOS)
        else:
            rot_prod = prod

    else:
        # fallback: zoom_bounce
        sc = ease_out_back_soft(te)
        a = clamp01(te * 1.3)

    return sc, a, ox, oy, rot_prod

# ---- Revelado del precio — helpers ----

def _build_price_digits_slot(price_str, font_obj, color, t_reveal, dur_slot=0.8):
    """
    Slot machine: cada dígito gira y frena escalonado.
    Devuelve una imagen RGBA con todos los dígitos pegados.
    t_reveal: tiempo desde que empieza el slot (0..dur_slot).
    """
    digits = price_str  # ej: "7.190"
    n = len(digits)
    # Medida de un dígito de referencia
    ref = text_img("0", font_obj, color)
    dw, dh = ref.width, ref.height
    pad = 4
    total_w = sum(
        text_img(ch, font_obj, color).width + pad for ch in digits
    ) - pad
    out = Image.new("RGBA", (total_w, dh), (0, 0, 0, 0))
    x = 0
    for i, ch in enumerate(digits):
        ch_im = text_img(ch, font_obj, color)
        cw = ch_im.width
        # Los dígitos de izquierda frenan antes que los de la derecha
        frac = (i + 1) / n  # fracción: el último frena en dur_slot completo
        stop_t = frac * dur_slot
        if t_reveal >= stop_t:
            # Ya frenado: pegar el dígito final en posición
            out.alpha_composite(ch_im, (x, 0))
        else:
            # Girando: deslizar varios dígitos en Y
            spin_speed = 12  # dígitos por segundo
            offset_frac = (t_reveal * spin_speed) % 1.0
            offset_y = int(offset_frac * dh)
            # dígito actual y el anterior (para hacer el scroll)
            slot_digits = "9876543210"
            idx = slot_digits.find(ch) if ch.isdigit() else 0
            d_cur = text_img(ch, font_obj, color)
            d_prev_char = slot_digits[(idx + 1) % len(slot_digits)] if ch.isdigit() else ch
            d_prev = text_img(d_prev_char, font_obj, (color[0], color[1], color[2], 160))
            clip = Image.new("RGBA", (cw, dh), (0, 0, 0, 0))
            clip.alpha_composite(d_prev, (0, offset_y - dh))
            clip.alpha_composite(d_cur, (0, offset_y))
            out.alpha_composite(clip, (x, 0))
        x += cw + pad
    return out

def _count_up_value(price, t_reveal, dur_count=0.55):
    """Retorna el valor actual del contador animado (0 → price)."""
    if t_reveal >= dur_count:
        return price
    progress = ease_out_quint(clamp01(t_reveal / dur_count))
    return int(price * progress)


# ---------------------------------------------------------------------------
# render: punto de entrada unificado
# ---------------------------------------------------------------------------
def _pill_image(ps, fprice, P, Wf):
    """Píldora de precio (rounded rect de marca + precio) como imagen, para animar el pop."""
    tmp = text_img(ps, fprice, P["pill_txt"])
    pad_x, pad_y = int(Wf*0.075), int(Wf*0.05)
    pw, ph = tmp.size
    W2, H2 = pw+pad_x*2, ph+pad_y*2
    im = Image.new("RGBA", (W2, H2), (0,0,0,0))
    ImageDraw.Draw(im).rounded_rectangle([0,0,W2-1,H2-1], radius=int(Wf*0.07), fill=tuple(P["pill"])+(255,))
    im.alpha_composite(tmp, (pad_x, pad_y))
    return im

def build_amigable(args):
    """Video del estilo amigable multi-producto: fondo suave + monedas % + 2-3 productos
    que entran con stagger, título y precio en píldora animados. Reutiliza templates.py."""
    cb = getattr(args, "on_progress", None)
    pal = getattr(args, "pal", "marca") or "marca"
    P = T.PALETTES.get(pal, T.PALETTES["marca"])
    Wf, Hf = T.dims("story")  # 1080x1920 (reel/tiktok)

    # productos (acepta lista o string "a.png,b.png")
    paths = getattr(args, "products", None) or [args.product]
    if isinstance(paths, str): paths = [p.strip() for p in paths.split(",") if p.strip()]
    paths = [p for p in paths if p][:3]
    args.price = int(re.sub(r"[^0-9]", "", str(args.price)) or 0)

    # ---- capa estática: fondo suave con grilla ----
    bg = T.bg_friendly(P, Wf, Hf)

    # monedas (imagen + posición base en px + fase de bob)
    coin_specs = [
        (T.coin_pct(int(Wf*0.30), P), Wf*0.88, Hf*0.10, 0.0),
        (T.coin_pct(int(Wf*0.27), P), Wf*0.05, Hf*0.55, 1.1),
        (T.coin_pct(int(Wf*0.19), P), Wf*0.90, Hf*0.90, 2.2),
    ]

    # productos: fila centrada, solapados, en banda inferior
    maxh = int(Hf*0.40)
    prods  = [T.load_product(p, int(Wf*0.50), maxh) for p in paths]
    floors = [T.shadow_of(p, blur=30, op=0.28) for p in prods]
    n = len(prods); ov = int(Wf*0.06)
    total = sum(p.width for p in prods) - ov*(n-1)
    xs = []; x = Wf/2 - total/2
    for p in prods:
        xs.append(x + p.width/2); x += p.width - ov
    prod_cy = Hf*0.72
    front_order = sorted(range(n), key=lambda i: abs(i-(n-1)/2), reverse=True)

    # textos / fuentes
    title_lines = T._wrap((args.name or "").strip(), 14)[:2]
    ps = T.fmt(args.price)
    fname  = T.f_name(int(Wf*0.10))
    fui    = T.f_ui(int(Wf*0.026))
    fwm    = T.f_name(int(Wf*0.072))
    fprice = T.f_price(int(Wf*0.135))
    pill_im = _pill_image(ps, fprice, P, Wf)

    # logo M transparente
    try:
        lg = T.defringe(Image.open(os.path.join(T.ASSETS, "logo_v2.png")).convert("RGBA"), erode=2)
        s = int(Wf*0.10); lg = lg.resize((s, s), Image.LANCZOS)
    except Exception:
        lg = None

    # tiempos
    dur = float(getattr(args, "seconds", 6.0) or 6.0)
    nframes = int(dur*FPS)
    p_start = [0.5 + i*0.18 for i in range(n)]
    title_cy = Hf*0.225
    pill_cy  = title_cy + len(title_lines)*Wf*0.11 + Wf*0.02
    pill_t   = 0.35 + len(title_lines)*0.12 + 0.15
    beats = {"whoosh_tag": 0.30, "whoosh_prod": round(p_start[0], 2),
             "price": round(pill_t, 2), "footer": max(0.5, dur-0.5)}

    silent = os.path.splitext(args.out)[0] + ".silent.mp4"
    ff = imageio_writer(silent)

    for fi in range(nframes):
        t = fi/FPS
        frame = bg.copy()
        if cb and (fi % 5 == 0 or fi == nframes-1): cb(int(fi/nframes*100))

        # monedas flotando + fade-in
        for img, bx, by, ph in coin_specs:
            ca = ease_out(clamp01((t-0.1)/0.5))
            paste_center(frame, img, bx, by + math.sin(t*1.4+ph)*10, 1.0, ca)

        # wordmark (logo + DISTRIBUIDORA + El Maravilloso) con fade+slide
        wa = ease_out(clamp01(t/0.6))
        wy = Hf*0.085 + (1-wa)*-24
        if lg is not None:
            paste_center(frame, lg, Wf/2, wy - lg.height*0.05, 1.0, wa)
            wy2 = wy + lg.height*0.50
        else:
            wy2 = wy
        if wa > 0.01:
            paste_center(frame, text_img("D I S T R I B U I D O R A", fui, tuple(P["muted"])), Wf/2, wy2, 1.0, wa)
            paste_center(frame, text_img("El Maravilloso", fwm, tuple(P["ink"])), Wf/2, wy2+Wf*0.052, 1.0, wa)

        # título (líneas con stagger)
        ty = title_cy
        for li, ln in enumerate(title_lines):
            ta = ease_out(clamp01((t-0.25-li*0.12)/0.5))
            if ta > 0.01:
                paste_center(frame, text_img(ln, fname, tuple(P["ink"])), Wf/2, ty+(1-ta)*-18, 1.0, ta)
            ty += Wf*0.11

        # precio en píldora (pop)
        pa = clamp01((t-pill_t)/0.5)
        if pa > 0.01:
            paste_center(frame, pill_im, Wf/2, pill_cy, lerp(0.55, 1.0, ease_out_back(pa)), clamp01(pa*1.4))

        # productos: entran desde abajo con stagger + overshoot, luego flotan
        for i in front_order:
            p = prods[i]; te = clamp01((t-p_start[i])/0.6)
            if te <= 0: continue
            sl = ease_out_back(te); a = ease_out(clamp01((t-p_start[i])/0.4))
            oy = (1-sl)*(Hf*0.22) + math.sin(t*1.5+i)*8*te
            paste_center(frame, floors[i], xs[i]+10, prod_cy+oy+p.height*0.42, 1.0, 0.8*a)
            paste_center(frame, p, xs[i], prod_cy+oy, 1.0, a)

        ff.append_data(np.asarray(frame.convert("RGB")))
    ff.close()
    if cb: cb(100)
    _finalize(args, silent, beats)
    print("OK ->", args.out, f"(amigable, {nframes} frames, {dur}s)")


def render(args):
    """
    Despacha al look correcto según args.style.
    Inicializa el motor de variedad aleatoria antes de llamar al builder.
    """
    style = getattr(args, "style", "premium")

    # ---- Motor de variedad: elegir efectos si no están ya fijados ----
    rng = _init_rng(args)
    # Si style no fue especificado explícitamente (viene como default "premium"
    # y no hay flag --style), elegir look al azar.
    # Para server.py que siempre pasa style, esto no cambia nada.
    _auto_look = getattr(args, "_auto_look", False)
    if _auto_look:
        style = rng.choice(LOOK_STYLES)
        args.style = style
    _pick_variety(args, rng)

    # Imprimir combo elegido (útil para verificación y reproducibilidad)
    seed_val = getattr(args, "seed", None)
    print(f"  [variedad] look={style} | entrada={args.entry_style} | "
          f"ambiente={args.ambient_effects} | precio={args.price_style} | seed={seed_val}")

    if style == "amigable":
        build_amigable(args)
    elif style in ("premium", "dark", "giant", "split"):
        _build_look(args, style)
    elif style == "clasica":
        build(args)
    else:
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
    ap.add_argument("--products", default=None,
                    help="Estilo amigable: lista de recortes separados por coma (2-3 productos).")
    ap.add_argument("--pal", default="marca",
                    choices=["marca", "teal", "warm", "mint"],
                    help="Paleta del estilo amigable.")
    ap.add_argument("--name", required=True)
    ap.add_argument("--price", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tag", default="OFERTA DE LA SEMANA")
    ap.add_argument("--price-old", dest="price_old", default=None)
    ap.add_argument("--unit", default="c/u")
    ap.add_argument("--audio", default="on", choices=["on", "off"])
    ap.add_argument("--cta", default="on")
    ap.add_argument("--seconds", type=float, default=6.0)
    ap.add_argument("--style", default=None,
                    choices=["clasica", "premium", "dark", "giant", "split", "amigable"])
    ap.add_argument("--seed", type=int, default=None,
                    help="Semilla RNG para reproducir la combinación de efectos. "
                         "Sin --seed = combinación totalmente aleatoria.")
    args = ap.parse_args()
    args.price = int(re.sub(r"[^0-9]", "", str(args.price)) or 0)
    if args.price_old:
        args.price_old = int(re.sub(r"[^0-9]", "", str(args.price_old)) or 0) or None
    # Si no se pasó --style, elegir look al azar
    if args.style is None:
        args.style = "premium"  # se sobreescribirá en render() si _auto_look=True
        args._auto_look = True
    else:
        args._auto_look = False
    if args.style == "premium" and args.tag == "OFERTA DE LA SEMANA":
        args.tag = "OFERTA"
    render(args)
