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
METRICS_HISTORY = os.path.join(HERE, "metrics_history.json")
GOALS_PATH = os.path.join(HERE, "goals.json")
RECURRING_PATH = os.path.join(HERE, "recurring_templates.json")

def load_recurring():
    if os.path.exists(RECURRING_PATH):
        try: return json.load(open(RECURRING_PATH, encoding="utf-8"))
        except Exception: pass
    return {"templates": []}

def save_recurring(d):
    json.dump(d, open(RECURRING_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

def load_goals():
    if os.path.exists(GOALS_PATH):
        try: return json.load(open(GOALS_PATH, encoding="utf-8"))
        except Exception: pass
    return {"goals": [
        {"id": "posts_month", "label": "Posts este mes", "target": 15, "unit": "posts", "period": "monthly"},
        {"id": "followers", "label": "Seguidores", "target": 200, "unit": "seguidores", "period": "milestone"},
        {"id": "avg_er", "label": "ER promedio", "target": 3.0, "unit": "%", "period": "monthly"},
    ]}

def save_goals(d):
    json.dump(d, open(GOALS_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

for d in (ENTRADA, CUTS, IMG_OUT, VID_OUT):
    os.makedirs(d, exist_ok=True)

from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Estudio El Maravilloso")

class NoCacheStatic(StaticFiles):
    """Sirve los archivos forzando al navegador a revalidar SIEMPRE.
    Sin esto, al regenerar una pieza (mismo nombre/URL) el navegador mostraba
    la versión vieja en caché -> parecía que el logo/diseño no cambiaba."""
    def file_response(self, *args, **kwargs):
        resp = super().file_response(*args, **kwargs)
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp

app.mount("/files", NoCacheStatic(directory=MKT), name="files")

IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")

def load_data():
    if os.path.exists(DATA):
        try: return json.load(open(DATA, encoding="utf-8"))
        except Exception: pass
    return {"posts": []}

def save_data(d):
    json.dump(d, open(DATA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

def load_metrics_history():
    if os.path.exists(METRICS_HISTORY):
        try: return json.load(open(METRICS_HISTORY, encoding="utf-8"))
        except Exception: pass
    return {"posts": {}}

def save_metrics_history(d):
    json.dump(d, open(METRICS_HISTORY, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

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


@app.post("/api/preview-styles")
async def preview_styles(req: Request):
    """Renderiza una MINIATURA estática (feed 1:1) de cada estilo para elegir antes de generar."""
    b = await req.json()
    fname  = b["filename"]
    name   = b.get("name") or os.path.splitext(fname)[0]
    price  = int(re.sub(r"[^0-9]", "", str(b.get("price", "0"))) or 0)
    rem_bg = bool(b.get("remove_bg", False))
    src = os.path.join(ENTRADA, fname)
    if not os.path.exists(src):
        return JSONResponse({"error": "foto no encontrada"}, status_code=404)
    product = maybe_cut(src, rem_bg)
    slug = (slugify(name) + (f"-{price}" if price else "") + "-prev")[:60]
    STYLE_ALIAS = {"dark": "premium_dark", "giant": "premium_giant", "split": "premium_split"}
    LABELS = [("premium", "Premium"), ("dark", "Dark"), ("giant", "Gigante"),
              ("split", "Split"), ("clasica", "Clásica")]
    prevdir = os.path.join(MKT, "content", "_previews")
    os.makedirs(prevdir, exist_ok=True)
    out = []
    for st, label in LABELS:
        drawer = T.STYLES.get(STYLE_ALIAS.get(st, st), T.style_premium)
        tag = "OFERTA" if st == "premium" else "OFERTA DE LA SEMANA"
        try:
            im = drawer(name, price, product, tag=tag, fmt="feed").convert("RGB")
        except TypeError:
            im = drawer(name, price, product, tag=tag).convert("RGB")
        im.thumbnail((440, 440))
        rel = f"content/_previews/{slug}-{st}.jpg"
        im.save(os.path.join(MKT, rel), quality=82, optimize=True)
        out.append({"style": st, "label": label, "url": "/files/" + rel})
    return JSONResponse({"styles": out})


def _gen_amigable_thread(slug, name, headline, pal, items, post_base, img_path, cover_path, vid_path):
    """Genera el estilo AMIGABLE multi-producto: imagen feed (1:1) + story (9:16) + video 9:16."""
    try:
        GEN_PROGRESS[slug] = {"pct": 0, "done": False, "error": None, "post": None}
        prods = [{"path": it["path"], "price": it["price"], "name": it["name"], "gram": it.get("gram")} for it in items]
        # imágenes en sus dos tamaños
        T.style_amigable(name, 0, prods, pal=pal, headline=headline, fmt2="feed").convert("RGB").save(img_path, quality=92, optimize=True)
        T.style_amigable(name, 0, prods, pal=pal, headline=headline, fmt2="story").convert("RGB").save(cover_path, quality=92, optimize=True)
        GEN_PROGRESS[slug].update(pct=20)
        # video 9:16 (reel/story/tiktok)
        tx = load_textos()
        args = argparse.Namespace(
            product=items[0]["path"], name=name, price="0", out=vid_path, tag="OFERTA", seconds=6.0,
            style="amigable", footer=tx.get("footer") or None, cta_text=tx.get("cta") or None,
            pal=pal, headline=headline, items=json.dumps(prods), products=None,
            price_old=None, unit="c/u", seed=None, _auto_look=False, audio="on", cta="on",
            on_progress=lambda p: GEN_PROGRESS[slug].update(pct=20 + int(p * 0.8)))
        MV.render(args)
        post = dict(post_base)
        post.update({"image": rel(img_path), "cover": rel(cover_path), "video": rel(vid_path), "status": "listo"})
        d = load_data()
        d["posts"] = [p for p in d["posts"] if p.get("slug") != slug]
        d["posts"].insert(0, post)
        save_data(d)
        GEN_PROGRESS[slug].update(done=True, post=post, pct=100)
    except Exception as e:
        import traceback; traceback.print_exc()
        GEN_PROGRESS[slug].update(done=True, error=str(e)[:300], pct=100)


@app.post("/api/generate-amigable")
async def generate_amigable(req: Request):
    """Pieza AMIGABLE con 1..3 productos, cada uno con su precio y gramaje."""
    b = await req.json()
    items_in = b.get("items") or []
    rem_bg = bool(b.get("remove_bg", True))
    pal = b.get("pal", "marca")
    headline = b.get("headline") or None
    items = []
    for it in items_in[:3]:
        src = os.path.join(ENTRADA, it.get("filename", ""))
        if not os.path.exists(src):
            continue
        items.append({"path": maybe_cut(src, rem_bg),
                      "name": (it.get("name") or os.path.splitext(it["filename"])[0]),
                      "price": int(re.sub(r"[^0-9]", "", str(it.get("price", "0"))) or 0),
                      "gram": (it.get("gram") or None)})
    if not items:
        return JSONResponse({"error": "fotos no encontradas"}, status_code=404)
    name = b.get("name") or ("Ofertas de la semana" if len(items) > 1 else items[0]["name"])
    slug = slugify(name) + "-" + datetime.now().strftime("%H%M%S")
    img_path = os.path.join(IMG_OUT, slug + ".png")
    cover_path = os.path.join(IMG_OUT, slug + "-story.png")
    vid_path = os.path.join(VID_OUT, slug + ".mp4")
    post_base = {"slug": slug, "name": name, "price": items[0]["price"], "style": "amigable", "tag": "OFERTA",
                 "date": "", "time": "", "created": datetime.now().strftime("%Y-%m-%d %H:%M")}
    threading.Thread(target=_gen_amigable_thread,
                     args=(slug, name, headline, pal, items, post_base, img_path, cover_path, vid_path),
                     daemon=True).start()
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
        "REGLAS DE ESTILO — copy HUMANO, que NO suene a IA:\n"
        "- Frases CORTAS y naturales, con saltos de línea. Como le hablas a un vecino, no como un anuncio.\n"
        "- EVITA los patrones típicos de IA: NO abras con pregunta retórica ('¿Frío?', '¿Buscas…?', '¿Sabías que…?'); "
        "NO uses muletillas vacías ('no hay nada mejor que', 'el aliado perfecto', 'no te lo pierdas', 'a solo'); "
        "NO cierres SIEMPRE igual con '📍 Te esperamos en Grecia 1841'.\n"
        "- EMOJIS: por defecto NINGUNO. Como mucho 1, y solo de vez en cuando. Muchos emojis delatan que es IA.\n"
        "- Arranca variando (no siempre igual). Aperturas que funcionan: 'Hoy llegaron…', 'Lo que más se llevó la gente esta semana…', "
        "'Nos quedan pocas unidades…', 'Dato para la once…', '¿Team Milo o café?', 'Un cliente nos pidió que avisáramos cuando llegara…', "
        "'Si tienes niños en la casa, esto siempre vuela.'\n"
        "- Nunca menciones fiado, crédito ni pago diferido.\n"
        "- Tono chileno cercano y natural, trato de tú. Nada acartonado ni jerga caricaturesca (no: bacán, al tiro, los cabros, harto, pa').\n"
        "- El nombre del producto en minúscula normal (Milo, no MILO). NUNCA asteriscos de markdown (**).\n"
        "- Menciona el precio UNA vez, claro. El CIERRE debe VARIAR y sonar natural: a veces 'escríbenos y te lo dejamos reservado', a veces 'pasa a buscarlo', a veces la zona ('si eres de Hualpén o Concepción…'). NO el mismo cierre en todas.\n"
        "- Mete con naturalidad el producto y la zona (Hualpén/Concepción) para alcance, sin forzar.\n"
        "- Público doble: consumo en casa y negocios que revenden.\n"
        "\nASÍ NO (suena a IA, EVÍTALO):\n"
        "\"¿Frío? ☕❄️ No hay nada mejor que una buena once con un vaso de Milo bien calentito. "
        "Esta semana tenemos Milo 1 kg a solo $7.190. 📍 Te esperamos en Grecia 1841, Hualpén o, si prefieres, escríbenos por DM.\"\n"
        "ASÍ SÍ (humano, natural, frases cortas, sin emojis de relleno):\n"
        "\"Con este frío un Milo caliente siempre salva la once.\n"
        "Tenemos la bolsa de 1 kg a $7.190.\n"
        "Si eres de Hualpén o Concepción, escríbenos y te lo dejamos reservado antes de que se acabe.\"\n"
        f"Momento actual (úsalo con naturalidad si calza, sin forzar): {momento}\n"
        "Usa esta ficha de marca como fuente de verdad:\n\n" + BRAND_MD
        + estilo_block
    )
    user = (
        f"Genera el contenido para este producto en oferta:"
        f"{angle_instruccion}\n\n"
        f"Producto: {name}\nPrecio: {precio}\n\n"
        f"Devuelve ÚNICAMENTE un JSON con exactamente estas 3 claves (nada más, sin texto extra):\n"
        f"- ig_caption: 2-4 líneas CORTAS con saltos de línea, humano y natural (NO patrón de IA, NO pregunta de gancho), "
        f"el precio una vez y un cierre VARIADO. Imita el ejemplo 'ASÍ SÍ'.\n"
        f"- tiktok_text: 1-2 líneas, punchy y directo, natural (no de anuncio).\n"
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
    # Limpia sangrías sueltas que a veces mete la IA (deja líneas pegadas a la izquierda)
    if cap.get("ig_caption"):
        cap["ig_caption"] = "\n".join(l.strip() for l in str(cap["ig_caption"]).splitlines()).strip()
    if cap.get("tiktok_text"):
        cap["tiktok_text"] = " ".join(str(cap["tiktok_text"]).split())
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

@app.post("/api/save-caption")
async def save_caption(req: Request):
    """Persiste una caption EDITADA A MANO por el usuario (antes los edits se perdían)."""
    b = await req.json()
    if not b.get("slug"):
        return JSONResponse({"error": "sin slug"}, status_code=400)
    d = load_data()
    ok = False
    for p in d["posts"]:
        if p["slug"] == b["slug"]:
            cap = p.get("caption") or {}
            if "ig_caption" in b:
                cap["ig_caption"] = str(b.get("ig_caption", ""))
                if "hashtags" in b:   # el textarea de IG ya trae los hashtags; no duplicar al publicar
                    cap["hashtags"] = str(b.get("hashtags", ""))
            if "tiktok_text" in b:
                cap["tiktok_text"] = str(b.get("tiktok_text", ""))
            p["caption"] = cap
            ok = True
    save_data(d)
    return {"ok": ok}

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
    cached = _cache_get("ig_status")
    if cached:
        return cached
    token, ig_id = get_ig_auth()
    a = load_ig_auth()
    result = {"connected": bool(token and ig_id), "ig_user_id": ig_id, "connected_at": a.get("connected_at"),
              "fb_connected": bool(a.get("page_id") and a.get("page_token")),
              "page_name": a.get("page_name")}
    _cache_set("ig_status", result)
    return result

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
    kind = b.get("kind", "reel")  # 'reel' | 'photo' | 'story'
    # Elegir archivo según tipo
    if kind == "reel":
        file_rel = post["video"]
    elif kind == "story":
        file_rel = post.get("cover") or post["image"]  # story = imagen 9:16
    else:
        file_rel = post["image"]  # photo = feed 1:1
    try:
        media = storage_upload(os.path.join(MKT, file_rel), os.path.basename(file_rel))
    except Exception as e:
        return JSONResponse({"error": "no se pudo hospedar el media: " + str(e)[:120]}, status_code=500)
    try:
        if kind == "reel":
            cont = _ig_api("POST", f"{ig_id}/media",
                           {"media_type": "REELS", "video_url": media, "caption": caption, "access_token": token})
        elif kind == "story":
            cont = _ig_api("POST", f"{ig_id}/media",
                           {"media_type": "STORIES", "image_url": media, "access_token": token})
        else:
            cont = _ig_api("POST", f"{ig_id}/media",
                           {"image_url": media, "caption": caption, "access_token": token})
        cid = cont["id"]
        # Esperar a que Instagram procese el media
        for _ in range(40):
            st = _ig_api("GET", cid, {"fields": "status_code", "access_token": token})
            code = st.get("status_code")
            if code == "FINISHED":
                break
            if code == "ERROR":
                return JSONResponse({"error": "Instagram no pudo procesar el media"}, status_code=500)
            time.sleep(3)
        pub = _ig_api("POST", f"{ig_id}/media_publish", {"creation_id": cid, "access_token": token})
        # Guardar IG media ID para tracking de métricas
        if pub.get("id"):
            post["ig_media_id"] = pub["id"]
        # Estado por plataforma
        pub_status = post.setdefault("published", {})
        pub_status[f"ig_{kind}"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        post["status"] = "publicado"
        save_data(d)
        return {"ok": True, "id": pub.get("id"), "kind": kind}
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
    # FB: solo el texto, sin hashtags (FB no los usa igual que IG)
    msg = (cap.get("ig_caption", "")).strip() or post["name"]
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
        pub_status = post.setdefault("published", {})
        pub_status[f"fb_{kind}"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        save_data(d)
        return {"ok": True, "id": res.get("id") or res.get("post_id"), "kind": kind}
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

## ── Caché persistente de insights (disco + memoria + background refresh) ──
## Arquitectura: NUNCA bloquear al usuario esperando Meta API.
## 1. Disco (insights_disk_cache.json) → sobrevive reinicios del server
## 2. Memoria (_insights_cache dict) → acceso instantáneo
## 3. Hilo de fondo → refresca cada 2h sin que el usuario espere
## 4. Pre-warm al arrancar → carga disco inmediato + dispara refresh en background

_insights_cache = {}       # {key: {"data": ..., "ts": "ISO string"}}
INSIGHTS_TTL = 7200        # 2 horas en segundos
INSIGHTS_DISK = os.path.join(HERE, "insights_disk_cache.json")
_refresh_lock = threading.Lock()
_refresh_running = False

def _cache_load_disk():
    """Carga caché desde disco al arrancar."""
    global _insights_cache
    if os.path.exists(INSIGHTS_DISK):
        try:
            raw = json.load(open(INSIGHTS_DISK, encoding="utf-8"))
            for k, v in raw.items():
                if "ts" in v and "data" in v:
                    _insights_cache[k] = {"data": v["data"], "ts": datetime.fromisoformat(v["ts"])}
            print(f"  [cache] Cargado desde disco: {len(_insights_cache)} entradas")
        except Exception as e:
            print(f"  [cache] Error cargando disco: {e}")

def _cache_save_disk():
    """Persiste caché a disco."""
    try:
        out = {}
        for k, v in _insights_cache.items():
            out[k] = {"data": v["data"], "ts": v["ts"].isoformat() if isinstance(v["ts"], datetime) else v["ts"]}
        json.dump(out, open(INSIGHTS_DISK, "w", encoding="utf-8"), ensure_ascii=False)
    except Exception:
        pass

def _cache_get(key):
    """Devuelve datos cacheados (memoria). No verifica TTL — siempre devuelve si existe.
    El TTL se usa solo para decidir cuándo refrescar en background."""
    c = _insights_cache.get(key)
    if c:
        return c["data"]
    return None

def _cache_age(key):
    """Edad en segundos del caché. None si no existe."""
    c = _insights_cache.get(key)
    if c and isinstance(c.get("ts"), datetime):
        return (datetime.now() - c["ts"]).total_seconds()
    return None

def _cache_set(key, data):
    _insights_cache[key] = {"data": data, "ts": datetime.now()}

def _cache_needs_refresh():
    """¿Algún key importante tiene más de INSIGHTS_TTL o no existe?"""
    important = ["account:days_28", "_media_raw:30", "besttimes"]
    for k in important:
        age = _cache_age(k)
        if age is None or age > INSIGHTS_TTL:
            return True
    return False

def _background_refresh():
    """Refresca toda la data de Meta en background. Corre en un thread."""
    global _refresh_running
    if _refresh_running:
        return
    with _refresh_lock:
        if _refresh_running:
            return
        _refresh_running = True
    try:
        token, ig_id = get_ig_auth()
        if not token or not ig_id:
            return
        print("  [cache] Background refresh iniciado...")

        # 1. Account metrics
        try:
            profile_raw = _ig_api("GET", ig_id, {
                "fields": "username,followers_count,follows_count,media_count,name,profile_picture_url",
                "access_token": token})
            followers = profile_raw.get("followers_count")
            profile = {
                "username": profile_raw.get("username"),
                "followers": followers,
                "following": profile_raw.get("follows_count"),
                "media_count": profile_raw.get("media_count"),
                "name": profile_raw.get("name"),
                "profile_picture_url": profile_raw.get("profile_picture_url"),
            }
            if followers is not None:
                try: _save_snapshot_today(int(followers))
                except Exception: pass
            metric_names = ["reach", "profile_views", "accounts_engaged",
                            "total_interactions", "likes", "comments", "views"]
            metrics = {}
            for m in metric_names:
                try: metrics[m] = _get_metric_value(ig_id, token, m, "days_28")
                except Exception: metrics[m] = None
            er = None
            ti = metrics.get("total_interactions")
            reach = metrics.get("reach")
            try:
                if ti is not None and reach and reach > 0: er = round(ti / reach * 100, 1)
                elif ti is not None and followers and followers > 0: er = round(ti / followers * 100, 1)
            except Exception: pass
            _cache_set("account:days_28", {
                "connected": True, "profile": profile, "period": "days_28",
                "metrics": metrics, "engagement_rate": er})
        except Exception as e:
            print(f"  [cache] Error account: {e}")

        # 2. Media con insights (la más pesada — alimenta besttimes, style-perf, hashtags)
        try:
            _fetch_media_with_insights(ig_id, token, limit=30)
            _fetch_media_with_insights(ig_id, token, limit=12)
        except Exception as e:
            print(f"  [cache] Error media: {e}")

        # 3. ig-status
        try:
            a = load_ig_auth()
            _cache_set("ig_status", {
                "connected": True, "ig_user_id": ig_id, "connected_at": a.get("connected_at"),
                "fb_connected": bool(a.get("page_id") and a.get("page_token")),
                "page_name": a.get("page_name")})
        except Exception: pass

        _cache_save_disk()
        print("  [cache] Background refresh OK")
    except Exception as e:
        print(f"  [cache] Error general: {e}")
    finally:
        _refresh_running = False

def _start_background_refresh():
    """Lanza refresh en un thread separado."""
    t = threading.Thread(target=_background_refresh, daemon=True)
    t.start()

def _periodic_refresh():
    """Hilo que refresca cada INSIGHTS_TTL segundos."""
    import time as _time
    _time.sleep(5)  # esperar que el server arranque
    while True:
        try:
            if _cache_needs_refresh():
                _background_refresh()
        except Exception:
            pass
        _time.sleep(INSIGHTS_TTL)

# --- Arranque: cargar disco + disparar refresh ---
_cache_load_disk()
threading.Thread(target=_periodic_refresh, daemon=True).start()

@app.get("/api/cache-status")
def cache_status():
    """Info del caché para el frontend."""
    ages = {}
    for k in ["account:days_28", "_media_raw:30", "_media_raw:12", "besttimes", "ig_status"]:
        age = _cache_age(k)
        ages[k] = round(age) if age is not None else None
    return {"ages": ages, "refreshing": _refresh_running, "entries": len(_insights_cache)}

@app.post("/api/cache-refresh")
async def cache_refresh():
    """Forzar refresh en background."""
    _start_background_refresh()
    return {"ok": True, "message": "Refresh iniciado en background"}

@app.get("/api/insights/account")
def insights_account(period: str = "days_28", refresh: int = 0):
    ck = f"account:{period}"
    if not refresh:
        cached = _cache_get(ck)
        if cached:
            return cached
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

    result = {"connected": True, "profile": profile, "period": period,
              "metrics": metrics, "engagement_rate": er}
    _cache_set(ck, result)
    return result

@app.get("/api/insights/growth")
def insights_growth():
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False, "series": []}
    data = _load_snapshots()
    return {"connected": True, "series": data.get("snapshots", [])}

def _fetch_media_with_insights(ig_id, token, limit=12):
    """Devuelve lista de posts con métricas individuales (defensivo).
    Caché interna de 2h: la 1ra llamada tarda 10-40s (N+1 a Meta), las siguientes <1ms."""
    ck = f"_media_raw:{limit}"
    cached = _cache_get(ck)
    if cached is not None:
        return cached
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
    _cache_set(ck, result)
    return result

@app.get("/api/insights/media")
def insights_media(limit: int = 12, refresh: int = 0):
    ck = f"media:{limit}"
    if not refresh:
        cached = _cache_get(ck)
        if cached:
            return cached
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return {"connected": False, "media": []}
    media = _fetch_media_with_insights(ig_id, token, limit)
    result = {"connected": True, "media": media}
    _cache_set(ck, result)
    return result

@app.get("/api/insights/besttimes")
def insights_besttimes(refresh: int = 0):
    ck = "besttimes"
    if not refresh:
        cached = _cache_get(ck)
        if cached:
            return cached
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

    result = {
        "connected": True,
        "by_weekday": by_weekday,
        "by_hour": by_hour,
        "best": {"weekday_label": best_wd_label, "hour": best_hr},
    }
    _cache_set(ck, result)
    return result


def _take_metrics_snapshot():
    """Toma snapshot diario de métricas por post desde IG API."""
    token, ig_id = get_ig_auth()
    if not token or not ig_id:
        return
    history = load_metrics_history()
    media = _fetch_media_with_insights(ig_id, token, limit=50)
    today = datetime.now().strftime("%Y-%m-%d")
    studio = load_data()
    # lookup: ig_media_id -> studio post
    id_to_post = {}
    for p in studio.get("posts", []):
        mid = p.get("ig_media_id")
        if mid:
            id_to_post[mid] = p
    for m in media:
        mid = m.get("id")
        if not mid:
            continue
        entry = history["posts"].setdefault(mid, {
            "slug": None, "name": None, "style": None,
            "snapshots": [], "first_seen": today,
            "ig_timestamp": m.get("timestamp"),
        })
        sp = id_to_post.get(mid)
        if sp:
            entry["slug"] = sp.get("slug")
            entry["name"] = sp.get("name")
            entry["style"] = sp.get("style")
        if not any(s["date"] == today for s in entry["snapshots"]):
            entry["snapshots"].append({
                "date": today,
                "reach": m.get("reach"),
                "likes": m.get("likes"),
                "comments": m.get("comments"),
                "views": m.get("views"),
                "er": m.get("engagement_rate"),
            })
    save_metrics_history(history)

@app.get("/api/metrics-history")
def api_metrics_history():
    return load_metrics_history()

@app.post("/api/metrics-history/refresh")
def api_metrics_history_refresh():
    try:
        _take_metrics_snapshot()
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"error": str(e)[:200]}, status_code=500)


# ---------- METAS -----------------------------------------------

@app.get("/api/goals")
def api_goals():
    data = load_goals()
    goals = data.get("goals", [])
    studio = load_data()
    snapshots = _load_snapshots().get("snapshots", [])
    now = datetime.now()
    month_prefix = now.strftime("%Y-%m")
    posts_this_month = len([p for p in studio.get("posts", [])
                            if (p.get("created") or "").startswith(month_prefix)
                            and p.get("status") == "publicado"])
    current_followers = snapshots[-1]["followers"] if snapshots else None
    # ER promedio de posts recientes
    avg_er = None
    token, ig_id = get_ig_auth()
    if token and ig_id:
        try:
            media = _fetch_media_with_insights(ig_id, token, limit=12)
            ers = [m["engagement_rate"] for m in media if m.get("engagement_rate") is not None]
            if ers:
                avg_er = round(sum(ers) / len(ers), 1)
        except Exception:
            pass
    for g in goals:
        if g["id"] == "posts_month":
            g["current"] = posts_this_month
        elif g["id"] == "followers":
            g["current"] = current_followers
        elif g["id"] == "avg_er":
            g["current"] = avg_er
        else:
            g["current"] = None
    return {"goals": goals}

@app.post("/api/goals")
async def api_goals_update(req: Request):
    b = await req.json()
    data = load_goals()
    goals = data.get("goals", [])
    gid = b.get("id")
    target = b.get("target")
    if not gid or target is None:
        return JSONResponse({"error": "id y target requeridos"}, status_code=400)
    found = False
    for g in goals:
        if g["id"] == gid:
            g["target"] = float(target)
            found = True
            break
    if not found:
        goals.append({"id": gid, "label": b.get("label", gid), "target": float(target),
                       "unit": b.get("unit", ""), "period": b.get("period", "monthly")})
    data["goals"] = goals
    save_goals(data)
    return {"ok": True}

@app.get("/api/recurring")
def api_recurring_list():
    return load_recurring()

@app.post("/api/recurring")
async def api_recurring_save(req: Request):
    b = await req.json()
    data = load_recurring()
    templates = data.get("templates", [])
    tid = b.get("id")
    if not tid:
        # New template
        import uuid
        tid = str(uuid.uuid4())[:8]
        templates.append({
            "id": tid,
            "label": b.get("label", "Sin nombre"),
            "weekdays": b.get("weekdays", []),
            "angle": b.get("angle", "oferta"),
            "style": b.get("style", "premium"),
            "product_selection": b.get("product_selection", "not_featured_recently"),
            "enabled": True,
            "created": datetime.now().strftime("%Y-%m-%d"),
        })
    else:
        # Update existing
        for t in templates:
            if t["id"] == tid:
                for k in ("label", "weekdays", "angle", "style", "product_selection", "enabled"):
                    if k in b:
                        t[k] = b[k]
                break
    data["templates"] = templates
    save_recurring(data)
    return {"ok": True, "id": tid}

@app.post("/api/recurring/delete")
async def api_recurring_delete(req: Request):
    b = await req.json()
    tid = b.get("id")
    data = load_recurring()
    data["templates"] = [t for t in data.get("templates", []) if t.get("id") != tid]
    save_recurring(data)
    return {"ok": True}

@app.post("/api/recurring/run")
async def api_recurring_run(req: Request):
    """Ejecuta plantillas del día: selecciona producto y crea entry pendiente."""
    data = load_recurring()
    studio = load_data()
    today_wd = datetime.now().weekday()  # 0=Monday
    created = []
    # products from cache
    prods = []
    try:
        cache_path = os.path.join(HERE, "products_cache.json")
        if os.path.exists(cache_path):
            raw = json.load(open(cache_path, encoding="utf-8"))
            prods = raw.get("products", []) if isinstance(raw, dict) else raw
    except Exception:
        pass
    # recently featured slugs (last 14 days)
    recent_slugs = set()
    cutoff = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
    for p in studio.get("posts", []):
        if (p.get("created") or "") >= cutoff:
            recent_slugs.add(p.get("slug", ""))
    import random
    for tmpl in data.get("templates", []):
        if not tmpl.get("enabled", True):
            continue
        if today_wd not in tmpl.get("weekdays", []):
            continue
        # Select product
        product = None
        sel = tmpl.get("product_selection", "not_featured_recently")
        if sel == "not_featured_recently" and prods:
            candidates = [pr for pr in prods if slugify(pr.get("name", "")) not in recent_slugs]
            if not candidates:
                candidates = prods
            product = random.choice(candidates) if candidates else None
        elif prods:
            product = random.choice(prods)
        if not product:
            continue
        pname = product.get("name", "Producto")
        pprice = product.get("salePrice", product.get("price", 0))
        slug = slugify(pname) + (f"-{pprice}" if pprice else "") + "-auto"
        # Check if already generated today
        today_prefix = datetime.now().strftime("%Y-%m-%d")
        already = any(p.get("slug") == slug and (p.get("created") or "").startswith(today_prefix)
                      for p in studio.get("posts", []))
        if already:
            continue
        new_post = {
            "slug": slug,
            "filename": "",
            "name": pname,
            "price": pprice,
            "style": tmpl.get("style", "premium"),
            "tag": tmpl.get("angle", "OFERTA").upper(),
            "image": "",
            "cover": "",
            "video": "",
            "status": "pendiente-auto",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": "",
            "created": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "caption": {},
            "published": {},
            "recurring_template": tmpl.get("id"),
        }
        studio["posts"].insert(0, new_post)
        created.append({"slug": slug, "name": pname, "template": tmpl.get("label")})
    if created:
        save_data(studio)
    return {"ok": True, "created": created}

@app.get("/api/insights/style-performance")
def insights_style_performance(refresh: int = 0):
    """Rendimiento por estilo: cruza metrics_history con studio_data."""
    ck = "style_perf"
    if not refresh:
        cached = _cache_get(ck)
        if cached:
            return cached
    history = load_metrics_history()
    studio = load_data()
    # lookup slug -> style
    slug_style = {}
    for p in studio.get("posts", []):
        if p.get("style") and p.get("slug"):
            slug_style[p["slug"]] = p["style"]
    # aggregate by style
    from collections import defaultdict
    style_data = defaultdict(lambda: {"reaches": [], "ers": [], "likes": [], "posts": 0})
    for mid, entry in history.get("posts", {}).items():
        style = entry.get("style") or slug_style.get(entry.get("slug"))
        if not style:
            continue
        snaps = entry.get("snapshots", [])
        if not snaps:
            continue
        # use latest snapshot
        latest = snaps[-1]
        sd = style_data[style]
        sd["posts"] += 1
        if latest.get("reach") is not None:
            sd["reaches"].append(latest["reach"])
        if latest.get("er") is not None:
            sd["ers"].append(latest["er"])
        if latest.get("likes") is not None:
            sd["likes"].append(latest["likes"])
    # If no history data, try live IG data
    if not any(v["posts"] for v in style_data.values()):
        token, ig_id = get_ig_auth()
        if token and ig_id:
            try:
                media = _fetch_media_with_insights(ig_id, token, limit=30)
                for m in media:
                    # match to studio by timestamp proximity
                    ts = (m.get("timestamp") or "")[:16]
                    matched_style = None
                    for p in studio.get("posts", []):
                        pub = p.get("published", {})
                        for v in pub.values():
                            if v and ts and v[:16] == ts[:16]:
                                matched_style = p.get("style")
                                break
                        if matched_style:
                            break
                    if matched_style:
                        sd = style_data[matched_style]
                        sd["posts"] += 1
                        if m.get("reach") is not None: sd["reaches"].append(m["reach"])
                        if m.get("engagement_rate") is not None: sd["ers"].append(m["engagement_rate"])
                        if m.get("likes") is not None: sd["likes"].append(m["likes"])
            except Exception:
                pass
    def avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else 0
    result = []
    for style, sd in style_data.items():
        if sd["posts"] == 0:
            continue
        result.append({
            "style": style,
            "posts": sd["posts"],
            "avg_reach": avg(sd["reaches"]),
            "avg_er": avg(sd["ers"]),
            "avg_likes": avg(sd["likes"]),
        })
    result.sort(key=lambda x: x["avg_er"], reverse=True)
    out = {"styles": result}
    _cache_set(ck, out)
    return out


@app.get("/api/insights/repurpose")
def insights_repurpose():
    """Sugiere re-publicar posts antiguos con buen rendimiento."""
    history = load_metrics_history()
    studio = load_data()
    now = datetime.now()
    STYLES_ALL = ["premium", "premium_dark", "premium_giant", "premium_split", "clasica", "amigable"]
    candidates = []
    for mid, entry in history.get("posts", {}).items():
        snaps = entry.get("snapshots", [])
        if not snaps:
            continue
        first = entry.get("first_seen", "")
        if not first:
            continue
        try:
            age = (now - datetime.fromisoformat(first)).days
        except Exception:
            continue
        if age < 14:  # at least 2 weeks old
            continue
        latest = snaps[-1]
        er = latest.get("er")
        if er is None or er < 2.0:  # only good performers
            continue
        slug = entry.get("slug")
        style = entry.get("style")
        # suggest a different style
        other_styles = [s for s in STYLES_ALL if s != style]
        suggested = other_styles[0] if other_styles else style
        # find original post for image path
        studio_post = next((p for p in studio.get("posts", []) if p.get("slug") == slug), None)
        candidates.append({
            "slug": slug,
            "name": entry.get("name") or (studio_post.get("name") if studio_post else slug),
            "style": style,
            "suggested_style": suggested,
            "er": er,
            "reach": latest.get("reach"),
            "age_days": age,
            "image": studio_post.get("image") if studio_post else None,
        })
    candidates.sort(key=lambda x: x.get("er", 0), reverse=True)
    return {"candidates": candidates[:6]}


@app.get("/api/insights/hashtags")
def insights_hashtags(refresh: int = 0):
    """Analiza qué hashtags rinden mejor basado en reach de cada post."""
    ck = "hashtags"
    if not refresh:
        cached = _cache_get(ck)
        if cached:
            return cached
    studio = load_data()
    history = load_metrics_history()
    # Build slug -> latest metrics
    slug_metrics = {}
    for mid, entry in history.get("posts", {}).items():
        slug = entry.get("slug")
        snaps = entry.get("snapshots", [])
        if slug and snaps:
            slug_metrics[slug] = snaps[-1]
    # Fallback: if no history, try live IG data matched by timestamp
    if not slug_metrics:
        token, ig_id = get_ig_auth()
        if token and ig_id:
            try:
                media = _fetch_media_with_insights(ig_id, token, limit=30)
                for m in media:
                    ts = (m.get("timestamp") or "")[:16]
                    for p in studio.get("posts", []):
                        pub = p.get("published", {})
                        for v in pub.values():
                            if v and ts and v[:16] == ts[:16]:
                                slug_metrics[p["slug"]] = {
                                    "reach": m.get("reach"),
                                    "er": m.get("engagement_rate"),
                                    "likes": m.get("likes"),
                                }
                                break
            except Exception:
                pass
    # Extract hashtags per post and cross with metrics
    from collections import defaultdict
    ht_data = defaultdict(lambda: {"posts": 0, "reaches": [], "ers": []})
    for p in studio.get("posts", []):
        if p.get("status") != "publicado":
            continue
        cap = p.get("caption", {})
        ht_str = ""
        if isinstance(cap, dict):
            ht_str = cap.get("hashtags", "") or ""
            # Also extract from ig_caption
            ig_cap = cap.get("ig_caption", "") or ""
            import re as _re
            ht_str += " " + " ".join(_re.findall(r"#\w+", ig_cap))
        tags = [t.strip().lower() for t in ht_str.replace(",", " ").split() if t.strip().startswith("#")]
        tags = list(dict.fromkeys(tags))  # dedupe preserving order
        metrics = slug_metrics.get(p.get("slug"), {})
        for tag in tags:
            d = ht_data[tag]
            d["posts"] += 1
            if metrics.get("reach") is not None:
                d["reaches"].append(metrics["reach"])
            if metrics.get("er") is not None:
                d["ers"].append(metrics["er"])
    def avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else 0
    result = []
    for tag, d in ht_data.items():
        result.append({
            "hashtag": tag,
            "posts": d["posts"],
            "avg_reach": avg(d["reaches"]),
            "avg_er": avg(d["ers"]),
        })
    result.sort(key=lambda x: x["avg_reach"], reverse=True)
    # suggested set: top 5 by reach
    suggested = [r["hashtag"] for r in result[:5]]
    out = {"hashtags": result[:15], "suggested": " ".join(suggested)}
    _cache_set(ck, out)
    return out


@app.get("/api/report/generate")
def report_generate(period: str = ""):
    """Genera un reporte HTML mensual descargable."""
    from datetime import date
    if not period:
        period = datetime.now().strftime("%Y-%m")
    try:
        year, month = int(period[:4]), int(period[5:7])
    except Exception:
        return JSONResponse({"error": "Formato: YYYY-MM"}, status_code=400)

    MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
             'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    mes_label = f"{MESES[month]} {year}"
    prefix = f"{year}-{month:02d}"

    # Datos
    studio = load_data()
    posts_month = [p for p in studio.get("posts", [])
                   if (p.get("created") or "").startswith(prefix) and p.get("status") == "publicado"]
    total_posts = len(posts_month)

    snapshots = _load_snapshots().get("snapshots", [])
    month_snaps = [s for s in snapshots if s.get("date", "").startswith(prefix)]
    followers_start = month_snaps[0]["followers"] if month_snaps else None
    followers_end = month_snaps[-1]["followers"] if month_snaps else None
    followers_gained = (followers_end - followers_start) if followers_start and followers_end else None

    # Metrics from history
    history = load_metrics_history()
    month_metrics = []
    for mid, entry in history.get("posts", {}).items():
        for snap in entry.get("snapshots", []):
            if snap.get("date", "").startswith(prefix):
                month_metrics.append({**snap, "style": entry.get("style"), "name": entry.get("name")})
                break

    total_reach = sum(m.get("reach") or 0 for m in month_metrics)
    total_likes = sum(m.get("likes") or 0 for m in month_metrics)
    ers = [m.get("er") for m in month_metrics if m.get("er") is not None]
    avg_er = round(sum(ers) / len(ers), 1) if ers else None

    # Top 3 posts by ER
    top3 = sorted(month_metrics, key=lambda x: x.get("er") or 0, reverse=True)[:3]

    # Style performance
    from collections import defaultdict
    style_stats = defaultdict(lambda: {"ers": [], "count": 0})
    for m in month_metrics:
        s = m.get("style")
        if s:
            style_stats[s]["count"] += 1
            if m.get("er") is not None:
                style_stats[s]["ers"].append(m["er"])
    best_style = None
    if style_stats:
        best_style = max(style_stats.keys(), key=lambda s: (sum(style_stats[s]["ers"])/len(style_stats[s]["ers"])) if style_stats[s]["ers"] else 0)

    # AI summary (optional, Groq)
    ai_summary = ""
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if groq_key and month_metrics:
        try:
            import urllib.request
            ctx = json.dumps({
                "mes": mes_label, "posts": total_posts, "reach_total": total_reach,
                "likes_total": total_likes, "er_promedio": avg_er,
                "seguidores_inicio": followers_start, "seguidores_fin": followers_end,
                "mejor_estilo": best_style,
                "top3": [{"name": t.get("name"), "er": t.get("er"), "reach": t.get("reach")} for t in top3],
            }, ensure_ascii=False)
            payload = json.dumps({
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": "Eres analista de marketing para una distribuidora chilena pequeña (Hualpén). Escribe un resumen ejecutivo de 2-3 párrafos del mes, en español, directo y accionable. Sin markdown."},
                    {"role": "user", "content": f"Datos del mes:\n{ctx}"},
                ],
                "max_tokens": 600, "temperature": 0.5,
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=payload,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {groq_key}", "User-Agent": "Mozilla/5.0"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                ai_summary = json.loads(resp.read().decode("utf-8"))["choices"][0]["message"]["content"]
        except Exception:
            ai_summary = ""

    STYLE_LABELS = {"premium": "Premium", "premium_dark": "Dark", "premium_giant": "Gigante",
                    "premium_split": "Split", "clasica": "Clásica", "amigable": "Amigable"}

    top3_html = ""
    for i, t in enumerate(top3):
        top3_html += f'''<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e6e1d8;flex:1">
            <div style="font-size:.78rem;color:#85838c;margin-bottom:4px">#{i+1}</div>
            <div style="font-weight:700;font-size:.95rem;margin-bottom:6px">{t.get("name","—")}</div>
            <div style="color:#ed1c24;font-weight:800;font-size:1.1rem">ER {t.get("er",0):.1f}%</div>
            <div style="font-size:.82rem;color:#85838c">Alcance: {t.get("reach",0):,}</div>
        </div>'''

    style_html = ""
    for s, sd in sorted(style_stats.items(), key=lambda x: -(sum(x[1]["ers"])/len(x[1]["ers"]) if x[1]["ers"] else 0)):
        avg_s = round(sum(sd["ers"])/len(sd["ers"]),1) if sd["ers"] else 0
        style_html += f'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0ebe1"><span style="font-weight:600">{STYLE_LABELS.get(s,s)}</span><span>ER {avg_s}% · {sd["count"]} posts</span></div>'

    html = f'''<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte {mes_label} — El Maravilloso</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:Bahnschrift,"Segoe UI",system-ui,sans-serif;background:#faf8f4;color:#1b1b1f;padding:32px;max-width:800px;margin:0 auto}}
h1{{font-size:1.5rem;color:#ed1c24;margin-bottom:4px}}
.sub{{color:#85838c;font-size:.88rem;margin-bottom:28px}}
.kpis{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}}
.kpi{{background:#fff;border:1px solid #e6e1d8;border-radius:14px;padding:18px;text-align:center}}
.kpi .n{{font-size:1.8rem;font-weight:800;color:#1b1b1f;line-height:1}}
.kpi .n.red{{color:#ed1c24}}
.kpi .l{{font-size:.78rem;color:#85838c;margin-top:4px}}
h2{{font-size:1.1rem;margin:24px 0 12px;display:flex;align-items:center;gap:8px}}
h2::before{{content:"";width:8px;height:8px;border-radius:50%;background:#ed1c24;display:inline-block}}
.top3{{display:flex;gap:12px;margin-bottom:24px}}
.summary{{background:#fff;border:1px solid #e6e1d8;border-radius:14px;padding:20px;line-height:1.65;font-size:.92rem;margin-bottom:24px;white-space:pre-line}}
.footer{{text-align:center;color:#85838c;font-size:.78rem;margin-top:40px;padding-top:16px;border-top:1px solid #e6e1d8}}
@media print{{body{{padding:16px}} .kpis{{grid-template-columns:repeat(4,1fr)}}}}
@media(max-width:600px){{.kpis{{grid-template-columns:repeat(2,1fr)}} .top3{{flex-direction:column}}}}
</style></head>
<body>
<h1>📊 Reporte Mensual</h1>
<div class="sub">{mes_label} — Distribuidora El Maravilloso</div>
<div class="kpis">
  <div class="kpi"><div class="n">{total_posts}</div><div class="l">Publicaciones</div></div>
  <div class="kpi"><div class="n">{total_reach:,}</div><div class="l">Alcance total</div></div>
  <div class="kpi"><div class="n red">{f"{avg_er:.1f}%" if avg_er else "—"}</div><div class="l">ER promedio</div></div>
  <div class="kpi"><div class="n">{f"+{followers_gained}" if followers_gained and followers_gained>0 else (str(followers_gained) if followers_gained else "—")}</div><div class="l">Seguidores ganados</div></div>
</div>
{"<h2>Top publicaciones</h2><div class='top3'>" + top3_html + "</div>" if top3_html else ""}
{"<h2>Rendimiento por estilo</h2><div style='background:#fff;border:1px solid #e6e1d8;border-radius:14px;padding:16px;margin-bottom:24px'>" + style_html + "</div>" if style_html else ""}
{"<h2>Resumen IA</h2><div class='summary'>" + ai_summary + "</div>" if ai_summary else ""}
<div class="footer">Generado automáticamente por Estudio El Maravilloso · {datetime.now().strftime("%d/%m/%Y %H:%M")}</div>
</body></html>'''

    return HTMLResponse(content=html, headers={
        "Content-Disposition": f'inline; filename="reporte-{period}.html"'
    })


# ---------- INTELIGENCIA: análisis semanal con Claude ----------

_INTEL_CACHE = {"data": None, "ts": 0}

@app.get("/api/insights/intelligence")
def insights_intelligence(force: bool = False):
    import time

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not anthropic_key and not groq_key:
        return {"error": "no_key", "message": "Configura GROQ_API_KEY o ANTHROPIC_API_KEY en el .env"}

    # caché unificada (2h como el resto de insights)
    if not force:
        cached = _cache_get("intelligence")
        if cached:
            return cached

    token, ig_id = get_ig_auth()

    # --- recopilar datos disponibles ---
    account_data = {}
    media_data = []
    besttimes_data = {}

    if token and ig_id:
        try:
            account_data = insights_account()
        except Exception:
            account_data = {"connected": False}
        try:
            media_data = _fetch_media_with_insights(ig_id, token, limit=30)
        except Exception:
            media_data = []
        try:
            besttimes_data = insights_besttimes()
        except Exception:
            besttimes_data = {}

    # datos del estudio (posts generados, publicados, pendientes)
    studio = load_data()
    studio_posts = studio.get("posts", [])
    published = [p for p in studio_posts if p.get("status") == "publicado"]
    pending   = [p for p in studio_posts if p.get("status") not in ("publicado", "archivado")]

    # resumen compacto de posts del estudio para el prompt
    def _studio_summary(posts, max_items=8):
        items = []
        for p in posts[:max_items]:
            cap = p.get("caption", {})
            ig_cap = cap.get("ig_caption", "") if isinstance(cap, dict) else str(cap)
            items.append({
                "producto": (p.get("name") or p.get("product") or "")[:60],
                "status": p.get("status", ""),
                "fecha": (p.get("created") or p.get("date") or "")[:10],
                "caption": ig_cap[:80],
                "published": p.get("published", {}),
            })
        return items

    # resumen compacto de posts de IG con métricas
    def _media_summary(posts, max_items=20):
        items = []
        for m in posts[:max_items]:
            items.append({
                "tipo": m.get("media_type", ""),
                "fecha": (m.get("timestamp") or "")[:10],
                "caption": (m.get("caption") or "")[:80],
                "likes": m.get("likes"),
                "comments": m.get("comments"),
                "reach": m.get("reach"),
                "views": m.get("views"),
                "er": m.get("engagement_rate"),
            })
        return items

    # perfil y métricas de cuenta
    profile = account_data.get("profile", {})
    metrics = account_data.get("metrics", {})
    er_cuenta = account_data.get("engagement_rate")

    best = besttimes_data.get("best", {})
    best_str = ""
    if best.get("weekday_label") and best.get("hour") is not None:
        best_str = f"{best['weekday_label']} a las {best['hour']}:00"

    now_str = datetime.now().isoformat(timespec="seconds")

    # construir contexto de datos para el prompt
    data_ctx = {
        "fecha_analisis": now_str,
        "cuenta": {
            "username": profile.get("username"),
            "seguidores": profile.get("followers"),
            "publicaciones_totales": profile.get("media_count"),
            "engagement_rate_cuenta": er_cuenta,
            "metricas_28d": metrics,
        },
        "mejor_horario": best_str or "sin datos suficientes",
        "posts_ig_recientes": _media_summary(media_data),
        "studio_publicados": _studio_summary(published),
        "studio_pendientes_publicar": _studio_summary(pending),
        "total_generados": len(studio_posts),
        "total_publicados": len(published),
        "total_pendientes": len(pending),
    }

    system_prompt = (
        "Eres un analista de marketing especializado en micro-cuentas de Instagram para negocios locales chilenos. "
        "Analizas 'Distribuidora El Maravilloso', una distribuidora ubicada en Hualpén, Chile, "
        "con aproximadamente 137 seguidores — una cuenta en etapa de crecimiento inicial.\n\n"
        "Tu rol es entregar un diagnóstico semanal accionable y específico, NO genérico. "
        "Cuando digas 'publica más', di exactamente qué, cuándo y por qué. "
        "Considera que es una micro-cuenta y que el crecimiento orgánico es lento al comienzo.\n\n"
        "Analiza:\n"
        "- Engagement rate (bueno para micro: >3%, excelente: >6%)\n"
        "- Tipos de contenido que más reach generan (foto vs reel vs carrusel)\n"
        "- Consistencia y frecuencia de publicación\n"
        "- Mejores horarios según datos históricos\n"
        "- Qué contenido hay en pipeline (generado pero no publicado)\n"
        "- Oportunidades específicas para la distribuidora (productos, promociones, tips)\n\n"
        "Responde ÚNICAMENTE con un JSON válido (sin markdown, sin bloques de código) con esta estructura exacta:\n"
        "{\n"
        '  "diagnosis": "1-3 párrafos de diagnóstico semanal en español",\n'
        '  "recommendations": [\n'
        '    {"type": "reel|photo|story|combo", "suggestion": "qué publicar", "reason": "por qué", "priority": "alta|media|baja"}\n'
        "  ],\n"
        '  "post_analysis": [\n'
        '    {"caption_preview": "primeros 60 caracteres", "performance": "bueno|regular|malo", "insight": "por qué funcionó o no", "er": 2.1}\n'
        "  ],\n"
        '  "alerts": [\n'
        '    {"level": "warning|info|success", "icon": "⚠️|💡|✅", "message": "texto de alerta"}\n'
        "  ],\n"
        '  "best_content_type": "tipo de contenido que mejor funciona",\n'
        '  "posting_cadence": "frecuencia recomendada de publicación",\n'
        '  "generated_at": "' + now_str + '"\n'
        "}"
    )

    user_msg = (
        "Analiza estos datos de Instagram y el estudio de contenido y entrega el diagnóstico semanal:\n\n"
        + json.dumps(data_ctx, ensure_ascii=False, indent=2)
    )

    try:
        if groq_key:
            import urllib.request
            payload = json.dumps({
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg},
                ],
                "response_format": {"type": "json_object"},
                "max_tokens": 1500,
                "temperature": 0.6,
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {groq_key}",
                    "User-Agent": "Mozilla/5.0",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            raw_text = data["choices"][0]["message"]["content"]
        else:
            import anthropic as _anthropic
            client = _anthropic.Anthropic(api_key=anthropic_key)
            msg = client.messages.create(
                model="claude-sonnet-4-6-20250514",
                max_tokens=1500,
                system=system_prompt,
                messages=[{"role": "user", "content": user_msg}],
            )
            raw_text = next((b.text for b in msg.content if b.type == "text"), "")
    except Exception as e:
        return JSONResponse(
            {"error": "ai_error", "message": str(e)[:300]},
            status_code=502,
        )

    # parseo robusto: extraer JSON aunque venga en bloque markdown
    json_text = raw_text.strip()
    # quitar bloque ```json ... ``` si existe
    md_match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", json_text)
    if md_match:
        json_text = md_match.group(1).strip()
    # quitar texto previo o posterior al JSON (buscar primer { y último })
    start = json_text.find("{")
    end   = json_text.rfind("}")
    if start != -1 and end != -1 and end > start:
        json_text = json_text[start:end+1]

    try:
        result = json.loads(json_text)
    except Exception as e:
        return JSONResponse(
            {"error": "parse_error", "message": f"Claude no devolvió JSON válido: {str(e)[:120]}",
             "raw": raw_text[:500]},
            status_code=502,
        )

    # asegurar generated_at
    result.setdefault("generated_at", now_str)

    # guardar en caché
    _cache_set("intelligence", result)

    return result


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

## ========== CHAT MARK (asistente IA conversacional) ==========

CHAT_HISTORY = []  # historial en memoria (se pierde al reiniciar, no importa)

def _gather_chat_context():
    """Recopila datos reales del negocio para inyectar al prompt del chat."""
    ctx = {}

    # Productos top
    try:
        prods = fetch_products()
        top = prods.get("products", [])[:20]
        ctx["productos"] = ", ".join(
            f"{p['name']} ${int(p.get('salePrice',0)):,}".replace(",",".")
            for p in top if p.get("salePrice")
        )
        ctx["total_productos"] = len(prods.get("products", []))
    except Exception:
        ctx["productos"] = "(no disponible)"
        ctx["total_productos"] = 0

    # Métricas IG
    try:
        token, ig_id = get_ig_auth()
        if token and ig_id:
            profile_raw = _ig_api("GET", ig_id, {
                "fields": "username,followers_count,media_count",
                "access_token": token
            })
            ctx["ig_followers"] = profile_raw.get("followers_count", "?")
            ctx["ig_posts"] = profile_raw.get("media_count", "?")
            ctx["ig_user"] = profile_raw.get("username", "?")
        else:
            ctx["ig_followers"] = ctx["ig_posts"] = ctx["ig_user"] = "no conectado"
    except Exception:
        ctx["ig_followers"] = ctx["ig_posts"] = ctx["ig_user"] = "error"

    # Piezas listas
    try:
        sd = json.load(open(DATA, encoding="utf-8"))
        piezas = [p for p in sd if p.get("video") or p.get("image")]
        ctx["piezas_listas"] = len(piezas)
        ctx["piezas_agendadas"] = len([p for p in sd if p.get("scheduled")])
    except Exception:
        ctx["piezas_listas"] = 0
        ctx["piezas_agendadas"] = 0

    # Contexto temporal
    now = datetime.now()
    dias = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"]
    meses_temp = {12:"verano",1:"verano",2:"verano",3:"otoño",4:"otoño",5:"otoño",
                  6:"invierno",7:"invierno",8:"invierno",9:"primavera",10:"primavera",11:"primavera"}
    ctx["dia"] = dias[now.weekday()]
    ctx["fecha"] = now.strftime("%d/%m/%Y")
    ctx["temporada"] = meses_temp.get(now.month, "")

    # Competidores
    try:
        cfg_path = os.path.join(TOOLS, "vigia_config.json")
        cfg = json.load(open(cfg_path, encoding="utf-8"))
        comps = cfg.get("competidores", [])
        ctx["competidores"] = ", ".join(f"{c['nombre']} ({c.get('ig','sin IG')})" for c in comps)
    except Exception:
        ctx["competidores"] = "Biolimpieza, Los Turcos, El Baratillo, Deconce, M&L, Calfulen"

    return ctx

def _build_chat_system_prompt(ctx):
    estilo = load_estilo()
    negocio = estilo.get("negocio", {})
    return f"""Eres Mark, el asistente de marketing de El Maravilloso — una distribuidora de abarrotes en Hualpén, Chile.
Dirección: {negocio.get('direccion', 'Grecia 1841, Hualpén')}.
Referencia: {negocio.get('referencia', 'a metros del colegio Montaner')}.

DATOS EN VIVO:
- Instagram: @{ctx.get('ig_user','?')} | {ctx.get('ig_followers','?')} seguidores | {ctx.get('ig_posts','?')} posts
- Catálogo: {ctx.get('total_productos',0)} productos. Top ventas: {ctx.get('productos','')}
- Piezas listas: {ctx.get('piezas_listas',0)} | Agendadas: {ctx.get('piezas_agendadas',0)}
- Competidores zona: {ctx.get('competidores','')}
- Hoy: {ctx.get('dia','')} {ctx.get('fecha','')} | Temporada: {ctx.get('temporada','')}

PERSONALIDAD:
- Habla en español chileno neutro, trato de tú, cercano pero profesional.
- Respuestas CORTAS y directas (máximo 3-4 líneas por respuesta).
- Cuando propongas contenido, di el producto + precio real del catálogo.
- Si te preguntan métricas, da los números reales de arriba.
- Si te piden generar un video o publicar, explica qué botón usar en el panel (no puedes ejecutar acciones directamente aún).
- Si no sabes algo, dilo honestamente.
- NO uses asteriscos markdown (**) — el chat es texto plano.
- NO inventes datos. Solo usa los datos reales de arriba."""

def _groq_chat(messages):
    """Llama a Groq con historial de mensajes."""
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        raise RuntimeError("no_key")
    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "max_tokens": 600,
        "temperature": 0.7,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {groq_key}",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]

@app.post("/api/chat")
async def api_chat(req: Request):
    global CHAT_HISTORY
    try:
        b = await req.json()
    except Exception:
        return JSONResponse({"error": "JSON inválido"}, status_code=400)

    user_msg = (b.get("message") or "").strip()
    if not user_msg:
        return JSONResponse({"error": "Mensaje vacío"}, status_code=400)

    # Recopilar contexto fresco
    ctx = _gather_chat_context()
    system_prompt = _build_chat_system_prompt(ctx)

    # Mantener últimos 10 mensajes de historial
    CHAT_HISTORY.append({"role": "user", "content": user_msg})
    if len(CHAT_HISTORY) > 20:
        CHAT_HISTORY = CHAT_HISTORY[-20:]

    messages = [{"role": "system", "content": system_prompt}] + CHAT_HISTORY

    try:
        reply = _groq_chat(messages)
        CHAT_HISTORY.append({"role": "assistant", "content": reply})
        return {"reply": reply}
    except RuntimeError as e:
        if "no_key" in str(e):
            return JSONResponse({"error": "Configura GROQ_API_KEY en el .env para activar el chat."}, status_code=400)
        return JSONResponse({"error": str(e)[:200]}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": f"Error IA: {str(e)[:200]}"}, status_code=500)

@app.post("/api/chat/clear")
async def api_chat_clear():
    global CHAT_HISTORY
    CHAT_HISTORY = []
    return {"ok": True}

## ========== FIN CHAT MARK ==========

def open_browser():
    webbrowser.open("http://127.0.0.1:8000")

# ---------- Background: snapshot diario de métricas ----------
def _schedule_daily_snapshot():
    import time as _time
    while True:
        now = datetime.now()
        target = now.replace(hour=23, minute=30, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        _time.sleep((target - now).total_seconds())
        try:
            _take_metrics_snapshot()
        except Exception:
            pass

threading.Thread(target=_schedule_daily_snapshot, daemon=True).start()

if __name__ == "__main__":
    import uvicorn
    print("\n  🎬  Estudio El Maravilloso  ->  http://127.0.0.1:8000\n")
    threading.Timer(1.2, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
