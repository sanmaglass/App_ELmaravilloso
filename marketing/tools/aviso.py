# -*- coding: utf-8 -*-
"""Avisos informativos El Maravilloso (horarios, feriados, cierres, novedades).
Reutiliza marca/paleta/fuentes de templates.py. El HORARIO es el protagonista.
Salida cuadrada 1080x1080 (feed) o vertical 1080x1920 (story) con --story.
Uso:
  python tools/aviso.py --titular "ABIERTO ESTE FERIADO" --sub "Lunes 29 de junio" \
        --horario "10:00 a 18:00 hrs" --pie "Grecia 1841, Hualpen" --out content/avisos/x.png
"""
import os, math, argparse
from PIL import Image, ImageDraw, ImageFilter
import templates as T


def _clock(size, ring, face, hand):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pad = int(size * 0.06); w = max(6, int(size * 0.075))
    d.ellipse([pad, pad, size - pad, size - pad], outline=ring, width=w, fill=face + (255,))
    c = size / 2
    for k in range(12):
        a = k / 12 * 2 * math.pi
        r0, r1 = c * 0.70, c * 0.80
        d.line([(c + math.cos(a) * r0, c + math.sin(a) * r0),
                (c + math.cos(a) * r1, c + math.sin(a) * r1)], fill=ring, width=max(2, w // 3))
    d.line([(c, c), (c + math.cos(math.radians(-60)) * c * 0.42,
            c + math.sin(math.radians(-60)) * c * 0.42)], fill=hand, width=w)
    d.line([(c, c), (c + math.cos(math.radians(-150)) * c * 0.55,
            c + math.sin(math.radians(-150)) * c * 0.55)], fill=hand, width=w)
    d.ellipse([c - w, c - w, c + w, c + w], fill=hand)
    return im


def _sunburst(size, color, spikes=20, alpha=46):
    """Rayos suaves desde el centro (energia detras del horario)."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im); c = size / 2
    for k in range(spikes):
        a0 = (k / spikes) * 2 * math.pi
        if k % 2: continue
        pts = [(c, c)]
        for da in (-0.16, 0.16):
            pts.append((c + math.cos(a0 + da) * size, c + math.sin(a0 + da) * size))
        d.polygon(pts, fill=color + (alpha,))
    return im.filter(ImageFilter.GaussianBlur(size * 0.012))


def _coin(size, pal):
    """Moneda dorada decorativa (identidad: ahorro El Maravilloso)."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im); w = max(4, int(size * 0.09))
    d.ellipse([w, w, size - w, size - w], fill=pal["coin"] + (255,),
              outline=pal["coin_rim"] + (255,), width=w)
    d.ellipse([size * 0.26, size * 0.26, size * 0.74, size * 0.74],
              outline=pal["coin_rim"] + (255,), width=max(3, w // 2))
    return im


def _glow(size, color, alpha=70):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse([0, 0, size, size], fill=color + (alpha,))
    return im.filter(ImageFilter.GaussianBlur(size * 0.14))


def _fit_one(d, s, font_fn, maxw, hi, lo):
    for sz in range(int(hi), int(lo) - 1, -2):
        f = font_fn(sz)
        if d.textlength(s, font=f) <= maxw:
            return f
    return font_fn(int(lo))


def build(titular, sub, horario, pie, out, story=False, pal="marca"):
    P = T.PALETTES.get(pal, T.PAL_MARCA)
    W = 1080; Hh = 1920 if story else 1080
    im = T.bg_friendly(P, W, Hh)
    d = ImageDraw.Draw(im)
    ink = P["ink"]; muted = P["muted"]; pill = P["pill"]; coin = P["coin"]
    cream = (252, 246, 236)
    cx = W // 2

    # --- monedas decorativas (marca, llenan el aire sobre todo en story) ---
    cs = int(W * 0.13)
    im.alpha_composite(_coin(cs, P), (int(W * 0.05), int(Hh * (0.04 if story else 0.05))))
    im.alpha_composite(_coin(int(cs * 0.7), P),
                       (int(W * 0.86), int(Hh * (0.90 if story else 0.86))))
    if story:
        im.alpha_composite(_coin(int(cs * 0.6), P), (int(W * 0.04), int(Hh * 0.80)))
        im.alpha_composite(_coin(int(cs * 0.55), P), (int(W * 0.88), int(Hh * 0.30)))

    # --- header de marca (esfera glossy + EL MARAVILLOSO) ---
    T.place_brand_header(im, cx, int(Hh * 0.105), int(W * 0.105), ink)
    yf = int(Hh * 0.165)
    gw = int(W * 0.28)
    d.line([(cx - gw, yf), (cx + gw, yf)], fill=coin + (255,), width=5)
    # rombo central en el filete
    d.regular_polygon((cx, yf, 9), 4, fill=coin + (255,))

    # --- titular grande (BebasNeue rojo, auto-fit) ---
    f, lines, sz = T.fit_title(titular.upper(), W * 0.86, W * 0.125, W * 0.072,
                               max_lines=2, font_fn=T.f_display)
    lh = int(sz * 0.92)
    y = int(Hh * (0.21 if story else 0.215))
    for ln in lines:
        T.txt(d, (cx, y + lh // 2), ln, f, ink, anchor="mm")
        y += lh

    # --- subtitulo (fecha / contexto) ---
    if sub:
        fs = _fit_one(d, sub, T.f_name, W * 0.90, W * 0.042, W * 0.026)
        y += int(Hh * 0.012)
        T.txt(d, (cx, y + fs.size // 2), sub, fs, muted, anchor="mm")

    # ================= HERO HORARIO (el elemento mas fuerte) =================
    yc = int(Hh * (0.60 if story else 0.71))
    ph = int(W * (0.215 if story else 0.205))    # tarjeta mas alta
    fh = T.f_display(int(W * (0.125 if story else 0.118)))
    clk = _clock(int(ph * 0.62), cream, pill, cream)
    tw = d.textlength(horario, font=fh)
    gap = int(W * 0.028)
    content = clk.width + gap + tw
    pw = int(content + W * 0.13)

    # sunburst + glow detras (energia)
    sb = _sunburst(int(W * 1.15), pill, alpha=34)
    im.alpha_composite(sb, (int(cx - sb.width / 2), int(yc - sb.height / 2)))
    gl = _glow(int(pw * 1.25), pill, alpha=46)
    im.alpha_composite(gl, (int(cx - gl.width / 2), int(yc - gl.height / 2)))

    # rotulo arriba de la tarjeta
    lab = "HORARIO DE ATENCIÓN"
    fl = T.f_ui(int(W * 0.044))
    ly = yc - ph // 2 - int(W * 0.052)
    # pildora crema para el rotulo
    lw = d.textlength(lab, font=fl); lpw = int(lw + W * 0.07); lph = int(W * 0.075)
    T.pill(d, cx, ly, lpw, lph, cream + (255,))
    d.rounded_rectangle([cx - lpw / 2, ly - lph / 2, cx + lpw / 2, ly + lph / 2],
                        radius=lph // 2, outline=coin + (255,), width=3)
    T.txt(d, (cx, ly), lab, fl, ink, anchor="mm")

    # sombra de la tarjeta
    sh = Image.new("RGBA", (pw + 60, ph + 60), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([30, 30, pw + 30, ph + 30],
                                         radius=ph // 2, fill=(120, 18, 22, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    im.alpha_composite(sh, (int(cx - sh.width / 2), int(yc - sh.height / 2 + 14)))

    # tarjeta roja + doble filete oro
    d2 = ImageDraw.Draw(im)
    T.pill(d2, cx, yc, pw, ph, pill + (255,))
    d2.rounded_rectangle([cx - pw / 2 + 7, yc - ph / 2 + 7, cx + pw / 2 - 7, yc + ph / 2 - 7],
                         radius=(ph - 14) // 2, outline=coin + (235,), width=4)
    d2.rounded_rectangle([cx - pw / 2 + 16, yc - ph / 2 + 16, cx + pw / 2 - 16, yc + ph / 2 - 16],
                         radius=(ph - 32) // 2, outline=cream + (60,), width=2)
    # brillo superior (look caro)
    hl = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    ImageDraw.Draw(hl).rounded_rectangle([14, 10, pw - 14, ph * 0.42], radius=ph // 3,
                                         fill=(255, 255, 255, 34))
    im.alpha_composite(hl.filter(ImageFilter.GaussianBlur(6)), (int(cx - pw / 2), int(yc - ph / 2)))

    # contenido: reloj + hora
    x0 = cx - content / 2
    T.paste_c(im, clk, x0 + clk.width / 2, yc)
    ImageDraw.Draw(im).text((x0 + clk.width + gap, yc), horario, font=fh, fill=cream,
                            anchor="lm", stroke_width=2, stroke_fill=(120, 18, 22))

    # --- pie: pin dibujado + direccion (centrados juntos) ---
    if pie:
        py = Hh - int(Hh * (0.07 if story else 0.075))
        fp = _fit_one(d2, pie, T.f_ui, W * 0.82, W * 0.034, W * 0.024)
        ptw = d2.textlength(pie, font=fp)
        ps = int(fp.size * 1.05)               # tamaño del pin
        gp = int(W * 0.012)
        gw2 = ps + gp + ptw
        gx0 = cx - gw2 / 2
        # pin de ubicacion (gota + circulo)
        pin = Image.new("RGBA", (ps, ps), (0, 0, 0, 0)); pd = ImageDraw.Draw(pin)
        pd.ellipse([ps * 0.18, ps * 0.05, ps * 0.82, ps * 0.69], fill=P["pill"] + (255,))
        pd.polygon([(ps * 0.5, ps * 0.95), (ps * 0.27, ps * 0.55), (ps * 0.73, ps * 0.55)],
                   fill=P["pill"] + (255,))
        pd.ellipse([ps * 0.37, ps * 0.24, ps * 0.63, ps * 0.50], fill=(252, 246, 236, 255))
        T.paste_c(im, pin, gx0 + ps / 2, py)
        ImageDraw.Draw(im).text((gx0 + ps + gp, py), pie, font=fp, fill=muted, anchor="lm")

    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    im.convert("RGB").save(out, quality=95)
    print("OK ->", out, im.size)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--titular", required=True)
    ap.add_argument("--sub", default="")
    ap.add_argument("--horario", required=True)
    ap.add_argument("--pie", default="Grecia 1841, Hualpen")
    ap.add_argument("--out", required=True)
    ap.add_argument("--story", action="store_true")
    ap.add_argument("--pal", default="marca")
    a = ap.parse_args()
    build(a.titular, a.sub, a.horario, a.pie, a.out, a.story, a.pal)
