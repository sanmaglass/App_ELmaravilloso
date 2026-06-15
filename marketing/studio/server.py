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

    # imagen estática (feed)
    img_path = os.path.join(IMG_OUT, slug + ".png")
    drawer = T.STYLES.get(style, T.style_premium)
    drawer(name, price, product, tag=tag).convert("RGB").save(img_path, quality=92)

    # video (reel / tiktok)
    vid_path = os.path.join(VID_OUT, slug + ".mp4")
    args = argparse.Namespace(product=product, name=name, price=str(price),
                              out=vid_path, tag=tag, seconds=6.0, style=style)
    (MV.build_premium if style == "premium" else MV.build)(args)

    d = load_data()
    d["posts"] = [p for p in d["posts"] if p.get("slug") != slug]
    post = {"slug": slug, "filename": fname, "name": name, "price": price,
            "style": style, "tag": tag,
            "image": rel(img_path), "video": rel(vid_path),
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

# --- Motor de captions GRATIS (plantillas, sin IA, voz de marca El Maravilloso) ---
HOOKS = [
    "🔥 ¡OFERTA DE LA SEMANA! 🔥",
    "💥 ¡LLEGÓ LA OFERTA QUE ESPERABAS! 💥",
    "👀 ¡OJO CON ESTE PRECIO!",
    "⚡ ¡OFERTA RELÁMPAGO! ⚡",
    "😍 ¡APROVECHA ESTE PRECIAZO!",
    "🛒 ¡PRECIO QUE NO SE REPITE!",
]
BODIES = [
    "{name} a solo {price} 💪",
    "Llévate {name} por {price} 🙌",
    "{name} 👉 {price}, ni lo pienses 😎",
    "Tenemos {name} a {price} 🤑",
]
BENEFITS = [
    "Perfecto pa' la casa o pa' surtir tu negocio 😋",
    "Ideal para tu once, tu cocina o tu local 🏠",
    "Pa' tu hogar o tu comercio, siempre al mejor precio 🛍️",
    "Calidad y precio conveniente, como te gusta 👌",
]
TRUST = [
    "En El Maravilloso encuentras de todo, al mejor precio y con despacho 🚚",
    "Surtido amplio, precios de mayorista y despacho a domicilio 📦",
    "Variedad, buen precio y despacho — todo en un solo lugar ✅",
]
CTAS = [
    "📍 Hualpén — pásate o escríbenos por DM 📩",
    "📍 Te esperamos en Hualpén. Escríbenos por DM 📲",
    "🛒 Atendemos público y comercializadoras. ¡Pasa por nosotros! 📍 Hualpén",
]
TIKTOKS = [
    "POV: encontraste {name} a {price} 😎🔥 En El Maravilloso, Hualpén 🛒",
    "Corre que {name} está a {price} en El Maravilloso, Hualpén 🏃💨",
    "Esto sí es precio 👀 {name} a {price} · El Maravilloso, Hualpén",
    "Pa' la casa o pa' tu negocio: {name} {price} 🛒 Hualpén",
]
BASE_TAGS = "#ElMaravilloso #Hualpén #Concepción #Ofertas #Distribuidora #PrecioMayorista #Abarrotes"

def templated_caption(name, price, variant=0):
    p = _money(price)
    v = abs(hash(name)) + int(variant or 0)
    pick = lambda lst, off: lst[(v + off) % len(lst)]
    ig = "\n\n".join([
        pick(HOOKS, 0),
        pick(BODIES, 1).format(name=name, price=p) + "\n" + pick(BENEFITS, 2),
        pick(TRUST, 3),
        pick(CTAS, 4),
    ])
    tk = pick(TIKTOKS, 5).format(name=name, price=p) + " #fyp #parati"
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
FB_SCOPES = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management"
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
