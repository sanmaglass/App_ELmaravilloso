#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Panel local del Estudio — El Maravilloso.
Servidor FastAPI: subir fotos, generar imagen + video por producto,
ver grid, agendar en el calendario. Todo local (localhost).

Levantar:  python server.py   (o doble clic en INICIAR_ESTUDIO.bat)
"""
import os, sys, json, re, shutil, argparse, threading, webbrowser
from datetime import datetime

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
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
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
