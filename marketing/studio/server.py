#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Panel local del Estudio — El Maravilloso.
Servidor FastAPI: subir fotos, generar imagen + video por producto,
ver grid, agendar en el calendario. Todo local (localhost).

Levantar:  python server.py   (o doble clic en INICIAR_ESTUDIO.bat)
"""
import os, sys, json, re, shutil, argparse, threading, webbrowser, csv, io
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
MKT  = os.path.abspath(os.path.join(HERE, ".."))          # carpeta marketing/
TOOLS= os.path.join(MKT, "tools")
sys.path.insert(0, TOOLS)
import templates as T          # plantillas de diseño
import make_video as MV        # motor de video

# Carga ANTHROPIC_API_KEY desde .env (server-side, nunca al cliente)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(HERE, ".env"))
    load_dotenv(os.path.join(MKT, ".env"))
except Exception:
    pass

BRAND_MD = ""
try:
    BRAND_MD = open(os.path.join(MKT, "brand", "brand.md"), encoding="utf-8").read()
except Exception:
    pass

def load_estilo():
    """Lee studio/estilo.json en caliente (sin caché) para que cambios del dueño se reflejen sin reiniciar.
    Devuelve {} si el archivo no existe o tiene errores — degradación elegante."""
    try:
        return json.load(open(os.path.join(HERE, "estilo.json"), encoding="utf-8"))
    except Exception:
        return {}

TEXTOS_PATH = os.path.join(HERE, "textos.json")
def load_textos():
    """Textos editables del video (footer, cta, tag por defecto). Defaults desde el motor."""
    base = {"footer": MV.DEFAULT_FOOTER, "cta": MV.DEFAULT_CTA, "tag": "OFERTA"}
    try:
        d = json.load(open(TEXTOS_PATH, encoding="utf-8"))
        base.update({k: v for k, v in d.items() if isinstance(v, str) and v.strip()})
    except Exception:
        pass
    return base
def save_textos(d):
    cur = load_textos()
    for k in ("footer", "cta", "tag"):
        if isinstance(d.get(k), str) and d[k].strip():
            cur[k] = d[k].strip()
    json.dump(cur, open(TEXTOS_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return cur

ENTRADA = os.path.join(MKT, "assets", "entrada")
CUTS    = os.path.join(MKT, "assets", "_cuts")
IMG_OUT = os.path.join(MKT, "content", "instagram")
VID_OUT = os.path.join(MKT, "content", "tiktok")
DATA    = os.path.join(HERE, "studio_data.json")
for d in (ENTRADA, CUTS, IMG_OUT, VID_OUT):
    os.makedirs(d, exist_ok=True)

from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Estudio El Maravilloso")
app.mount("/files", StaticFiles(directory=MKT), name="files")

IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")

def load_data():
    if os.path.exists(DATA):
        try: return json.load(open(DATA, encoding="utf-8"))
        except Exception: pass
    return {"posts": []}

def save_data(d):
    json.dump(d, open(DATA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

def slugify(s):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.lower()).strip("-")
    return s or "producto"

def rel(p):  # ruta relativa a marketing/ para servir por /files
    return p.replace(MKT, "").replace("\\", "/").lstrip("/")

# ---------- páginas ----------
@app.get("/", response_class=HTMLResponse)
def home():
    return open(os.path.join(HERE, "index.html"), encoding="utf-8").read()

# ---------- API ----------
@app.get("/api/state")
def state():
    pend = [f for f in sorted(os.listdir(ENTRADA))
            if f.lower().endswith(IMG_EXT)]
    return {"entrada": pend, "posts": load_data()["posts"]}

@app.post("/api/upload")
async def upload(files: list[UploadFile] = File(...)):
    saved = []
    for f in files:
        if not f.filename.lower().endswith(IMG_EXT):
            continue
        dest = os.path.join(ENTRADA, os.path.basename(f.filename))
        with open(dest, "wb") as out:
            shutil.copyfileobj(f.file, out)
        saved.append(os.path.basename(f.filename))
    return {"saved": saved}

def maybe_cut(src_path, remove_bg):
    """Quita fondo con rembg si está disponible y se pidió; si no, usa la foto tal cual."""
    if not remove_bg:
        return src_path
    try:
        from rembg import remove
        from PIL import Image
        out = os.path.join(CUTS, os.path.splitext(os.path.basename(src_path))[0] + "-cut.png")
        Image.open(src_path)  # valida
        with open(src_path, "rb") as i:
            data = remove(i.read())
        open(out, "wb").write(data)
        return out
    except Exception:
        return src_path  # rembg no instalado → seguir sin recorte

GEN_PROGRESS = {}  # slug -> {"pct":int,"done":bool,"error":str|None,"post":dict|None}

def _gen_video_thread(slug, fname, name, price, style, tag, product,
                      img_path, cover_path, vid_path):
    """Corre en un thread: renderiza el video y actualiza GEN_PROGRESS."""
    try:
        GEN_PROGRESS[slug] = {"pct": 0, "done": False, "error": None, "post": None}
        tx = load_textos()
        args = argparse.Namespace(
            product=product, name=name, price=str(price),
            out=vid_path, tag=tag, seconds=6.0, style=style,
            footer=tx.get("footer") or None, cta_text=tx.get("cta") or None,
            on_progress=lambda p: GEN_PROGRESS[slug].update(pct=p),
        )
        MV.render(args)
        post = {
            "slug": slug, "filename": fname, "name": name, "price": price,
            "style": style, "tag": tag,
            "image": rel(img_path), "cover": rel(cover_path), "video": rel(vid_path),
            "status": "listo", "date": "", "time": "",
            "created": datetime.now().strftime("%Y-%m-%d %H:%M"),
        }
        d = load_data()
        d["posts"] = [p for p in d["posts"] if p.get("slug") != slug]
        d["posts"].insert(0, post)
        save_data(d)
        GEN_PROGRESS[slug].update(done=True, post=post, pct=100)
    except Exception as e:
        GEN_PROGRESS[slug].update(done=True, error=str(e), pct=100)


@app.post("/api/generate")
async def generate(req: Request):
    b = await req.json()
    fname   = b["filename"]
    name    = b.get("name") or os.path.splitext(fname)[0]
    price   = int(re.sub(r"[^0-9]", "", str(b.get("price", "0"))) or 0)
    style   = b.get("style", "premium")
    tag     = b.get("tag") or ("OFERTA" if style == "premium" else "OFERTA DE LA SEMANA")
    rem_bg  = bool(b.get("remove_bg", False))

    src = os.path.join(ENTRADA, fname)
    if not os.path.exists(src):
        return JSONResponse({"error": "foto no encontrada"}, status_code=404)
    product = maybe_cut(src, rem_bg)
    slug = slugify(name) + (f"-{price}" if price else "")

    # nombres cortos del panel (dark/giant/split) -> claves de templates.py
    STYLE_ALIAS = {"dark": "premium_dark", "giant": "premium_giant", "split": "premium_split"}
    drawer = T.STYLES.get(STYLE_ALIAS.get(style, style), T.style_premium)
    # imagen feed 1:1 (lo que pide Instagram para foto) -> clave 'image'
    img_path = os.path.join(IMG_OUT, slug + ".png")
    try:
        drawer(name, price, product, tag=tag, fmt="feed").convert("RGB").save(
            img_path, quality=92, optimize=True)
    except TypeError:
        # estilo no soporta fmt -> render estándar (no rompe)
        drawer(name, price, product, tag=tag).convert("RGB").save(img_path, quality=92)
    # cover story 9:16 (mismo encuadre del video)
    cover_path = os.path.join(IMG_OUT, slug + "-story.png")
    try:
        drawer(name, price, product, tag=tag, fmt="story").convert("RGB").save(
            cover_path, quality=92, optimize=True)
    except TypeError:
        cover_path = img_path

    # video en thread: no bloquea la respuesta
    vid_path = os.path.join(VID_OUT, slug + ".mp4")
    th = threading.Thread(
        target=_gen_video_thread,
        args=(slug, fname, name, price, style, tag, product,
              img_path, cover_path, vid_path),
        daemon=True,
    )
    th.start()
    return JSONResponse({"slug": slug, "generating": True})


@app.get("/api/progress")
def api_progress(slug: str = ""):
    return JSONResponse(GEN_PROGRESS.get(slug, {"pct": 0, "done": False}))

@app.get("/api/textos")
def api_get_textos():
    return JSONResponse(load_textos())

@app.post("/api/textos")
async def api_set_textos(req: Request):
    b = await req.json()
    return JSONResponse(save_textos(b))


@app.post("/api/delete")
async def delete_post(req: Request):
    b = await req.json()
    slug = b.get("slug", "")
    if not slug:
        return JSONResponse({"ok": False}, status_code=400)
    d = load_data()
    post = next((p for p in d["posts"] if p.get("slug") == slug), None)
    if not post:
        return JSONResponse({"ok": False}, status_code=404)
    # Borrar archivos solo si están dentro de marketing/content/ (seguridad path traversal)
    content_dir = os.path.abspath(os.path.join(MKT, "content"))
    for key in ("image", "cover", "video"):
        rel_path = post.get(key, "")
        if not rel_path:
            continue
        abs_path = os.path.abspath(os.path.join(MKT, rel_path))
        if abs_path.startswith(content_dir) and os.path.exists(abs_path):
            try:
                os.remove(abs_path)
            except Exception:
                pass
    d["posts"] = [p for p in d["posts"] if p.get("slug") != slug]
    save_data(d)
    return {"ok": True, "deleted": slug}

CAPTION_SCHEMA = {
    "type": "object",
    "properties": {
        "ig_caption":  {"type": "string"},
        "tiktok_text": {"type": "string"},
        "hashtags":    {"type": "string"},
    },
    "required": ["ig_caption", "tiktok_text", "hashtags"],
    "additionalProperties": False,
}

def _money(price):
    return "$" + format(int(price), ",d").replace(",", ".") if price else ""

# --- Motor de captions GRATIS (plantillas) — 6 estructuras distintas, voz de marca chilena ---

# Bancos de hashtags (minúscula, estratégicos, máx 5 según tendencia IG 2026)
_TAGS_LOCAL      = ["#hualpén", "#concepción", "#granconcepción", "#biobío", "#talcahuano"]
_TAGS_RUBRO      = ["#distribuidora", "#abarrotes", "#mayorista", "#almacén", "#supermercado"]
_TAGS_COMUNIDAD  = ["#ofertas", "#ofertaschile", "#compralocal", "#preciobajo", "#pyme"]


def _build_hashtags(name, v):
    """Arma exactamente 5 hashtags: 2 LOCAL + 1 RUBRO + 1 COMUNIDAD + 1 PRODUCTO.
    Elige dentro de cada banco según v (hash del nombre + variant) para variedad."""
    local1 = _TAGS_LOCAL[v % len(_TAGS_LOCAL)]
    local2 = _TAGS_LOCAL[(v + 2) % len(_TAGS_LOCAL)]
    if local2 == local1:
        local2 = _TAGS_LOCAL[(v + 1) % len(_TAGS_LOCAL)]
    rubro    = _TAGS_RUBRO[v % len(_TAGS_RUBRO)]
    comunidad = _TAGS_COMUNIDAD[v % len(_TAGS_COMUNIDAD)]
    # hashtag de producto: primera(s) palabra(s) significativas, minúscula, sin acentos ni espacios
    words = name.lower().split()
    # descarta unidades/números solos para el tag de producto
    stopwords = {"la", "el", "de", "en", "a", "y", "kg", "g", "ml", "lt", "l", "cc", "un", "x", "con", "sin", "1", "2", "3"}
    sig = [re.sub(r"[^a-z0-9]", "", w) for w in words if w not in stopwords and re.sub(r"[^a-z0-9]", "", w)]
    prod_tag = "#" + (sig[0] if sig else re.sub(r"[^a-z0-9]", "", words[0]) if words else "maravilloso")
    return f"{local1} {local2} {rubro} {comunidad} {prod_tag}"


def nice_name(name):
    """Convierte nombre gritado a sentence case natural. 'MILO BOLSA 1 KG' → 'Milo bolsa 1 kg'."""
    if not name:
        return name
    return name.strip().lower().capitalize()

# ── Bancos de frases ────────────────────────────────────────────────────────

HOOKS_OFERTA = [
    "Buen precio hoy 👇",
    "Llegó stock y lo dejamos bien:",
    "Precio del día:",
    "Para anotar y stockear:",
    "Te dejamos el dato:",
    "Una oportunidad que vale la pena considerar:",
    "Lo que pedías ya está disponible:",
    "Disponible ahora a buen precio:",
    "Un precio que conviene tener en el radar:",
]

HOOKS_PREGUNTA = [
    "¿Cuánto pagaste la última vez?",
    "¿Ya tienes stock de esto?",
    "¿Buscando buen precio en {name_short}?",
    "¿Necesitas surtir el almacén?",
    "¿Cuándo fue la última vez que surtiste {name_short}?",
    "¿Cuánto te costó la última vez?",
    "¿Tienes tu {name_short} para esta semana?",
    "¿Con el stock bajo?",
    "¿Estás evaluando precios para tu negocio?",
]

ANTOJOS = [
    "La hora de once no es la misma sin {name_short} 😋",
    "En casa siempre lo piden — y tú ya sabes dónde encontrarlo.",
    "Para la mesa de la semana: nada falla.",
    "El desayuno se vuelve mejor con esto 🙌",
    "Hay cosas que no pueden faltar en la despensa.",
    "Ideal para la semana, sin gastar de más.",
    "{name_short} para el desayuno: lo clásico que nunca falla.",
    "La despensa bien surtida siempre es buena idea.",
    "Ese sabor del desayuno que siempre vuelve 😄",
    "Para que no falte nada en casa esta semana.",
]

TIPS = [
    "Si compras en cantidad, el precio por unidad baja considerablemente.",
    "Buen producto para stockear cuando el precio acompaña.",
    "Consejo: compra cuando el precio está así — no esperes.",
    "A este precio conviene llevar más de una unidad.",
    "Para negocios: a este valor el margen es conveniente.",
    "Cuando hay stock y el precio está bien, aprovechar es lo inteligente.",
    "El truco para no quedarse sin stock: comprar antes de que suba.",
    "Producto de alta rotación — conviene tenerlo siempre disponible.",
    "Para los que revisan el precio antes de comprar: este vale la pena.",
    "Buen precio para empezar la semana con la despensa completa.",
]

NEGOCIO_HOOKS = [
    "¿Tienes almacén o botillería?",
    "Para los que revenden — atento a este precio:",
    "Para comercializadoras y locales:",
    "¿Surtiendo el negocio esta semana?",
    "Si tienes local, este precio te interesa:",
    "Precio mayorista disponible — escríbenos por DM.",
    "Para minimarkets, almacenes y botillerías:",
    "¿Tienes negocio en Concepción o alrededores?",
    "Para el que compra en cantidad — aquí el precio:",
]

NEGOCIO_CUERPO = [
    "{name} a {price} — buen margen para revender.",
    "{name} disponible a {price}. Despacho en Concepción.",
    "{name} a {price} por unidad. Trabajamos con negocios.",
    "{name}: {price}. Precio directo de distribuidora.",
    "Tenemos {name} a {price}. Consulta por volumen.",
    "{name} a {price} — atendemos negocios y comercializadoras.",
    "{name}: {price} la unidad. Despacho disponible.",
    "{name} a {price}. Haz tu pedido por DM.",
]

CTAS_NEGOCIO = [
    "Escríbenos por DM para coordinar tu pedido.",
    "Contáctanos por DM — despacho en Concepción.",
    "Pide por DM o pasa directo por Hualpén.",
    "DM para precio por volumen y despacho.",
    "Escríbenos y coordinamos la entrega.",
    "Disponible para negocios — DM o visítanos en Hualpén.",
    "Tu pedido por DM, lo despachamos rápido.",
    "Consulta disponibilidad y cantidad por DM.",
]

CTAS_CORTOS = [
    "Pasa por Hualpén o escríbenos 📦",
    "Te esperamos en Hualpén.",
    "DM para pedidos y despacho.",
    "Hualpén — público y negocios.",
    "Estamos en Hualpén. Despacho disponible.",
    "Escríbenos por DM o visítanos.",
    "Pedidos al DM, despacho en Concepción.",
    "Te esperamos o escríbenos para coordinar despacho.",
    "Hualpén · también despachamos.",
    "Simple — pide por DM y coordinamos.",
]

WHERE_FULL = [
    "Estamos en Hualpén. Despacho disponible en Gran Concepción.",
    "Pasa por Hualpén o escríbenos por DM para tu pedido.",
    "En Hualpén — atendemos público y comercializadoras.",
    "Hualpén · escríbenos por DM para pedidos y despacho.",
    "Visítanos en Hualpén o coordina tu despacho por DM.",
    "Estamos en Hualpén, atendemos a público y negocios.",
    "Pídenos por DM o pasa directo por Hualpén — rápido y sin complicaciones.",
    "Hualpén, Gran Concepción. Despacho para negocios y público.",
]

TIKTOK_OFERTA = [
    "{name} a {price} 📌 El Maravilloso, Hualpén.",
    "Precio del día: {name} {price} — Hualpén, con despacho.",
    "{name} {price}. Público y negocios. El Maravilloso.",
    "Anota: {name} a {price}. El Maravilloso, Hualpén 📦",
    "{name}: {price}. Distribuidora El Maravilloso, Hualpén.",
]

TIKTOK_ANTOJO = [
    "{name} para el desayuno ☕ {price}. El Maravilloso, Hualpén.",
    "En casa siempre lo piden: {name} a {price}. El Maravilloso.",
    "¿Despensa vacía? {name} {price}. Hualpén.",
    "{name} {price} para que el desayuno no falle 😄 Hualpén.",
    "La semana empieza bien: {name} a {price}. El Maravilloso.",
]

TIKTOK_NEGOCIO = [
    "{name} {price} para revender. El Maravilloso, Hualpén 🏪",
    "¿Tienes almacén? {name} a {price} — El Maravilloso.",
    "Precio distribuidora: {name} {price}. Despacho Concepción.",
    "{name} a {price} — buen margen. El Maravilloso, Hualpén.",
    "Surtiendo el negocio: {name} {price}. Escríbenos por DM.",
]

TIKTOK_PREGUNTA = [
    "¿Cuánto pagaste por {name}? Acá {price}. El Maravilloso 👀",
    "{name} a {price} — ¿lo tenías en la despensa? Hualpén.",
    "¿Stock bajo de {name}? {price} en El Maravilloso, Hualpén.",
    "¿Buscando {name} barato? {price}. Hualpén, con despacho 📦",
    "{name}: {price}. El Maravilloso tiene el precio. 🙌",
]

TIKTOK_CORTO = [
    "{name} {price} 📌",
    "{name} a {price} — El Maravilloso.",
    "{price}. {name}. Hualpén.",
    "{name}: {price} hoy.",
    "{name} {price} disponible ya.",
]

# ── Bancos para la MEZCLA DE CONTENIDO (frente 2: combo / cercanía / recordatorio) ──
COMBO_HOOKS = [
    "Arma tu combo en una sola pasada 🛒",
    "Lo de la once, junto:",
    "Combo listo para la semana:",
    "Para no comprar a medias — llévalo en combo:",
    "La compra completa de una vez:",
    "Combínalo y rinde más:",
]
COMBO_BODY = [
    "{name} a {price} + lo que te falte para completar la mesa. Arma tu combo en la distribuidora.",
    "Suma {name} ({price}) a tu pan, té o bebidas y deja la despensa lista.",
    "Con {name} a {price} y un par de complementos tienes la semana resuelta.",
    "{name} a {price} es la base — agrégale el resto y llévatelo todo junto.",
    "Empieza el combo con {name} a {price} y completa con lo que más sale en casa.",
]
CERCANIA = [
    "Somos tu distribuidora de barrio en Hualpén, a metros del colegio Montaner. Atención cercana y precios de verdad.",
    "Acá te atendemos como vecino, no como número. Pasa a vernos a Grecia 1841, Hualpén.",
    "El Maravilloso es de Hualpén para Hualpén — público y negocios, siempre con buena atención.",
    "Llevamos el precio de distribuidora a tu barrio. Te esperamos en Grecia 1841, Hualpén.",
    "Detrás del mostrador hay gente de acá que te conoce. Esa es la diferencia de comprar en el barrio.",
]
RECORDATORIO = [
    "¡Llegó stock! {name} disponible a {price}. Pasa hoy antes que se acabe.",
    "Recuerda que estamos de Lunes a Sábado 10 a 20 y Domingo 10 a 17. Te esperamos en Hualpén.",
    "Disponible ahora: {name} a {price}. Hualpén, público y negocios.",
    "Hoy tenemos {name} a {price}. Pasa o escríbenos para coordinar.",
    "Reponemos seguido: {name} a {price} otra vez en góndola. Aprovecha.",
]
TIKTOK_COMBO = [
    "Arma tu combo: {name} {price} + lo que falte. El Maravilloso, Hualpén 🛒",
    "El combo arranca con {name} a {price}. Completa en Hualpén.",
    "{name} {price} y completa la despensa de una. El Maravilloso.",
]
TIKTOK_CERCANIA = [
    "Tu distribuidora de barrio en Hualpén 🧡 Grecia 1841, a metros del Montaner.",
    "Precios de distribuidora con atención de barrio. El Maravilloso, Hualpén.",
    "De Hualpén para Hualpén. Público y negocios. Te esperamos 📦",
]
TIKTOK_RECORDATORIO = [
    "¡Llegó {name}! {price}. Pasa hoy. El Maravilloso, Hualpén.",
    "Abierto Lun a Sáb 10-20 · Dom 10-17. Te esperamos 📍 Hualpén.",
    "Stock fresco: {name} {price}. El Maravilloso, Hualpén.",
]

# Tipos de contenido para la mezcla (frente 2 del plan de crecimiento)
ANGLE_TO_STRUCT = {
    "oferta": 0, "pregunta": 1, "once": 2, "antojo": 2, "tip": 3,
    "negocio": 4, "corto": 5, "combo": 6, "cercania": 7, "recordatorio": 8,
}
NUM_STRUCT = 9
CONTENT_LABELS = {
    "oferta": "Oferta", "combo": "Combo", "once": "Once/Antojo", "tip": "Tip ahorro",
    "cercania": "Cercanía", "recordatorio": "Recordatorio", "negocio": "Negocio",
    "pregunta": "Pregunta", "corto": "Corto",
}
# Patrón semanal de mezcla: variado, con peso en oferta pero sin repetir el tipo en días seguidos
CONTENT_MIX = ["oferta", "combo", "once", "tip", "oferta", "cercania", "recordatorio"]

def templated_caption(name, price, variant=0, angle=None):
    """9 estructuras de caption claramente distintas. Si se pasa `angle`, fija la estructura
    correspondiente (mezcla de contenido); si no, rota según el variant para dar variedad."""
    p = _money(price)
    v = abs(hash(name)) + int(variant or 0)
    # pick dentro de un banco dado, desplazado por v para variedad entre productos
    def pick(lst, off=0):
        return lst[(v + off) % len(lst)]

    nn = nice_name(name)  # nombre en sentence case, nunca gritado
    name_short = nn.split()[0] if nn.split() else nn

    tags = _build_hashtags(name, v)

    if angle and angle in ANGLE_TO_STRUCT:
        structure = ANGLE_TO_STRUCT[angle]
    else:
        structure = int(variant or 0) % NUM_STRUCT

    # ── Estructura 0: Oferta directa (gancho → precio → dónde) ──────────────
    if structure == 0:
        hook = pick(HOOKS_OFERTA, 0)
        body = f"{nn} a {p}."
        why = pick(["Ideal para el consumo en casa o para surtir tu negocio.",
                    "Buen precio para consumo o para revender.",
                    "Conviene lo lleves a donde lo lleves.",
                    "A ese valor conviene tener stock.",
                    "Para la casa o el local — el precio acompaña.",
                    "Rinde en el hogar y conviene en el comercio.",
                    "A ese precio conviene llevar más de uno.",
                    "Buena compra para la semana."], 1)
        where = pick(WHERE_FULL, 2)
        ig = f"{hook}\n\n{body} {why}\n\n{where}"
        tk = pick(TIKTOK_OFERTA, 3).format(name=nn, price=p)

    # ── Estructura 1: Pregunta-gancho ────────────────────────────────────────
    elif structure == 1:
        pregunta = pick(HOOKS_PREGUNTA, 0).format(name_short=name_short)
        respuesta = f"El Maravilloso tiene {nn} a {p}."
        cta = pick(CTAS_CORTOS, 2)
        ig = f"{pregunta}\n\n{respuesta}\n\n{cta}"
        tk = pick(TIKTOK_PREGUNTA, 1).format(name=nn, price=p, name_short=name_short)

    # ── Estructura 2: Antojo / once / casa ───────────────────────────────────
    elif structure == 2:
        antojo = pick(ANTOJOS, 0).format(name_short=name_short)
        precio_line = f"{nn} a {p} en El Maravilloso 😋"
        where = pick(CTAS_CORTOS, 3)
        ig = f"{antojo}\n\n{precio_line}\n\n{where}"
        tk = pick(TIKTOK_ANTOJO, 2).format(name=nn, price=p)

    # ── Estructura 3: Dato / tip útil ────────────────────────────────────────
    elif structure == 3:
        tip = pick(TIPS, 0)
        precio_line = f"{nn}: {p}."
        where = pick(WHERE_FULL, 1)
        ig = f"{tip}\n\n{precio_line}\n\n{where}"
        tk = pick(TIKTOK_OFERTA, 4).format(name=nn, price=p)

    # ── Estructura 4: Enfoque negocio / reventa ──────────────────────────────
    elif structure == 4:
        neg_hook = pick(NEGOCIO_HOOKS, 0)
        neg_body = pick(NEGOCIO_CUERPO, 1).format(name=nn, price=p)
        cta_neg = pick(CTAS_NEGOCIO, 2)
        ig = f"{neg_hook}\n\n{neg_body}\n\n{cta_neg}"
        tk = pick(TIKTOK_NEGOCIO, 3).format(name=nn, price=p)

    # ── Estructura 5: Frase corta y seca ────────────────────────────────────
    elif structure == 5:
        ig = f"{nn} a {p}.\n\n{pick(CTAS_CORTOS, 0)}"
        tk = pick(TIKTOK_CORTO, 1).format(name=nn, price=p)

    # ── Estructura 6: Combo / canasta ────────────────────────────────────────
    elif structure == 6:
        hook = pick(COMBO_HOOKS, 0)
        body = pick(COMBO_BODY, 1).format(name=nn, price=p)
        where = pick(CTAS_CORTOS, 2)
        ig = f"{hook}\n\n{body}\n\n{where}"
        tk = pick(TIKTOK_COMBO, 3).format(name=nn, price=p)

    # ── Estructura 7: Cercanía / comunidad (el precio es secundario) ─────────
    elif structure == 7:
        cuerpo = pick(CERCANIA, 0)
        precio_line = f"Hoy de paso: {nn} a {p}."
        ig = f"{cuerpo}\n\n{precio_line}"
        tk = pick(TIKTOK_CERCANIA, 1)

    # ── Estructura 8: Recordatorio / llegó stock / horario ──────────────────
    elif structure == 8:
        rec = pick(RECORDATORIO, 0).format(name=nn, price=p)
        where = pick(CTAS_CORTOS, 1)
        ig = f"{rec}\n\n{where}"
        tk = pick(TIKTOK_RECORDATORIO, 2).format(name=nn, price=p)

    # ── Fallback seguro ──────────────────────────────────────────────────────
    else:
        ig = f"{nn} a {p}.\n\n{pick(CTAS_CORTOS, 0)}"
        tk = pick(TIKTOK_CORTO, 1).format(name=nn, price=p)

    tk_full = tk + " #fyp #parati"
    return {"ig_caption": ig, "tiktok_text": tk_full, "hashtags": tags}

def momento_context():
    """Devuelve un string corto en español describiendo el momento actual (día, quincena, temporada, eventos chilenos)."""
    import calendar
    hoy = datetime.now()
    dia_semana = hoy.weekday()  # 0=lun … 6=dom
    dia_mes = hoy.day
    mes = hoy.month

    nombres_dia = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    nombre_dia = nombres_dia[dia_semana]
    es_finde = dia_semana >= 4  # vie, sáb, dom

    # Temporada (hemisferio sur)
    if mes in (12, 1, 2):
        temporada = "verano (calor, bebidas, helados, cosas frías)"
    elif mes in (3, 4, 5):
        temporada = "otoño"
    elif mes in (6, 7, 8):
        temporada = "invierno (frío, época de once, sopas, cosas calientes)"
    else:
        temporada = "primavera"

    # Quincena
    if 14 <= dia_mes <= 16 or dia_mes >= 29:
        quincena_str = " Es quincena (la gente tiene plata fresca, momento de surtir)."
    else:
        quincena_str = ""

    # Calcular N-ésimo domingo de un mes dado
    def n_domingo(year, month, n):
        primer_dia = datetime(year, month, 1)
        # weekday del primer día (0=lun)
        primer_dom = (6 - primer_dia.weekday()) % 7  # días hasta primer domingo
        dia_domingo = 1 + primer_dom + (n - 1) * 7
        try:
            return datetime(year, month, dia_domingo).date()
        except ValueError:
            return None

    # Eventos chilenos con fechas variables
    year = hoy.year
    eventos = [
        # (fecha_inicio, fecha_fin, descripción)
        (datetime(year, 9, 18).date(), datetime(year, 9, 19).date(), "Fiestas Patrias (asados, carne, bebidas, completos)"),
        (datetime(year, 12, 25).date(), datetime(year, 12, 25).date(), "Navidad"),
        (datetime(year, 12, 31).date(), datetime(year + 1, 1, 1).date(), "Año Nuevo"),
        (datetime(year, 2, 14).date(), datetime(year, 2, 14).date(), "San Valentín"),
        (datetime(year, 10, 31).date(), datetime(year, 10, 31).date(), "Halloween"),
    ]
    # Día de la Madre: 2do domingo de mayo
    dom_madre = n_domingo(year, 5, 2)
    if dom_madre:
        eventos.append((dom_madre, dom_madre, "Día de la Madre"))
    # Día del Padre: 3er domingo de junio
    dom_padre = n_domingo(year, 6, 3)
    if dom_padre:
        eventos.append((dom_padre, dom_padre, "Día del Padre"))
    # Día del Niño: 1er domingo de agosto
    dom_nino = n_domingo(year, 8, 1)
    if dom_nino:
        eventos.append((dom_nino, dom_nino, "Día del Niño"))
    # Vuelta a clases: todo marzo
    eventos.append((datetime(year, 3, 1).date(), datetime(year, 3, 31).date(), "vuelta a clases"))
    # Vacaciones de invierno: segunda quincena junio + todo julio
    eventos.append((datetime(year, 6, 20).date(), datetime(year, 7, 31).date(), "vacaciones de invierno"))
    # CyberDay / Black Friday: noviembre
    eventos.append((datetime(year, 11, 1).date(), datetime(year, 11, 30).date(), "CyberDay / Black Friday"))

    hoy_date = hoy.date()
    evento_str = ""
    for inicio, fin, desc in eventos:
        delta_inicio = (inicio - hoy_date).days
        delta_fin = (fin - hoy_date).days
        if delta_fin < 0:
            continue  # ya pasó
        if delta_inicio <= 14 or delta_fin >= 0 and delta_inicio <= 0:
            if delta_inicio <= 0 <= delta_fin:
                evento_str = f" Estamos en {desc}."
            elif delta_inicio <= 14:
                evento_str = f" Se acerca {desc} ({delta_inicio} día{'s' if delta_inicio != 1 else ''})."
            break  # solo el más próximo

    # Armar texto final
    finde_str = " (finde)" if es_finde else ""
    partes = [f"Hoy es {nombre_dia}{finde_str}, {temporada}."]
    if quincena_str:
        partes.append(quincena_str.strip())
    if evento_str:
        partes.append(evento_str.strip())
    return " ".join(partes)


def _groq_caption(system, user):
    """Llama a Groq (compatible OpenAI) con urllib. Devuelve dict con ig_caption/tiktok_text/hashtags."""
    import urllib.request
    groq_key = os.environ.get("GROQ_API_KEY", "")
    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": 1200,
        "temperature": 0.8,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {groq_key}",
            "User-Agent": "Mozilla/5.0",  # Groq/Cloudflare bloquea el UA por defecto de urllib (403)
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    raw = data["choices"][0]["message"]["content"]
    # Intento directo
    try:
        result = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        # Extrae primer bloque {...} si la respuesta tiene texto extra
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            result = json.loads(m.group(0))
        else:
            raise ValueError(f"Groq no devolvió JSON válido: {raw[:200]}")
    # Parseo defensivo: garantizar las 3 claves esperadas
    return {
        "ig_caption":  str(result.get("ig_caption", "")),
        "tiktok_text": str(result.get("tiktok_text", "")),
        "hashtags":    str(result.get("hashtags", "")),
    }


def generate_caption(name, price, angle=None):
    """Genera caption IG + texto TikTok en la voz de marca.
    Proveedor: Groq (gratis, preferido) → Anthropic (de pago) → excepción no_key.
    angle: 'oferta' | 'antojo' | 'negocio' | 'corto' | 'pregunta' | None (libre)
    """
    name = nice_name(name)  # sentence case; nunca gritado
    precio = "$" + format(int(price), ",d").replace(",", ".") if price else ""

    angulos = {
        "oferta":   "oferta directa — arranca con el precio, explica por qué conviene y cierra con ubicación o DM.",
        "antojo":   "antojo / consumo en casa — evoca la hora de once o el desayuno, la despensa bien surtida; el precio aparece natural.",
        "once":     "la once / antojo en casa — evoca la hora de once chilena (pan, té, algo rico), la mesa surtida; el precio aparece natural, no es lo central.",
        "combo":    "combo o canasta — propón una combinación útil de este producto con 1 o 2 complementos típicos (para la once, el desayuno o el asado) e invita a armar el combo en la distribuidora. NO inventes precios de los complementos, solo del producto principal.",
        "tip":      "tip de ahorro / dato útil — entrega un consejo real (comprar por mayor baja el precio por unidad, stockear lo de alta rotación, comprar antes que suba) y desde ahí enlaza al producto y su precio.",
        "cercania": "cercanía y comunidad — humaniza la marca: distribuidora de barrio en Hualpén, Grecia 1841 a metros del colegio Montaner, atención cercana de vecino. El precio es secundario o puede ni aparecer.",
        "recordatorio": "recordatorio / servicio — avisa que llegó o hay stock del producto, o recuerda el horario (Lun a Sáb 10 a 20, Dom 10 a 17) y que pueden pasar hoy. Tono breve y útil.",
        "negocio":  "enfocado en negocios o reventa — habla de margen, surtir el almacén o botillería, despacho mayorista.",
        "corto":    "caption cortísimo, una o dos líneas máximo, sin adornos — precio y dónde comprar, nada más.",
        "pregunta": "empieza con una pregunta que enganche ('¿Cuánto pagaste…?', '¿Ya tienes stock?') y luego revela el precio.",
    }
    angle_instruccion = (
        f"\nÁngulo requerido para esta versión: {angulos[angle]}"
        if angle and angle in angulos else ""
    )

    momento = momento_context()
    estilo = load_estilo()

    # ── Sección de manual de estilo (inyectada si estilo.json existe) ──────────
    estilo_block = ""
    if estilo:
        negocio = estilo.get("negocio", {})
        reglas  = estilo.get("reglas", [])
        ejemplos = estilo.get("ejemplos_de_oro", [])

        negocio_lines = []
        if negocio.get("nombre"):
            negocio_lines.append(f"  Nombre: {negocio['nombre']}")
        if negocio.get("direccion"):
            negocio_lines.append(f"  Dirección: {negocio['direccion']} (úsala con 📍 en el cierre)")
        if negocio.get("instagram"):
            negocio_lines.append(f"  Instagram: {negocio['instagram']}")
        if negocio.get("tiktok"):
            negocio_lines.append(f"  TikTok: {negocio['tiktok']}")
        if negocio.get("despacho"):
            negocio_lines.append("  Ofrece despacho")

        reglas_lines = "\n".join(f"  - {r}" for r in reglas) if reglas else ""

        ejemplos_lines = ""
        if ejemplos:
            ej_parts = []
            for ej in ejemplos:
                prod  = ej.get("producto", "")
                prec  = ej.get("precio", "")
                cap   = ej.get("ig_caption", "")
                ej_parts.append(f'  Producto: {prod} | Precio: ${prec}\n  Caption:\n  """\n{cap}\n  """')
            ejemplos_lines = "\n\n".join(ej_parts)

        estilo_block = (
            "\n\n── MANUAL DE ESTILO (fuente de verdad editada por el dueño) ──\n"
            "DATOS DEL NEGOCIO:\n" + "\n".join(negocio_lines) + "\n"
        )
        if reglas_lines:
            estilo_block += (
                "\nREGLAS DE COPY (aplícalas siempre):\n" + reglas_lines + "\n"
                "\nIMPORTANTE: NUNCA uses asteriscos de markdown (**texto**) — Instagram los muestra como caracteres literales.\n"
            )
        if ejemplos_lines:
            estilo_block += (
                "\nEJEMPLOS DE ORO — IMÍTALOS en tono, estructura y calidez "
                "(NO copies el texto literal, adapta al producto nuevo):\n" + ejemplos_lines + "\n"
            )
        estilo_block += "── FIN DEL MANUAL ──"

    system = (
        "Eres el community manager de Distribuidora El Maravilloso (Hualpén, Chile). "
        "Escribes copy para Instagram y TikTok en español chileno informal, cercano y en tono de oferta. "
        "REGLAS ESTRICTAS:\n"
        "- Nunca menciones fiado, crédito ni pago diferido.\n"
        "- Emojis con moderación: 0 a 2 por caption, nunca spam.\n"
        "- Tono cercano pero PROFESIONAL, trato de tú, español chileno neutro. NADA de jerga ni modismos caricaturescos (prohibido: bacán, al tiro, los cabros, harto, pa'). Cálido y confiable, no acartonado.\n"
        "- Varía el arranque: no empieces siempre con el nombre del producto; usa ganchos, preguntas o situaciones.\n"
        "- Nada de sonar a plantilla o robot — el copy tiene que sentirse humano y espontáneo.\n"
        "- Cierra siempre invitando a pasar por Hualpén o escribir por DM.\n"
        "- Público doble: consumo en casa Y negocios que revenden.\n"
        "- NUNCA escribas el nombre del producto en mayúsculas sostenidas (ej: 'MILO' → 'Milo').\n"
        "- NUNCA uses asteriscos de markdown (**) — Instagram los renderiza como texto literal, no como negrita.\n"
        "- Incluye en el texto palabras que la gente busca naturalmente: el producto, la ciudad (Hualpén/Concepción), 'oferta' o 'precio' — esto sube el alcance orgánico.\n"
        f"Momento actual (aprovéchalo con naturalidad si calza, sin forzar): {momento}\n"
        "Usa esta ficha de marca como fuente de verdad:\n\n" + BRAND_MD
        + estilo_block
    )
    user = (
        f"Genera el contenido para este producto en oferta:"
        f"{angle_instruccion}\n\n"
        f"Producto: {name}\nPrecio: {precio}\n\n"
        f"Devuelve ÚNICAMENTE un JSON con exactamente estas 3 claves (nada más, sin texto extra):\n"
        f"- ig_caption: 3-5 líneas, con gancho o situación, el precio, beneficio claro y llamado a la acción.\n"
        f"- tiktok_text: 1-2 líneas, más punchy y directo, estilo para video corto.\n"
        f"- hashtags: EXACTAMENTE 4-5 hashtags, todos en MINÚSCULA, separados por espacio. "
        f"Mix obligatorio: 2 locales (de: #hualpén #concepción #granconcepción #biobío #talcahuano) + "
        f"1 rubro (de: #distribuidora #abarrotes #mayorista #almacén) + "
        f"1 comunidad/oferta (de: #ofertas #ofertaschile #compralocal #preciobajo) + "
        f"1 producto (primera palabra clave del producto en minúscula, sin espacios). "
        f"CERO hashtags genéricos de relleno. NUNCA más de 5 hashtags.\n\n"
        f"Formato exacto: {{\"ig_caption\": \"...\", \"tiktok_text\": \"...\", \"hashtags\": \"...\"}}"
    )

    groq_key = os.environ.get("GROQ_API_KEY", "")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")

    if groq_key:
        cap = _groq_caption(system, user)
    elif anthropic_key:
        import anthropic as _anthropic
        client = _anthropic.Anthropic(api_key=anthropic_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1200,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"format": {"type": "json_schema", "schema": CAPTION_SCHEMA}},
        )
        text = next(b.text for b in msg.content if b.type == "text")
        cap = json.loads(text)
    else:
        raise ValueError("no_key: configura GROQ_API_KEY (gratis) o ANTHROPIC_API_KEY en el .env")
    # Normaliza hashtags pase lo que pase la IA: cada uno con #, minúscula, máx 5, sin duplicados
    cap["hashtags"] = _normalize_hashtags(cap.get("hashtags", ""))
    return cap


def _normalize_hashtags(s, maxn=5):
    """Garantiza hashtags válidos: # al inicio, minúscula, sin símbolos raros, máx N, sin repetir."""
    out = []
    for t in re.split(r"[\s,]+", str(s).strip()):
        t = re.sub(r"[^0-9a-zA-Záéíóúüñ]", "", t.lstrip("#")).lower()
        if t and ("#" + t) not in out:
            out.append("#" + t)
        if len(out) >= maxn:
            break
    return " ".join(out)

def _caption_for(name, price, angle=None, variant=0):
    """Genera un caption con el ángulo dado: IA (Groq gratis/Anthropic) si hay key, si no plantillas.
    Usado por la auto-agenda para refrescar el texto según el tipo asignado en la mezcla."""
    has_key = bool(os.environ.get("GROQ_API_KEY") or os.environ.get("ANTHROPIC_API_KEY"))
    if has_key:
        try:
            return generate_caption(name, price, angle=angle)
        except Exception:
            pass
    return templated_caption(name, price, variant, angle=angle)

@app.post("/api/caption")
async def caption(req: Request):
    b = await req.json()
    name = b.get("name", "")
    price = int(b.get("price", 0) or 0)
    # Ángulo: explícito del request, o el guardado en el post (mezcla de contenido)
    angle = b.get("angle")
    if not angle and b.get("slug"):
        d0 = load_data()
        for p in d0["posts"]:
            if p["slug"] == b["slug"]:
                angle = p.get("angle")
                break
    # DEFAULT = IA (Groq gratis/Anthropic) si hay key configurada; si no hay key o falla, cae a plantillas.
    want_ai = b.get("ai")  # True=forzar IA, False=forzar plantilla, None=automático (IA si hay key)
    has_key = bool(os.environ.get("GROQ_API_KEY") or os.environ.get("ANTHROPIC_API_KEY"))
    use_ai = has_key if want_ai is None else bool(want_ai)
    if use_ai:
        try:
            cap = generate_caption(name, price, angle=angle)
        except Exception as e:
            m = str(e).lower()
            es_no_key = ("api_key" in m or "authentication" in m or "x-api-key" in m or "no_key" in m or "401" in m)
            if want_ai and es_no_key:   # el usuario pidió IA explícita y no hay key -> avisar
                return JSONResponse({"error": "no_key"}, status_code=400)
            cap = templated_caption(name, price, b.get("variant", 0), angle=angle)  # fallback silencioso
    else:
        cap = templated_caption(name, price, b.get("variant", 0), angle=angle)
    # guarda en el post si existe (caption + ángulo elegido)
    if b.get("slug"):
        d = load_data()
        for p in d["posts"]:
            if p["slug"] == b["slug"]:
                p["caption"] = cap
                if angle:
                    p["angle"] = angle
        save_data(d)
    return cap

# ---------- Cola en la nube para el publicador del VPS ----------
def _sb_env():
    return os.environ.get("SUPABASE_URL", "").rstrip("/"), os.environ.get("SUPABASE_SERVICE_KEY", "")

def storage_upload(local_abs, dest):
    """Sube un archivo al bucket público social-media. Devuelve la URL pública."""
    import urllib.request
    base, key = _sb_env()
    if not base or not key:
        raise RuntimeError("faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en .env")
    ct = ("video/mp4" if dest.lower().endswith(".mp4")
          else "image/png" if dest.lower().endswith(".png") else "image/jpeg")
    data = open(local_abs, "rb").read()
    req = urllib.request.Request(
        f"{base}/storage/v1/object/social-media/{dest}", data=data, method="POST",
        headers={"Authorization": f"Bearer {key}", "apikey": key,
                 "Content-Type": ct, "x-upsert": "true"})
    urllib.request.urlopen(req, timeout=120)
    return f"{base}/storage/v1/object/public/social-media/{dest}"

def supabase_insert_post(title, text, media_url, media_type, networks, scheduled_iso):
    import urllib.request
    base, key = _sb_env()
    body = json.dumps({"title": title or "", "text": text or "", "media_url": media_url,
                       "media_type": media_type, "networks": networks,
                       "scheduled_for": scheduled_iso, "status": "pending"}).encode("utf-8")
    req = urllib.request.Request(f"{base}/rest/v1/social_posts", data=body, method="POST",
        headers={"Authorization": f"Bearer {key}", "apikey": key,
                 "Content-Type": "application/json", "Prefer": "return=representation"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

def supabase_update_post(post_id, fields):
    import urllib.request
    base, key = _sb_env()
    req = urllib.request.Request(f"{base}/rest/v1/social_posts?id=eq.{post_id}",
        data=json.dumps(fields).encode("utf-8"), method="PATCH",
        headers={"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=30)

def _santiago_iso(date_str, time_str):
    """date 'YYYY-MM-DD' + time 'HH:MM' (hora de Chile) -> ISO con offset correcto."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.fromisoformat(f"{date_str}T{(time_str or '13:00')}:00").replace(
            tzinfo=ZoneInfo("America/Santiago")).isoformat()
    except Exception:
        return f"{date_str}T{(time_str or '13:00')}:00-04:00"

@app.post("/api/schedule")
async def schedule(req: Request):
    b = await req.json()
    d = load_data()
    post = None
    for p in d["posts"]:
        if p["slug"] == b["slug"]:
            p["date"] = b.get("date", "")
            p["time"] = b.get("time", "")
            p["status"] = b.get("status", p["status"])
            post = p
    save_data(d)
    # Encolar en la nube para que el VPS publique a la hora (IG + FB automático; TikTok = aviso Telegram).
    cloud = {"queued": False}
    if post and post.get("date") and post.get("video"):
        try:
            media_url = storage_upload(os.path.join(MKT, post["video"]), os.path.basename(post["video"]))
            cap = post.get("caption") or {}
            text = (cap.get("ig_caption", "") + ("\n\n" + cap.get("hashtags", "") if cap.get("hashtags") else "")).strip()
            nets = b.get("networks") or ["instagram", "facebook", "tiktok"]
            sched = _santiago_iso(post["date"], post["time"])
            if post.get("cloud_id"):
                supabase_update_post(post["cloud_id"], {"scheduled_for": sched, "status": "pending",
                                                        "error": None, "media_url": media_url, "text": text})
                cloud = {"queued": True, "id": post["cloud_id"]}
            else:
                row = supabase_insert_post(post.get("name", ""), text, media_url, "video", nets, sched)
                post["cloud_id"] = row[0]["id"] if isinstance(row, list) and row else None
                save_data(d)
                cloud = {"queued": True, "id": post.get("cloud_id")}
        except Exception as e:
            cloud = {"queued": False, "error": str(e)[:200]}
    return {"ok": True, "cloud": cloud}

# Ritmo semanal (weekday 0=lunes): hora del slot
WEEKLY_SLOTS = {0: "13:00", 1: "19:30", 2: "10:00", 3: "13:00", 4: "19:00", 5: "11:00"}

@app.post("/api/autoschedule")
async def autoschedule(req: Request):
    d = load_data()
    taken = {(p.get("date"), p.get("time")) for p in d["posts"] if p.get("date")}
    pending = [p for p in d["posts"] if not p.get("date")]
    day = datetime.now().date()
    assigned = 0
    # busca slots libres hacia adelante (máx 60 días) para cada pieza sin fecha
    for p in pending:
        for _ in range(60):
            slot = WEEKLY_SLOTS.get(day.weekday())
            ds = day.strftime("%Y-%m-%d")
            if slot and (ds, slot) not in taken:
                p["date"], p["time"], p["status"] = ds, slot, "programado"
                taken.add((ds, slot))
                # MEZCLA DE CONTENIDO: asigna un tipo variado y refresca el caption a ese tipo.
                # Respeta el tipo si el usuario ya eligió uno a mano.
                if not p.get("angle"):
                    angle = CONTENT_MIX[assigned % len(CONTENT_MIX)]
                    p["angle"] = angle
                    try:
                        p["caption"] = _caption_for(p.get("name", ""), p.get("price", 0),
                                                    angle=angle, variant=assigned)
                    except Exception:
                        pass
                assigned += 1
                day += timedelta(days=1)
                break
            day += timedelta(days=1)
    save_data(d)
    return {"assigned": assigned}

@app.get("/api/export.csv")
def export_csv():
    d = load_data()
    rows = [p for p in d["posts"] if p.get("date")]
    rows.sort(key=lambda p: (p.get("date", ""), p.get("time", "")))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Fecha", "Hora", "Plataforma", "Texto", "Archivo"])
    for p in rows:
        cap = p.get("caption") or {}
        ig = (cap.get("ig_caption", "") + "\n\n" + cap.get("hashtags", "")).strip() or p["name"]
        tk = (cap.get("tiktok_text", "") + " " + cap.get("hashtags", "")).strip() or p["name"]
        w.writerow([p["date"], p["time"], "Instagram", ig, os.path.basename(p["image"])])
        w.writerow([p["date"], p["time"], "TikTok",    tk, os.path.basename(p["video"])])
    out = buf.getvalue()
    from fastapi.responses import Response
    return Response(out, media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=calendario-maravilloso.csv"})

# ---------- Lector de precios desde la BD Supabase ----------
SUPABASE_URL  = os.environ.get("SUPABASE_URL",  "https://ybonpeapvpdseqbtlysx.supabase.co")
# Prefiere la service key (server-side, salta RLS); si no, anon; si no, fallback público anon.
# La service key NUNCA va al cliente: este server es local.
SUPABASE_KEY = (os.environ.get("SUPABASE_SERVICE_KEY")
                or os.environ.get("SUPABASE_ANON_KEY")
                or "sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB")
PRODUCTS_CACHE = os.path.join(HERE, "products_cache.json")
_products_mem  = {"products": [], "cached_at": None}   # cache en memoria

import unicodedata

def _normaliza(s):
    """lower, sin tildes, sin signos, colapsa espacios."""
    s = s.lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def fetch_products(force=False):
    """Obtiene productos de Supabase; usa cache de disco/memoria si < 6h."""
    import urllib.request, urllib.parse, urllib.error
    global _products_mem

    now = datetime.now()
    # 1) Intentar servir desde memoria
    if not force and _products_mem["cached_at"]:
        age = (now - _products_mem["cached_at"]).total_seconds()
        if age < 6 * 3600 and _products_mem["products"]:
            return _products_mem

    # 2) Intentar servir desde cache de disco
    disk_ok = False
    if not force and os.path.exists(PRODUCTS_CACHE):
        try:
            disk = json.load(open(PRODUCTS_CACHE, encoding="utf-8"))
            cached_at_str = disk.get("cached_at")
            if cached_at_str:
                cached_at = datetime.fromisoformat(cached_at_str)
                age = (now - cached_at).total_seconds()
                if age < 6 * 3600 and disk.get("products"):
                    _products_mem = {"products": disk["products"], "cached_at": cached_at}
                    return _products_mem
                disk_ok = bool(disk.get("products"))  # hay datos viejos como fallback
        except Exception:
            disk_ok = False

    # 3) Ir a la red
    # Catálogo real = vista marketing_catalog (derivada de Eleventa: producto + precio
    # de su venta más reciente). Privada, solo legible con la service key.
    url = (f"{SUPABASE_URL}/rest/v1/marketing_catalog"
           f"?select=name,salePrice,last_sold,times_sold"
           f"&order=name")
    req = urllib.request.Request(url, headers={
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            products = json.loads(r.read())
        result = {"products": products, "cached_at": now.isoformat()}
        _products_mem = {"products": products, "cached_at": now}
        json.dump(result, open(PRODUCTS_CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        return _products_mem
    except Exception:
        # Degradar elegante: devolver cache viejo si existe
        if os.path.exists(PRODUCTS_CACHE):
            try:
                disk = json.load(open(PRODUCTS_CACHE, encoding="utf-8"))
                if disk.get("products"):
                    _products_mem = {"products": disk["products"],
                                     "cached_at": datetime.fromisoformat(disk["cached_at"]) if disk.get("cached_at") else None}
                    return _products_mem
            except Exception:
                pass
        return {"products": [], "cached_at": None}

@app.get("/api/products")
def api_products(refresh: int = 0):
    data = fetch_products(force=bool(refresh))
    cached_at = data["cached_at"].isoformat() if isinstance(data["cached_at"], datetime) else (data["cached_at"] or "")
    return {"products": data["products"], "count": len(data["products"]), "cached_at": cached_at}

def _match_price(query: str, products: list):
    """Devuelve (mejor_match|None, [candidatos hasta 5])."""
    q = _normaliza(query)
    q_words = set(q.split())
    if not q or not products:
        return None, []

    scored = []
    for p in products:
        name = p.get("name") or ""
        n = _normaliza(name)
        n_words = set(n.split())

        # exacto
        if q == n:
            scored.append((100, p))
            continue
        # todas las palabras del query en el nombre
        if q_words and q_words.issubset(n_words):
            scored.append((90, p))
            continue
        # substring
        if q in n or n in q:
            scored.append((70, p))
            continue
        # token overlap
        overlap = len(q_words & n_words)
        if overlap:
            scored.append((overlap, p))

    scored.sort(key=lambda x: -x[0])
    candidates = [p for _, p in scored[:5]]
    best = candidates[0] if candidates else None
    # no devolver match si el score es muy bajo (solo 1 token y hay muchos)
    if scored and scored[0][0] < 1:
        best = None
    return best, candidates

@app.get("/api/match-price")
def api_match_price(q: str = ""):
    data = fetch_products()
    best, candidates = _match_price(q, data["products"])
    def slim(p):
        return {"name": p.get("name"), "salePrice": p.get("salePrice")} if p else None
    return {
        "match":      slim(best),
        "candidates": [slim(p) for p in candidates if p],
    }

# ---------- Publicación en Instagram (Graph API) ----------
import urllib.request, urllib.parse, urllib.error, time
GRAPH = "https://graph.facebook.com/v21.0"

def _ig_api(method, path, params):
    url = f"{GRAPH}/{path}"
    if method == "GET":
        url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, method="GET")
    else:
        req = urllib.request.Request(url, data=urllib.parse.urlencode(params).encode(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode("utf-8", "ignore")).get("error", {}).get("message", "")
        except Exception:
            msg = "error de Graph API"
        raise RuntimeError(msg or f"HTTP {e.code}")

def public_url(local_rel):
    """URL pública de una pieza, para que Instagram la pueda bajar."""
    base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
    return f"{base}/{local_rel}" if base else None

# ---------- OAuth con Facebook: conectar Instagram con 1 clic ----------
FB_REDIRECT = os.environ.get("FB_REDIRECT_URI", "http://localhost:8000/api/fb-callback")
# Scopes ACTIVOS hoy (publicar IG+FB + DMs). Para métricas/comentarios agregar luego en la app:
#   instagram_manage_insights, instagram_manage_comments (+ pages_messaging para webhooks)
FB_SCOPES = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,pages_manage_posts,read_insights,instagram_manage_insights,instagram_manage_comments,business_management,instagram_manage_messages"
IG_AUTH_FILE = os.path.join(HERE, "ig_auth.json")

def load_ig_auth():
    if os.path.exists(IG_AUTH_FILE):
        try: return json.load(open(IG_AUTH_FILE, encoding="utf-8"))
        except Exception: pass
    return {}

def get_ig_auth():
    """Token + IG user id: primero del OAuth guardado, si no del .env."""
    a = load_ig_auth()
    token = a.get("access_token") or os.environ.get("IG_TOKEN")
    ig_id = a.get("ig_user_id") or os.environ.get("IG_USER_ID")
    return token, ig_id

def get_page_auth():
    """Page id + page access token para publicar en Facebook.
    Usa lo guardado en ig_auth.json; si falta el page token, lo deriva del user
    token vía me/accounts (requiere que el token tenga pages_show_list)."""
    a = load_ig_auth()
    page_id = a.get("page_id") or os.environ.get("FB_PAGE_ID")
    page_token = a.get("page_token")
    if page_id and page_token:
        return page_id, page_token
    user_token = a.get("access_token") or os.environ.get("IG_TOKEN")
    if not user_token:
        return None, None
    try:
        pages = _ig_api("GET", "me/accounts",
                        {"fields": "name,access_token,instagram_business_account", "access_token": user_token})
        for pg in pages.get("data", []):
            if pg.get("instagram_business_account") or page_id is None:
                page_id = pg.get("id")
                page_token = pg.get("access_token")
        # cachear en ig_auth.json para próximas veces
        if page_id and page_token:
            a["page_id"] = page_id; a["page_token"] = page_token
            json.dump(a, open(IG_AUTH_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    except Exception:
        return None, None
    return page_id, page_token

@app.get("/api/fb-connect")
def fb_connect():
    app_id = os.environ.get("FB_APP_ID")
    if not app_id:
        return JSONResponse({"error": "Falta FB_APP_ID en el .env"}, status_code=400)
    url = ("https://www.facebook.com/v21.0/dialog/oauth?"
           + urllib.parse.urlencode({"client_id": app_id, "redirect_uri": FB_REDIRECT,
                                     "scope": FB_SCOPES, "response_type": "code",
                                     # fuerza a FB a re-pedir TODOS los permisos (incluidos los nuevos)
                                     # aunque la app ya estuviera autorizada antes
                                     "auth_type": "rerequest"}))
    return RedirectResponse(url)

def _get_json(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read())

@app.get("/api/fb-callback")
def fb_callback(code: str = "", error: str = "", error_reason: str = "",
                error_code: str = "", error_description: str = ""):
    if error or not code:
        detalle = (f"<b>error:</b> {error or '(vacío)'}<br>"
                   f"<b>error_reason:</b> {error_reason or '(vacío)'}<br>"
                   f"<b>error_code:</b> {error_code or '(vacío)'}<br>"
                   f"<b>error_description:</b> {error_description or '(vacío)'}")
        hint = ("<p style='color:#555;max-width:520px;margin:18px auto'>Si dice <code>access_denied</code> sin más, "
                "casi siempre es que tu usuario de Facebook <b>no es Administrador de la app</b> en developers.facebook.com "
                "(Configuración → Roles), o que la app aún no tiene activada la <b>API de Instagram con inicio de sesión de Facebook</b> "
                "con los permisos instagram_basic / instagram_content_publish.</p>")
        return HTMLResponse(f"<div style='font-family:sans-serif;text-align:center;padding:50px'>"
                            f"<h2>Conexión no completada</h2><p style='font-family:monospace;text-align:left;"
                            f"display:inline-block;background:#f5f5f5;padding:16px 20px;border-radius:10px'>{detalle}</p>"
                            f"{hint}</div>")
    app_id = os.environ.get("FB_APP_ID"); secret = os.environ.get("FB_APP_SECRET")
    if not app_id or not secret:
        return HTMLResponse("<h2 style='font-family:sans-serif'>Falta FB_APP_ID o FB_APP_SECRET en el .env</h2>")
    try:
        # 1) code -> token corto
        short = _get_json(f"{GRAPH}/oauth/access_token?" + urllib.parse.urlencode(
            {"client_id": app_id, "redirect_uri": FB_REDIRECT, "client_secret": secret, "code": code}))["access_token"]
        # 2) token corto -> largo (60 días)
        lon = _get_json(f"{GRAPH}/oauth/access_token?" + urllib.parse.urlencode(
            {"grant_type": "fb_exchange_token", "client_id": app_id, "client_secret": secret, "fb_exchange_token": short}))
        token = lon["access_token"]
        # 3) IG user id + página FB (id + page token) desde la página vinculada
        pages = _get_json(f"{GRAPH}/me/accounts?" + urllib.parse.urlencode(
            {"fields": "name,access_token,instagram_business_account", "access_token": token}))
        ig_id = page_id = page_token = page_name = None
        for pg in pages.get("data", []):
            # Preferir la página que tiene Instagram vinculado; si no, la primera
            if pg.get("instagram_business_account") or page_id is None:
                page_id = pg.get("id")
                page_token = pg.get("access_token")
                page_name = pg.get("name")
                if pg.get("instagram_business_account"):
                    ig_id = pg["instagram_business_account"]["id"]
        json.dump({"access_token": token, "ig_user_id": ig_id,
                   "page_id": page_id, "page_token": page_token, "page_name": page_name,
                   "expires_in": lon.get("expires_in"),
                   "connected_at": datetime.now().strftime("%Y-%m-%d %H:%M")},
                  open(IG_AUTH_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        ok = "✅ Instagram conectado" if ig_id else "⚠️ Conectado, pero no se encontró cuenta de Instagram en la página"
        return HTMLResponse(f"<div style='font-family:sans-serif;text-align:center;padding:60px'><h1>{ok}</h1>"
                            f"<p>IG ID: {ig_id or '—'}<br>Token de 60 días guardado.</p>"
                            f"<p>Cierra esta pestaña y vuelve al Estudio. El botón <b>Publicar en IG</b> ya funciona. 🎉</p></div>")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        return HTMLResponse(f"<div style='font-family:sans-serif;padding:40px'><h2>Error al conectar</h2><pre>{body[:600]}</pre></div>")

@app.get("/api/ig-status")
def ig_status():
    token, ig_id = get_ig_auth()
    a = load_ig_auth()
    return {"connected": bool(token and ig_id), "ig_user_id": ig_id, "connected_at": a.get("connected_at"),
            "fb_connected": bool(a.get("page_id") and a.get("page_token")),
            "page_name": a.get("page_name")}

@app.post("/api/publish")
async def publish(req: Request):
    b = await req.json()
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return JSONResponse({"error": "no_token"}, status_code=400)
    d = load_data()
    post = next((p for p in d["posts"] if p["slug"] == b.get("slug")), None)
    if not post:
        return JSONResponse({"error": "post no encontrado"}, status_code=404)
    cap = post.get("caption") or {}
    caption = (cap.get("ig_caption", "") + "\n\n" + cap.get("hashtags", "")).strip() or post["name"]
    kind = b.get("kind", "reel")  # 'reel' (video) o 'photo' (imagen)
    rel = post["video"] if kind == "reel" else post["image"]
    try:
        media = storage_upload(os.path.join(MKT, rel), os.path.basename(rel))  # Supabase (Vercel /marketing está 404)
    except Exception as e:
        return JSONResponse({"error": "no se pudo hospedar el media: " + str(e)[:120]}, status_code=500)
    try:
        if kind == "reel":
            cont = _ig_api("POST", f"{ig_id}/media",
                           {"media_type": "REELS", "video_url": media, "caption": caption, "access_token": token})
        else:
            cont = _ig_api("POST", f"{ig_id}/media",
                           {"image_url": media, "caption": caption, "access_token": token})
        cid = cont["id"]
        # Reels: esperar a que Instagram procese el video antes de publicar
        for _ in range(40):
            st = _ig_api("GET", cid, {"fields": "status_code", "access_token": token})
            code = st.get("status_code")
            if code == "FINISHED":
                break
            if code == "ERROR":
                return JSONResponse({"error": "Instagram no pudo procesar el video"}, status_code=500)
            time.sleep(3)
        pub = _ig_api("POST", f"{ig_id}/media_publish", {"creation_id": cid, "access_token": token})
        post["status"] = "publicado"
        save_data(d)
        return {"ok": True, "id": pub.get("id")}
    except Exception as e:
        return JSONResponse({"error": str(e)[:180]}, status_code=500)

@app.post("/api/publish-fb")
async def publish_fb(req: Request):
    """Publica en la página de Facebook (foto o video) con el page token."""
    b = await req.json()
    page_id, page_token = get_page_auth()
    if not page_id or not page_token:
        return JSONResponse({"error": "no_page"}, status_code=400)
    d = load_data()
    post = next((p for p in d["posts"] if p["slug"] == b.get("slug")), None)
    if not post:
        return JSONResponse({"error": "post no encontrado"}, status_code=404)
    cap = post.get("caption") or {}
    msg = (cap.get("ig_caption", "") + "\n\n" + cap.get("hashtags", "")).strip() or post["name"]
    kind = b.get("kind", "photo")  # 'video' o 'photo'
    rel = post["video"] if kind == "video" else post["image"]
    try:
        media = storage_upload(os.path.join(MKT, rel), os.path.basename(rel))  # Supabase (Vercel /marketing está 404)
    except Exception as e:
        return JSONResponse({"error": "no se pudo hospedar el media: " + str(e)[:120]}, status_code=500)
    try:
        if kind == "video":
            res = _ig_api("POST", f"{page_id}/videos",
                          {"file_url": media, "description": msg, "access_token": page_token})
        else:
            res = _ig_api("POST", f"{page_id}/photos",
                          {"url": media, "caption": msg, "access_token": page_token})
        post["status_fb"] = "publicado"
        save_data(d)
        return {"ok": True, "id": res.get("id") or res.get("post_id")}
    except Exception as e:
        return JSONResponse({"error": str(e)[:180]}, status_code=500)

@app.get("/api/ig-id")
def ig_id_helper():
    """Saca tu Instagram Business Account ID a partir del token (con la página vinculada)."""
    token = os.environ.get("IG_TOKEN")
    if not token:
        return JSONResponse({"error": "no_token"}, status_code=400)
    try:
        pages = _ig_api("GET", "me/accounts", {"fields": "name,instagram_business_account", "access_token": token})
        out = []
        for pg in pages.get("data", []):
            iba = pg.get("instagram_business_account", {})
            if iba:
                out.append({"pagina": pg.get("name"), "ig_user_id": iba.get("id")})
        return {"cuentas": out}
    except Exception as e:
        return JSONResponse({"error": str(e)[:180]}, status_code=500)

# ---------- Métricas orgánicas Instagram (Graph API) ----------

INSIGHTS_SNAPSHOTS = os.path.join(HERE, "insights_snapshots.json")

def _load_snapshots():
    if os.path.exists(INSIGHTS_SNAPSHOTS):
        try: return json.load(open(INSIGHTS_SNAPSHOTS, encoding="utf-8"))
        except Exception: pass
    return {"snapshots": []}

def _save_snapshot_today(followers: int):
    """Guarda (o actualiza) el snapshot de hoy y devuelve la serie ordenada."""
    data = _load_snapshots()
    today = datetime.now().strftime("%Y-%m-%d")
    snaps = [s for s in data.get("snapshots", []) if s.get("date") != today]
    snaps.append({"date": today, "followers": followers})
    snaps.sort(key=lambda s: s["date"])
    data["snapshots"] = snaps
    json.dump(data, open(INSIGHTS_SNAPSHOTS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return snaps

def _get_metric_value(ig_id, token, metric, period):
    """Intenta obtener una métrica de insights; devuelve (valor|None)."""
    # intento 1: metric_type total_value con el period pedido
    try:
        r = _ig_api("GET", f"{ig_id}/insights",
                    {"metric": metric, "period": period,
                     "metric_type": "total_value", "access_token": token})
        return r["data"][0]["total_value"]["value"]
    except Exception:
        pass
    # intento 2: period=day, suma values
    try:
        r = _ig_api("GET", f"{ig_id}/insights",
                    {"metric": metric, "period": "day", "access_token": token})
        return sum(v.get("value", 0) for item in r.get("data", []) for v in item.get("values", []))
    except Exception:
        return None

@app.get("/api/insights/account")
def insights_account(period: str = "days_28"):
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False}
    # perfil
    try:
        profile_raw = _ig_api("GET", ig_id,
            {"fields": "username,followers_count,follows_count,media_count,name,profile_picture_url",
             "access_token": token})
    except Exception as e:
        return JSONResponse({"error": str(e)[:180]}, status_code=502)

    followers = profile_raw.get("followers_count")
    profile = {
        "username": profile_raw.get("username"),
        "followers": followers,
        "following": profile_raw.get("follows_count"),
        "media_count": profile_raw.get("media_count"),
        "name": profile_raw.get("name"),
        "profile_picture_url": profile_raw.get("profile_picture_url"),
    }

    # snapshot de seguidores de hoy
    series = []
    if followers is not None:
        try: series = _save_snapshot_today(int(followers))
        except Exception: pass

    # métricas (cada una defensiva)
    metric_names = ["reach", "profile_views", "accounts_engaged",
                    "total_interactions", "likes", "comments", "views"]
    metrics = {}
    for m in metric_names:
        try:
            metrics[m] = _get_metric_value(ig_id, token, m, period)
        except Exception:
            metrics[m] = None

    # engagement_rate
    er = None
    ti = metrics.get("total_interactions")
    reach = metrics.get("reach")
    try:
        if ti is not None and reach and reach > 0:
            er = round(ti / reach * 100, 1)
        elif ti is not None and followers and followers > 0:
            er = round(ti / followers * 100, 1)
    except Exception:
        er = None

    return {"connected": True, "profile": profile, "period": period,
            "metrics": metrics, "engagement_rate": er}

@app.get("/api/insights/growth")
def insights_growth():
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False, "series": []}
    data = _load_snapshots()
    return {"connected": True, "series": data.get("snapshots", [])}

def _fetch_media_with_insights(ig_id, token, limit=12):
    """Devuelve lista de posts con métricas individuales (defensivo)."""
    try:
        media_raw = _ig_api("GET", f"{ig_id}/media",
            {"fields": "id,caption,media_type,media_product_type,timestamp,"
                       "permalink,like_count,comments_count,thumbnail_url,media_url",
             "limit": limit, "access_token": token})
    except Exception:
        return []

    result = []
    for m in media_raw.get("data", []):
        mid = m.get("id")
        mtype = m.get("media_type", "")
        mptype = m.get("media_product_type", "")
        is_video = mptype == "REELS" or mtype == "VIDEO"

        if is_video:
            metrics_req = "reach,views,likes,comments,shares,saved,total_interactions"
            minimal_req = "reach,views"
        else:
            metrics_req = "reach,total_interactions,likes,comments,saved,shares"
            minimal_req = "reach"

        ins = {}
        try:
            ins_raw = _ig_api("GET", f"{mid}/insights",
                              {"metric": metrics_req, "access_token": token})
            for item in ins_raw.get("data", []):
                vals = item.get("values") or []
                ins[item["name"]] = vals[0]["value"] if vals else item.get("value")
        except Exception:
            # reintento con set mínimo
            try:
                ins_raw = _ig_api("GET", f"{mid}/insights",
                                  {"metric": minimal_req, "access_token": token})
                for item in ins_raw.get("data", []):
                    vals = item.get("values") or []
                    ins[item["name"]] = vals[0]["value"] if vals else item.get("value")
            except Exception:
                pass

        cap = (m.get("caption") or "")[:120]
        likes = ins.get("likes") if ins.get("likes") is not None else m.get("like_count")
        comments = ins.get("comments") if ins.get("comments") is not None else m.get("comments_count")
        reach_v = ins.get("reach")
        total_int = ins.get("total_interactions")

        er = None
        try:
            if total_int is not None and reach_v and reach_v > 0:
                er = round(total_int / reach_v * 100, 1)
        except Exception:
            pass

        result.append({
            "id": mid,
            "caption": cap,
            "media_type": mtype,
            "timestamp": m.get("timestamp"),
            "permalink": m.get("permalink"),
            "thumbnail": m.get("thumbnail_url") or m.get("media_url"),
            "likes": likes,
            "comments": comments,
            "reach": reach_v,
            "views": ins.get("views"),
            "total_interactions": total_int,
            "engagement_rate": er,
        })

    # ordenar por timestamp desc
    result.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return result

@app.get("/api/insights/media")
def insights_media(limit: int = 12):
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False, "media": []}
    media = _fetch_media_with_insights(ig_id, token, limit)
    return {"connected": True, "media": media}

@app.get("/api/insights/besttimes")
def insights_besttimes():
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False,
                "by_weekday": [], "by_hour": [],
                "best": {"weekday_label": None, "hour": None}}

    media = _fetch_media_with_insights(ig_id, token, limit=30)

    LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

    # acumuladores por (weekday, hour)
    from collections import defaultdict
    wd_reach  = defaultdict(list)
    wd_eng    = defaultdict(list)
    hr_reach  = defaultdict(list)
    combo     = defaultdict(lambda: {"reach": [], "eng": []})

    for m in media:
        ts = m.get("timestamp")
        if not ts:
            continue
        try:
            # parsea ISO 8601 con offset (ej: 2024-03-01T14:30:00+0000)
            ts_clean = ts.replace("Z", "+00:00")
            # Python 3.7+ fromisoformat no soporta +0000 sin los dos puntos
            if len(ts_clean) >= 5 and ts_clean[-5] in ("+", "-") and ":" not in ts_clean[-5:]:
                ts_clean = ts_clean[:-2] + ":" + ts_clean[-2:]
            dt = datetime.fromisoformat(ts_clean)
            wd = dt.weekday()   # 0=lunes
            hr = dt.hour
        except Exception:
            continue

        r = m.get("reach") or 0
        e = m.get("total_interactions") or 0

        wd_reach[wd].append(r)
        wd_eng[wd].append(e)
        hr_reach[hr].append(r)
        combo[(wd, hr)]["reach"].append(r)
        combo[(wd, hr)]["eng"].append(e)

    def avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else 0.0

    by_weekday = []
    for i in range(7):
        by_weekday.append({
            "weekday": i,
            "label": LABELS[i],
            "avg_reach": avg(wd_reach[i]),
            "avg_engagement": avg(wd_eng[i]),
            "posts": len(wd_reach[i]),
        })

    by_hour = [
        {"hour": h, "avg_reach": avg(hr_reach[h]), "posts": len(hr_reach[h])}
        for h in sorted(hr_reach.keys())
    ]

    # mejor combinación (weekday, hour) por avg_reach
    best_wd_label = None
    best_hr = None
    if combo:
        best_key = max(combo.keys(), key=lambda k: avg(combo[k]["reach"]))
        best_wd_label = LABELS[best_key[0]]
        best_hr = best_key[1]

    return {
        "connected": True,
        "by_weekday": by_weekday,
        "by_hour": by_hour,
        "best": {"weekday_label": best_wd_label, "hour": best_hr},
    }


# ---------- INBOX: comentarios y DMs de Instagram ----------

def _ig_post_json(path, payload, token):
    """POST a Graph API con cuerpo JSON (para endpoints que no aceptan urlencode)."""
    url = f"{GRAPH}/{path}?access_token={urllib.parse.quote(token, safe='')}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode("utf-8", "ignore")).get("error", {}).get("message", "")
        except Exception:
            msg = ""
        raise RuntimeError(msg or f"HTTP {e.code}")

def ai_reply(context_text, kind):
    """Genera borrador de respuesta en voz de marca (Haiku, barato)."""
    import anthropic
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        raise RuntimeError("no_key")
    client = anthropic.Anthropic(api_key=key)
    kind_rules = (
        "Estás respondiendo un COMENTARIO en una publicación de Instagram. "
        "Sé breve (1-2 frases), agradece o valida, e invita a pasar por el local o escribir por DM."
        if kind == "comment" else
        "Estás respondiendo un DM (mensaje directo) de Instagram. "
        "Sé breve (1-3 frases), resuelve la duda del cliente y orienta a compra o despacho."
    )
    system = (
        "Eres el community manager de Distribuidora El Maravilloso (Hualpén, Chile). "
        "Escribes en español chileno informal y cercano. "
        "NUNCA menciones fiado ni crédito. "
        f"{kind_rules} "
        "Devuelve SOLO el texto de la respuesta, sin comillas ni explicaciones.\n\n"
        "Voz de marca:\n" + BRAND_MD
    )
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=120,
        system=system,
        messages=[{"role": "user", "content": context_text}],
    )
    return next(b.text for b in msg.content if b.type == "text").strip()

# --- Comentarios ---

@app.get("/api/inbox/comments")
def inbox_comments(limit: int = 8):
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False}
    # medias recientes
    try:
        medias_raw = _ig_api("GET", f"{ig_id}/media",
            {"fields": "id,permalink,thumbnail_url,media_url,caption",
             "limit": limit, "access_token": token})
    except Exception:
        return {"connected": True, "comments": []}

    comments = []
    for m in medias_raw.get("data", []):
        mid = m.get("id")
        thumb = m.get("thumbnail_url") or m.get("media_url")
        permalink = m.get("permalink")
        try:
            c_raw = _ig_api("GET", f"{mid}/comments",
                {"fields": "id,text,username,timestamp,like_count,replies{id,text,username}",
                 "access_token": token})
        except Exception:
            continue  # saltar esta media si falla
        for c in c_raw.get("data", []):
            replies = (c.get("replies") or {}).get("data", [])
            replied = len(replies) > 0
            comments.append({
                "id": c.get("id"),
                "media_id": mid,
                "media_thumbnail": thumb,
                "media_permalink": permalink,
                "text": c.get("text"),
                "username": c.get("username"),
                "timestamp": c.get("timestamp"),
                "like_count": c.get("like_count", 0),
                "replied": replied,
            })

    comments.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return {"connected": True, "comments": comments}

@app.post("/api/inbox/comment-reply")
async def inbox_comment_reply(req: Request):
    b = await req.json()
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False}
    comment_id = b.get("comment_id")
    message = b.get("message", "")
    try:
        r = _ig_api("POST", f"{comment_id}/replies",
                    {"message": message, "access_token": token})
        return {"ok": True, "id": r.get("id")}
    except Exception as e:
        return JSONResponse({"error": str(e)[:200]}, status_code=500)

@app.post("/api/inbox/comment-hide")
async def inbox_comment_hide(req: Request):
    b = await req.json()
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False}
    comment_id = b.get("comment_id")
    hide = "true" if b.get("hide") else "false"
    try:
        _ig_api("POST", f"{comment_id}", {"hide": hide, "access_token": token})
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"error": str(e)[:200]}, status_code=500)

# --- DMs / Conversaciones ---

@app.get("/api/inbox/conversations")
def inbox_conversations(limit: int = 20):
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False}
    try:
        conv_raw = _ig_api("GET", f"{ig_id}/conversations",
            {"platform": "instagram",
             "fields": "participants,updated_time,messages.limit(15){message,from,created_time}",
             "limit": limit, "access_token": token})
    except Exception:
        return {"connected": True, "conversations": []}

    conversations = []
    for conv in conv_raw.get("data", []):
        # participante que NO es ig_id
        participants = (conv.get("participants") or {}).get("data", [])
        other = next((p for p in participants if str(p.get("id")) != str(ig_id)), None)
        user_id = other.get("id") if other else None
        username = other.get("username") or other.get("name") if other else None

        # mensajes en orden cronológico
        msgs_raw = (conv.get("messages") or {}).get("data", [])
        messages = []
        for msg in msgs_raw:
            frm = msg.get("from") or {}
            messages.append({
                "text": msg.get("message"),
                "from_me": str(frm.get("id")) == str(ig_id),
                "time": msg.get("created_time"),
            })
        messages.sort(key=lambda x: x.get("time") or "")
        last_message = messages[-1]["text"] if messages else None

        conversations.append({
            "id": conv.get("id"),
            "user_id": user_id,
            "username": username,
            "updated_time": conv.get("updated_time"),
            "last_message": last_message,
            "messages": messages,
        })

    conversations.sort(key=lambda x: x.get("updated_time") or "", reverse=True)
    return {"connected": True, "conversations": conversations}

@app.post("/api/inbox/dm-reply")
async def inbox_dm_reply(req: Request):
    b = await req.json()
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False}
    recipient_id = b.get("recipient_id")
    message = b.get("message", "")
    try:
        _ig_post_json(f"{ig_id}/messages",
                      {"recipient": {"id": recipient_id}, "message": {"text": message}},
                      token)
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"error": str(e)[:300]}, status_code=500)

@app.post("/api/inbox/ai-reply")
async def inbox_ai_reply(req: Request):
    b = await req.json()
    context = b.get("context", "")
    kind = b.get("kind", "comment")
    try:
        reply = ai_reply(context, kind)
        return {"reply": reply}
    except RuntimeError as e:
        if "no_key" in str(e):
            return JSONResponse({"error": "no_key"}, status_code=400)
        return JSONResponse({"error": "fallo"}, status_code=500)
    except Exception:
        return JSONResponse({"error": "fallo"}, status_code=500)

def open_browser():
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    import uvicorn
    print("\n  🎬  Estudio El Maravilloso  ->  http://127.0.0.1:8000\n")
    threading.Timer(1.2, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
