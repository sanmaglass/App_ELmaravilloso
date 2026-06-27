#!/usr/bin/env python3
"""
Vigía de Contenido — El Maravilloso
Propone 2-3 piezas diarias mezcladas + contexto + competidores.
Corre en VPS (cron 8:30 AM) o local (test).

Uso:
  python vigia.py              # propuesta del día → Telegram
  python vigia.py --test       # solo imprime, no envía
  python vigia.py --nota "Biolimpieza publicó oferta de cloro"
"""
import os, sys, json, random, calendar, urllib.request, urllib.error
from datetime import datetime, timedelta
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "vigia_config.json"
HISTORY_PATH = SCRIPT_DIR / "vigia_history.json"
NOTAS_PATH = SCRIPT_DIR / "vigia_notas.json"

# ── ENV ──────────────────────────────────────────────────────────
def load_env():
    env = {}
    candidates = [
        Path.home() / "agentes" / ".env",           # VPS
        SCRIPT_DIR.parent / "studio" / ".env",       # local (marketing/studio)
    ]
    for p in candidates:
        if p.exists():
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env

# ── SUPABASE ─────────────────────────────────────────────────────
def get_products(env, limit=80):
    url = env.get("SUPABASE_URL", "")
    key = env.get("SUPABASE_SERVICE_KEY") or env.get("SUPABASE_KEY", "")
    if not url or not key:
        return []
    ep = f"{url}/rest/v1/marketing_catalog?select=name,salePrice,times_sold,last_sold&order=times_sold.desc&limit={limit}"
    req = urllib.request.Request(ep, headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"[vigia] Error productos: {e}")
        return []

# ── IG METRICS ───────────────────────────────────────────────────
def get_ig_metrics(env):
    token, uid = None, None
    for p in [Path.home() / "agentes" / "ig_auth.json",
              SCRIPT_DIR.parent / "studio" / "ig_auth.json"]:
        if p.exists():
            try:
                a = json.loads(p.read_text())
                token, uid = a.get("access_token"), a.get("ig_user_id")
                if token: break
            except: pass
    token = token or env.get("IG_TOKEN")
    uid = uid or env.get("IG_USER_ID")
    if not token or not uid:
        return None
    try:
        u = f"https://graph.facebook.com/v21.0/{uid}?fields=followers_count,media_count&access_token={token}"
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read())
            return {"followers": d.get("followers_count", "?"), "posts": d.get("media_count", "?")}
    except Exception as e:
        print(f"[vigia] Error IG: {e}")
        return None

# ── CONTEXTO CHILENO ─────────────────────────────────────────────
FERIADOS = {
    (1,1): "Año Nuevo", (5,1): "Día del Trabajador", (5,21): "Glorias Navales",
    (6,28): "San Pedro y San Pablo", (7,16): "Virgen del Carmen",
    (8,15): "Asunción", (9,18): "Fiestas Patrias 🇨🇱", (9,19): "Glorias del Ejército",
    (10,12): "Encuentro de Dos Mundos", (10,31): "Día Iglesias Evangélicas",
    (11,1): "Todos los Santos", (12,8): "Inmaculada Concepción", (12,25): "Navidad 🎄",
}

MOMENTOS = {
    (2,14): "San Valentín — chocolates, regalos, dulces",
    (3,8): "Día de la Mujer — detalle, flores",
    (9,18): "Dieciocho 🇨🇱 — empanadas, asado, bebidas, vino",
    (10,31): "Halloween 🎃 — dulces, decoración",
    (12,24): "Nochebuena — pan de pascua, cola de mono",
    (12,31): "Año Nuevo — espumante, lentejas, uvas",
}

TEMPORADAS = {
    "verano":     {"m": [12,1,2],  "kw": "bebida,jugo,agua,helado,limonada,cerveza", "tip": "calor, vacaciones"},
    "otoño":      {"m": [3,4,5],   "kw": "café,té,galleta,chocolate,manta", "tip": "vuelta a clases, fresco"},
    "invierno":   {"m": [6,7,8],   "kw": "sopa,chocolate,café,leche,pan,harina,azúcar,avena", "tip": "frío, once, hogar"},
    "primavera":  {"m": [9,10,11], "kw": "limpieza,aseo,bebida,carbón,carne", "tip": "fiestas patrias, renovar"},
}

def _nth_sunday(year, month, n):
    """N-ésimo domingo del mes."""
    c = calendar.monthcalendar(year, month)
    suns = [w[6] for w in c if w[6] != 0]
    return suns[n-1] if len(suns) >= n else suns[-1]

def get_context(now):
    ctx = {"dia": ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"][now.weekday()]}
    ctx["es_finde"] = now.weekday() >= 5
    ctx["es_viernes"] = now.weekday() == 4

    # Temporada
    for name, t in TEMPORADAS.items():
        if now.month in t["m"]:
            ctx["temporada"] = name
            ctx["kw_temporada"] = t["kw"]
            ctx["tip_temporada"] = t["tip"]
            break

    # Feriado hoy / próximo
    key = (now.month, now.day)
    if key in FERIADOS:
        ctx["feriado"] = FERIADOS[key]
    for d in range(1, 5):
        f = now + timedelta(days=d)
        fk = (f.month, f.day)
        if fk in FERIADOS:
            ctx["feriado_prox"] = f"{FERIADOS[fk]} ({f.strftime('%d/%m')})"
            break

    # Momentos marketing (fijos + madre/padre dinámicos)
    madre = _nth_sunday(now.year, 5, 2)
    padre = _nth_sunday(now.year, 6, 3)
    momentos = dict(MOMENTOS)
    momentos[(5, madre)] = "Día de la Madre 💐 — desayuno, torta, regalo"
    momentos[(6, padre)] = "Día del Padre 🍖 — parrilla, cerveza, snacks"
    if key in momentos:
        ctx["momento"] = momentos[key]
    for d in range(1, 5):
        f = now + timedelta(days=d)
        mk = (f.month, f.day)
        if mk in momentos:
            ctx["momento_prox"] = f"{momentos[mk]} ({f.strftime('%d/%m')})"
            break

    # Quincena
    ultimo = calendar.monthrange(now.year, now.month)[1]
    if now.day in (15, ultimo):
        ctx["quincena"] = True
    elif now.day in (14, 16) or now.day >= ultimo - 2:
        ctx["cerca_quincena"] = True

    return ctx

# ── HISTORIAL ────────────────────────────────────────────────────
def load_history():
    if HISTORY_PATH.exists():
        try: return json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
        except: pass
    return {"used": [], "last_types": [], "day_count": 0}

def save_history(h):
    HISTORY_PATH.write_text(json.dumps(h, ensure_ascii=False, indent=2), encoding="utf-8")

# ── NOTAS COMPETIDORES ───────────────────────────────────────────
def load_notas():
    if NOTAS_PATH.exists():
        try: return json.loads(NOTAS_PATH.read_text(encoding="utf-8"))
        except: pass
    return []

def save_notas(notas):
    NOTAS_PATH.write_text(json.dumps(notas, ensure_ascii=False, indent=2), encoding="utf-8")

def add_nota(text):
    notas = load_notas()
    notas.append({"fecha": datetime.now().strftime("%Y-%m-%d"), "nota": text})
    notas = notas[-50:]  # máximo 50
    save_notas(notas)
    print(f"[vigia] Nota guardada: {text}")

# ── CONFIG ───────────────────────────────────────────────────────
def load_config():
    if CONFIG_PATH.exists():
        try: return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except: pass
    return {}

# ── PRECIO CHILENO ───────────────────────────────────────────────
def precio_cl(p):
    try: return "$" + f"{int(p):,}".replace(",", ".")
    except: return f"${p}"

# ── MOTOR DE CONTENIDO ──────────────────────────────────────────
RECETAS = [
    "Pan amasado casero con {p} — receta 30 min",
    "Queque de {p} para la once — paso a paso",
    "Sopaipillas con {p} — clásico de invierno",
    "Galletas caseras con {p} — fin de semana",
    "Panqueques con {p} — desayuno express",
    "Sándwich con {p} — idea lonchera",
    "Arroz con {p} — almuerzo rápido",
    "Once completa con {p} — para toda la familia",
]

CERCANIA = [
    "Cómo llegar a El Maravilloso — Grecia 1841, a metros del colegio Montaner",
    "Conoce nuestra bodega — foto del local y el equipo",
    "Tu vecino de Hualpén — distribuidora de barrio con precios mayoristas",
    "Horarios: Lun a Sáb, colación 13 a 14h — te esperamos",
    "Despacho disponible — pregunta por WhatsApp",
    "Nuestro equipo preparando tu pedido — video del día",
    "Así se ve un día normal en El Maravilloso",
    "¿Nos conoces? Público y negocios, sin mínimo de compra",
]

DATOS = [
    "Hacemos despacho — pregunta por WhatsApp",
    "Público y negocios — precio mayorista sin mínimo",
    "Lunes a Sábado, colación 13 a 14h",
    "Grecia 1841, Hualpén — a metros del colegio Montaner",
    "Efectivo, transferencia y tarjeta",
    "Productos frescos cada semana — directo de fábrica",
]

DETRAS = [
    "Llegó mercadería nueva — así está la bodega hoy",
    "Preparando pedidos para la semana",
    "Ordenando estantes — todo fresquito",
    "Descargando camión — stock renovado",
]

def pick_products(products, history, n=5, season_kw=""):
    used = set(history.get("used", []))
    available = [p for p in products if p["name"] not in used]
    if len(available) < n:
        available = list(products)
    if not available:
        return []

    kw_list = [k.strip().lower() for k in season_kw.split(",") if k.strip()]
    weighted = []
    for p in available:
        w = max(1, p.get("times_sold", 1))
        name_low = p["name"].lower()
        for kw in kw_list:
            if kw in name_low:
                w *= 3
                break
        weighted.append((p, w))

    total_w = sum(w for _, w in weighted)
    chosen = []
    for _ in range(min(n, len(weighted))):
        r = random.random() * total_w
        cum = 0
        for i, (p, w) in enumerate(weighted):
            cum += w
            if cum >= r:
                chosen.append(p)
                total_w -= w
                weighted.pop(i)
                break
    return chosen

def pick_content(products, ctx, history, config):
    proposals = []
    last_t = history.get("last_types", [])
    kw = ctx.get("kw_temporada", "")
    prods = pick_products(products, history, n=6, season_kw=kw)
    pi = 0

    def np():
        nonlocal pi
        if pi < len(prods):
            p = prods[pi]; pi += 1; return p
        return None

    estilos_video = ["premium", "dark", "giant", "split", "amigable"]

    # ── SLOT 1: Oferta (casi siempre) ──
    p = np()
    if p:
        proposals.append({
            "tipo": "oferta", "emoji": "🏷️",
            "titulo": f"{p['name']} a {precio_cl(p['salePrice'])}",
            "detalle": f"Video/reel con precio. {p.get('times_sold','?')} ventas registradas.",
            "producto": p["name"],
            "estilo": random.choice(estilos_video),
        })

    # ── SLOT 2: Varía según contexto ──
    if ctx.get("feriado"):
        proposals.append({
            "tipo": "situacional", "emoji": "🎉",
            "titulo": f"¡{ctx['feriado']}!",
            "detalle": f"Post temático. Empujar: {kw}",
            "estilo": "amigable",
        })
    elif ctx.get("momento"):
        proposals.append({
            "tipo": "situacional", "emoji": "🎯",
            "titulo": ctx["momento"],
            "detalle": "Aprovechar la fecha con contenido temático.",
            "estilo": "premium",
        })
    elif ctx.get("quincena"):
        proposals.append({
            "tipo": "situacional", "emoji": "💰",
            "titulo": "¡Quincena! Surtí tu despensa con los mejores precios",
            "detalle": "La gente tiene plata — ofertas fuertes, volante multi-producto.",
            "estilo": "amigable",
        })
    elif ctx.get("es_viernes"):
        proposals.append({
            "tipo": "situacional", "emoji": "🍞",
            "titulo": "Viernes de once — tenemos todo para una once completa",
            "detalle": "Productos de panadería, acompañamiento, café/té.",
            "estilo": "premium",
        })
    elif "receta" not in last_t[-3:]:
        p2 = np()
        if p2:
            proposals.append({
                "tipo": "receta", "emoji": "🍳",
                "titulo": random.choice(RECETAS).format(p=p2["name"].title()),
                "detalle": f"Post educativo con {p2['name']}. Muestra uso real.",
                "producto": p2["name"],
                "estilo": "premium",
            })
    elif "cercania" not in last_t[-5:]:
        proposals.append({
            "tipo": "cercania", "emoji": "📍",
            "titulo": random.choice(CERCANIA),
            "detalle": "Foto real del local/equipo/barrio. Conectar con la comunidad.",
            "estilo": "foto real (celular)",
        })
    else:
        proposals.append({
            "tipo": "dato", "emoji": "ℹ️",
            "titulo": random.choice(DATOS),
            "detalle": "Story o post informativo. Útil para clientes nuevos.",
            "estilo": "story",
        })

    # ── SLOT 3: Complemento ──
    if ctx.get("es_finde") and "combo" not in last_t[-3:]:
        pp = [np() for _ in range(3)]
        pp = [x for x in pp if x]
        if len(pp) >= 2:
            names = [x["name"] for x in pp]
            proposals.append({
                "tipo": "combo", "emoji": "📦",
                "titulo": f"Pack: {' + '.join(names[:3])}",
                "detalle": "Armar combo con precio especial. Multi-producto.",
                "productos": names,
                "estilo": "amigable",
            })
    elif "detras" not in last_t[-5:] and random.random() < 0.3:
        proposals.append({
            "tipo": "detras", "emoji": "📸",
            "titulo": random.choice(DETRAS),
            "detalle": "Foto/video real sin editar. Humaniza la marca.",
            "estilo": "foto real (celular)",
        })
    else:
        p3 = np()
        if p3:
            proposals.append({
                "tipo": "oferta", "emoji": "🏷️",
                "titulo": f"{p3['name']} a {precio_cl(p3['salePrice'])}",
                "detalle": "Segunda oferta. Usar estilo distinto al primero.",
                "producto": p3["name"],
                "estilo": random.choice([s for s in estilos_video if s != proposals[0].get("estilo", "")]),
            })

    # Actualizar historial
    new_prods = [pr.get("producto", "") for pr in proposals if pr.get("producto")]
    new_prods += [n for pr in proposals for n in pr.get("productos", [])]
    history["used"] = (history.get("used", []) + [n for n in new_prods if n])[-40:]
    history["last_types"] = (last_t + [pr["tipo"] for pr in proposals])[-12:]
    history["day_count"] = history.get("day_count", 0) + 1

    return proposals

# ── FORMATO TELEGRAM ─────────────────────────────────────────────
def format_message(proposals, ctx, ig, config, notas, now):
    L = []
    dia = ctx["dia"].upper()
    fecha = now.strftime("%d/%m/%Y")
    L.append(f"<b>📋 VIGÍA DE CONTENIDO</b>")
    L.append(f"<b>{dia} {fecha}</b>\n")

    # Contexto
    cx = []
    if ctx.get("temporada"):
        cx.append(f"🌡️ {ctx['temporada'].capitalize()} — {ctx.get('tip_temporada','')}")
    if ctx.get("feriado"):
        cx.append(f"🎉 HOY: {ctx['feriado']}")
    if ctx.get("feriado_prox"):
        cx.append(f"📅 Viene: {ctx['feriado_prox']}")
    if ctx.get("momento"):
        cx.append(f"🎯 {ctx['momento']}")
    elif ctx.get("momento_prox"):
        cx.append(f"🎯 Viene: {ctx['momento_prox']}")
    if ctx.get("quincena"):
        cx.append("💰 ¡QUINCENA!")
    elif ctx.get("cerca_quincena"):
        cx.append("💰 Se viene la quincena")
    if ctx.get("es_viernes"):
        cx.append("🍞 Viernes de once")
    elif ctx.get("es_finde"):
        cx.append("🛒 Fin de semana")
    if cx:
        L.append("<b>📆 CONTEXTO</b>")
        L += [f"  {c}" for c in cx]
        L.append("")

    # Propuestas
    L.append("<b>🎬 QUÉ PUBLICAR HOY</b>")
    for i, pr in enumerate(proposals, 1):
        L.append(f"\n<b>{i}. {pr['emoji']} {pr['titulo']}</b>")
        L.append(f"   Tipo: {pr['tipo']} | Estilo: {pr.get('estilo','?')}")
        L.append(f"   → {pr['detalle']}")
    L.append("")

    # Competidores
    comps = config.get("competidores", [])
    recientes = [n for n in notas
                 if n.get("fecha", "") >= (now - timedelta(days=3)).strftime("%Y-%m-%d")]
    if comps:
        L.append("<b>👁️ COMPETIDORES</b>")
        if recientes:
            for n in recientes[-4:]:
                L.append(f"  • <i>{n['nota']}</i>")
        else:
            nombres = [c["nombre"] for c in comps[:4]]
            L.append(f"  Sin notas recientes. Revisa: {', '.join(nombres)}")
            L.append("  → Manda: <code>python vigia.py --nota \"Biolimpieza publicó X\"</code>")
        L.append("")

    # IG
    if ig:
        L.append(f"<b>📊 TU IG</b>: {ig['followers']} seguidores | {ig['posts']} posts")
        L.append("")

    # Pie
    L.append("Abre el Estudio y genera las piezas que elijas.")

    return "\n".join(L)

# ── TELEGRAM ─────────────────────────────────────────────────────
def send_telegram(env, message):
    token = env.get("TELEGRAM_TOKEN")
    chat = env.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        return False
    data = json.dumps({
        "chat_id": chat, "text": message,
        "parse_mode": "HTML", "disable_web_page_preview": True
    }).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status == 200
    except Exception as e:
        print(f"[vigia] Error Telegram: {e}")
        return False

# ── MAIN ─────────────────────────────────────────────────────────
def main():
    random.seed()
    args = sys.argv[1:]

    # Comando: agregar nota de competidor
    if "--nota" in args:
        idx = args.index("--nota")
        text = " ".join(args[idx+1:])
        if text:
            add_nota(text)
        else:
            print("Uso: python vigia.py --nota \"Biolimpieza publicó oferta de cloro\"")
        return 0

    test_mode = "--test" in args
    now = datetime.now()
    print(f"[vigia] {now.strftime('%Y-%m-%d %H:%M')} — {'TEST' if test_mode else 'Generando'}...")

    env = load_env()
    config = load_config()
    history = load_history()
    notas = load_notas()

    products = get_products(env)
    ig = get_ig_metrics(env)
    ctx = get_context(now)

    print(f"[vigia] {len(products)} productos | {ctx.get('temporada','?')} | {ctx['dia']}")

    if not products:
        products = [{"name": "PRODUCTO ESTRELLA", "salePrice": 0, "times_sold": 1}]

    proposals = pick_content(products, ctx, history, config)
    message = format_message(proposals, ctx, ig, config, notas, now)

    if test_mode:
        import re
        clean = re.sub(r"<[^>]+>", "", message)
        # Windows cp1252 no soporta emojis — reemplazar con ?
        try:
            print("\n" + clean)
        except UnicodeEncodeError:
            print("\n" + clean.encode("ascii", "replace").decode())
        return 0

    ok = send_telegram(env, message)
    if ok:
        save_history(history)
        print("[vigia] Enviado OK")
    else:
        print("[vigia] Sin Telegram — imprimiendo:")
        import re
        print(re.sub(r"<[^>]+>", "", message))
        save_history(history)

    return 0

if __name__ == "__main__":
    sys.exit(main())
