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

    drawer = T.STYLES.get(style, T.style_premium)
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

    # video (reel / tiktok)
    vid_path = os.path.join(VID_OUT, slug + ".mp4")
    args = argparse.Namespace(product=product, name=name, price=str(price),
                              out=vid_path, tag=tag, seconds=6.0, style=style)
    (MV.build_premium if style == "premium" else MV.build)(args)

    d = load_data()
    d["posts"] = [p for p in d["posts"] if p.get("slug") != slug]
    post = {"slug": slug, "filename": fname, "name": name, "price": price,
            "style": style, "tag": tag,
            "image": rel(img_path), "cover": rel(cover_path), "video": rel(vid_path),
            "status": "listo", "date": "", "time": "",
            "created": datetime.now().strftime("%Y-%m-%d %H:%M")}
    d["posts"].insert(0, post)
    save_data(d)
    return post

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

# --- Motor de captions GRATIS (plantillas) — texto limpio y ordenado, casa+negocio, sin gritar ni emoji-spam ---
HOOKS = [
    "Te dejamos el dato 👇",
    "Precio del día:",
    "Llegó stock y lo dejamos a buen precio:",
    "Ojo con este precio:",
    "Para anotar y stockear:",
    "Lo dejamos a precio conveniente:",
    "Buena oportunidad:",
]
BODIES = [
    "{name}: {price}.",
    "{name} a {price}.",
    "{name} — {price} la unidad.",
    "{name}, {price}.",
]
# Por qué conviene (habla a casa Y negocio, sin clichés)
WHY = [
    "Conviene igual para la casa o para surtir el negocio.",
    "Buen precio para consumo o para revender.",
    "Rinde en el hogar y sale a cuenta para el comercio.",
    "Sirve para tu casa o para tu local.",
    "A ese precio conviene, lo lleves para la casa o para el negocio.",
]
# Dónde y cómo
WHERE = [
    "Estamos en Hualpén. Despacho disponible.",
    "Pasa por Hualpén o escríbenos por DM.",
    "En Hualpén — atendemos público y comercializadoras.",
    "Hualpén · escríbenos por DM para pedidos y despacho.",
]
TIKTOKS = [
    "{name} a {price}. Para la casa o el negocio — El Maravilloso, Hualpén.",
    "Precio del día: {name} {price}. El Maravilloso, Hualpén.",
    "{name} {price}. Pasa por El Maravilloso, Hualpén — público y negocios.",
    "Anota: {name} {price}. Hualpén, con despacho.",
]
BASE_TAGS = "#ElMaravilloso #Hualpén #Concepción #Ofertas #Distribuidora #Abarrotes"

def templated_caption(name, price, variant=0):
    p = _money(price)
    v = abs(hash(name)) + int(variant or 0)
    pick = lambda lst, off: lst[(v + off) % len(lst)]
    ig = (pick(HOOKS, 0) + "\n\n"
          + pick(BODIES, 1).format(name=name, price=p) + " " + pick(WHY, 2) + "\n\n"
          + pick(WHERE, 3))
    tk = pick(TIKTOKS, 4).format(name=name, price=p) + " #fyp #parati"
    kw = re.sub(r"[^a-zA-Z0-9áéíóúñ]", "", name.split()[0]) if name.split() else ""
    tags = BASE_TAGS + (f" #{kw.capitalize()}" if kw else "")
    return {"ig_caption": ig, "tiktok_text": tk, "hashtags": tags}

def generate_caption(name, price):
    """Genera caption IG + texto TikTok en la voz de marca con Claude."""
    import anthropic
    client = anthropic.Anthropic()  # lee ANTHROPIC_API_KEY del entorno
    precio = "$" + format(int(price), ",d").replace(",", ".") if price else ""
    system = (
        "Eres el community manager de Distribuidora El Maravilloso (Hualpén, Chile). "
        "Escribes copy para Instagram y TikTok en español chileno informal, cercano y en tono de oferta. "
        "Reglas: nunca menciones fiado ni crédito; usa emojis con moderación; cierra invitando a pasar o escribir por DM. "
        "Usa esta ficha de marca como fuente de verdad de voz, público y hashtags:\n\n" + BRAND_MD
    )
    user = (
        f"Genera el contenido para este producto en oferta:\n"
        f"Producto: {name}\nPrecio: {precio}\n\n"
        f"Devuelve: ig_caption (3-5 líneas con gancho, beneficio y llamado a la acción), "
        f"tiktok_text (1-2 líneas estilo POV/viral, más corto), "
        f"y hashtags (6-9 relevantes, mezcla locales y de producto, separados por espacio)."
    )
    msg = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1200,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"format": {"type": "json_schema", "schema": CAPTION_SCHEMA}},
    )
    text = next(b.text for b in msg.content if b.type == "text")
    return json.loads(text)

@app.post("/api/caption")
async def caption(req: Request):
    b = await req.json()
    name = b.get("name", "")
    price = int(b.get("price", 0) or 0)
    if b.get("ai"):  # IA de pago (opcional, requiere ANTHROPIC_API_KEY)
        try:
            cap = generate_caption(name, price)
        except Exception as e:
            m = str(e).lower()
            if "api_key" in m or "authentication" in m or "x-api-key" in m:
                return JSONResponse({"error": "no_key"}, status_code=400)
            return JSONResponse({"error": "fallo al generar"}, status_code=500)
    else:            # GRATIS por defecto (plantillas, sin llave)
        cap = templated_caption(name, price, b.get("variant", 0))
    # guarda en el post si existe
    if b.get("slug"):
        d = load_data()
        for p in d["posts"]:
            if p["slug"] == b["slug"]:
                p["caption"] = cap
        save_data(d)
    return cap

@app.post("/api/schedule")
async def schedule(req: Request):
    b = await req.json()
    d = load_data()
    for p in d["posts"]:
        if p["slug"] == b["slug"]:
            p["date"] = b.get("date", "")
            p["time"] = b.get("time", "")
            p["status"] = b.get("status", p["status"])
    save_data(d)
    return {"ok": True}

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
SUPABASE_ANON = os.environ.get("SUPABASE_ANON_KEY", "sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB")
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
    url = (f"{SUPABASE_URL}/rest/v1/products"
           f"?select=name,salePrice,category,stock"
           f"&deleted=eq.false"
           f"&order=name")
    req = urllib.request.Request(url, headers={
        "apikey":        SUPABASE_ANON,
        "Authorization": f"Bearer {SUPABASE_ANON}",
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
FB_SCOPES = "instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,pages_read_engagement,business_management,instagram_manage_comments,instagram_manage_messages,pages_manage_metadata,pages_messaging"
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

@app.get("/api/fb-connect")
def fb_connect():
    app_id = os.environ.get("FB_APP_ID")
    if not app_id:
        return JSONResponse({"error": "Falta FB_APP_ID en el .env"}, status_code=400)
    url = ("https://www.facebook.com/v21.0/dialog/oauth?"
           + urllib.parse.urlencode({"client_id": app_id, "redirect_uri": FB_REDIRECT,
                                     "scope": FB_SCOPES, "response_type": "code"}))
    return RedirectResponse(url)

def _get_json(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read())

@app.get("/api/fb-callback")
def fb_callback(code: str = "", error: str = "", error_description: str = ""):
    if error or not code:
        return HTMLResponse(f"<h2 style='font-family:sans-serif'>Conexión cancelada</h2><p>{error_description or 'Intenta de nuevo desde el Estudio.'}</p>")
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
        # 3) IG user id desde la página vinculada
        pages = _get_json(f"{GRAPH}/me/accounts?" + urllib.parse.urlencode(
            {"fields": "name,instagram_business_account", "access_token": token}))
        ig_id = None
        for pg in pages.get("data", []):
            if pg.get("instagram_business_account"):
                ig_id = pg["instagram_business_account"]["id"]
        json.dump({"access_token": token, "ig_user_id": ig_id, "expires_in": lon.get("expires_in"),
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
    return {"connected": bool(token and ig_id), "ig_user_id": ig_id, "connected_at": a.get("connected_at")}

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
    media = public_url(post["video"] if kind == "reel" else post["image"])
    if not media:
        return JSONResponse({"error": "no_hosting"}, status_code=400)
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

# ---------- Eliminar post ----------
@app.post("/api/delete")
async def delete(req: Request):
    b = await req.json()
    d = load_data()
    d["posts"] = [p for p in d["posts"] if p["slug"] != b["slug"]]
    save_data(d)
    return {"ok": True}

def open_browser():
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    import uvicorn
    print("\n  🎬  Estudio El Maravilloso  ->  http://127.0.0.1:8000\n")
    threading.Timer(1.2, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
