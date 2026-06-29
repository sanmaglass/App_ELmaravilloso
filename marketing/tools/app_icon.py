# -*- coding: utf-8 -*-
"""Genera un app icon 1024x1024 para TikTok/stores con la esfera M de marca."""
import os, sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import templates as T

S = 1024
P = T.PAL_MARCA

def make(bg="cream", out="content/avisos/app-icon.png"):
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # fondo
    if bg == "red":
        base = T.bg_red().resize((S, S), Image.LANCZOS).convert("RGBA")
        ring_c = (255, 255, 255)
    else:
        import numpy as np
        yy = np.linspace(0, 1, S, dtype=np.float32)[:, None]
        a = np.zeros((S, S, 3), np.float32)
        hi, lo = P["bg2"], P["bg"]
        for i in range(3):
            a[..., i] = hi[i] * (1 - yy) + lo[i] * yy
        base = Image.fromarray(a.astype("uint8"), "RGB").convert("RGBA")
        ring_c = P["coin"]
    im.alpha_composite(base)
    d = ImageDraw.Draw(im)
    # anillo dorado/blanco sutil de borde
    m = int(S * 0.055)
    d.ellipse([m, m, S - m, S - m], outline=ring_c + (90,), width=max(3, int(S * 0.010)))

    # ---- extraer SOLO el emblema (esfera azul + M roja) del logo_v2,
    #      ignorando el fondo verde grunge y el texto blanco ----
    import numpy as np
    src = Image.open(os.path.join(T.ASSETS, "logo_v2.png")).convert("RGB")
    arr = np.array(src).astype(int)
    r_, g_, b_ = arr[..., 0], arr[..., 1], arr[..., 2]
    red  = (r_ > 95) & ((r_ - g_) > 25) & ((r_ - b_) > 0)
    blue = (b_ > 60) & ((b_ - g_) > 8) & ((b_ - r_) > -10)
    emb = ((red | blue).astype("uint8")) * 255
    mask = Image.fromarray(emb, "L")
    # cerrar huecos (sombras internas) y suavizar borde
    mask = mask.filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.MinFilter(13))
    mask = mask.filter(ImageFilter.GaussianBlur(2.2))
    sph = src.convert("RGBA"); sph.putalpha(mask)
    bb = sph.getbbox()
    if bb:
        sph = sph.crop(bb)
    tw = int(S * 0.60)
    th = int(sph.height * tw / sph.width)
    sph = sph.resize((tw, th), Image.LANCZOS)
    cx, cy = S // 2, int(S * 0.50)
    # sombra de contacto
    sh = Image.new("RGBA", sph.size, (0, 0, 0, 0))
    sh.putalpha(sph.split()[3].point(lambda v: int(v * 0.45)))
    sh = sh.filter(ImageFilter.GaussianBlur(int(S * 0.02)))
    im.alpha_composite(sh, (cx - tw // 2 + int(S * 0.012), cy - th // 2 + int(S * 0.02)))
    im.alpha_composite(sph, (cx - tw // 2, cy - th // 2))

    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    im.convert("RGB").save(out, quality=95)
    print("OK ->", out, im.size)
    return out

if __name__ == "__main__":
    bg = sys.argv[1] if len(sys.argv) > 1 else "cream"
    out = sys.argv[2] if len(sys.argv) > 2 else "content/avisos/app-icon.png"
    make(bg, out)
