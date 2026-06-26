#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Plantillas de diseño del Estudio — El Maravilloso.
Cada estilo dibuja el "frame final" (todo visible) de una pieza 1080x1920.
El preview las usa para PNG; el motor de video las anima.

Estilos:
  A = clasica   (rojo + starburst, logo arriba)
  B = descuento (antes/ahora, sello de ahorro)
  C = premium   (fondo claro, look catalogo)
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

RED=(237,28,36); RED_DARK=(176,16,24); RED_HI=(242,70,78)
BLUE=(0,102,179); WHITE=(255,255,255); YELLOW=(255,214,10)
INK=(28,28,30); CREAM=(245,242,236); GREY=(120,120,124)
# acentos "agencia"
RED_DEEP=(138,12,20); RED_INK=(92,8,14)
CREAM_HI=(250,248,243); CREAM_LO=(236,231,222); CREAM_EDGE=(228,222,211)
INK_SOFT=(90,84,78); GREY_STRIKE=(154,154,154)
GOLD=(198,160,92); GOLD_HI=(226,196,138); CREAM_RING=(250,247,240)
W,H=1080,1920
FONTS="C:/Windows/Fonts/"
ASSETS=os.path.join(os.path.dirname(__file__),"..","assets")
FONTS_DIR=os.path.join(ASSETS,"fonts")

# tamaños de salida (formatos)
SIZES={"story":(1080,1920),"feed":(1080,1080),"feed45":(1080,1350)}
def dims(fmt="story"): return SIZES.get(fmt,SIZES["story"])

def font(names,size):
    """Busca primero en assets/fonts/, luego en Windows; NUNCA crashea."""
    if isinstance(names,str): names=[names]
    for n in names:
        # ruta directa (assets/fonts) o nombre de archivo
        for base in (FONTS_DIR,FONTS):
            p=n if os.path.isabs(n) else os.path.join(base,n)
            if os.path.exists(p):
                try: return ImageFont.truetype(p,size)
                except Exception: pass
    for n in ["arialbd.ttf","arial.ttf"]:
        p=os.path.join(FONTS,n)
        if os.path.exists(p):
            try: return ImageFont.truetype(p,size)
            except Exception: pass
    return ImageFont.load_default()

# --- roles tipográficos (con fallback en cadena) ---
def f_price(s):   return font(["Anton-Regular.ttf","impact.ttf"],s)                 # PRECIO héroe
def f_display(s): return font(["BebasNeue-Regular.ttf","Anton-Regular.ttf","impact.ttf"],s)  # titulares
def f_name(s):    return font(["Montserrat-ExtraBold.ttf","ariblk.ttf","arialbd.ttf"],s)     # nombre fuerte
def f_ui(s):      return font(["Montserrat-SemiBold.ttf","arialbd.ttf"],s)          # footer/pills
def f_strike(s):  return font(["Montserrat-Bold.ttf","arialbd.ttf"],s)             # tachado/fino
# --- alias compatibles (estilos existentes heredan el upgrade) ---
def f_impact(s): return f_price(s)
def f_black(s):  return f_name(s)
def f_cond(s):   return f_display(s)
def f_bold(s):   return f_ui(s)

def fmt(p): return "$"+format(int(p),",d").replace(",",".")
def fmt_money(p): return fmt(p)   # alias seguro (param 'fmt' no lo tapa)

def defringe(im,erode=1):
    """Quita el halo claro del recorte: contrae el alpha y oscurece el borde residual.
    Evita el 'fringe' blanco del matte sobre fondo crema. NUNCA crashea."""
    try:
        r,g,b,a=im.split()
        # contraer alpha (MinFilter erosiona el borde claro)
        if erode>0:
            a2=a.filter(ImageFilter.MinFilter(3))
        else:
            a2=a
        # suavizar 1px para que no quede aliasing duro
        a2=a2.filter(ImageFilter.GaussianBlur(0.6))
        return Image.merge("RGBA",(r,g,b,a2))
    except Exception:
        return im

def load_product(path,maxw,maxh,clean=True):
    im=Image.open(path).convert("RGBA")
    if clean: im=defringe(im)
    sc=min(maxw/im.width,maxh/im.height)
    return im.resize((int(im.width*sc),int(im.height*sc)),Image.LANCZOS)

def shadow_of(prod,blur=24,op=0.45):
    sh=Image.new("RGBA",prod.size,(0,0,0,0))
    sh.putalpha(prod.split()[3].point(lambda v:int(v*op)))
    return sh.filter(ImageFilter.GaussianBlur(blur))

def paste_c(base,im,cx,cy,scale=1.0):
    if scale!=1.0:
        im=im.resize((max(1,int(im.width*scale)),max(1,int(im.height*scale))),Image.LANCZOS)
    base.alpha_composite(im,(int(cx-im.width/2),int(cy-im.height/2)))

def txt(d,xy,s,fnt,fill,anchor="mm",stroke=0,sfill=(0,0,0)):
    d.text(xy,s,font=fnt,fill=fill,anchor=anchor,stroke_width=stroke,stroke_fill=sfill)

def starburst(size,color,spikes=16,inner=0.74):
    im=Image.new("RGBA",(size,size),(0,0,0,0)); d=ImageDraw.Draw(im); c=size/2; pts=[]
    for i in range(spikes*2):
        a=(i/(spikes*2))*2*math.pi; r=c*(1.0 if i%2==0 else inner)
        pts.append((c+math.cos(a)*r,c+math.sin(a)*r))
    d.polygon(pts,fill=color+(255,)); return im

def bg_red():
    yy,xx=np.mgrid[0:H,0:W].astype(np.float32); cx,cy=W/2,H*0.42
    dd=np.clip(np.sqrt((xx-cx)**2+(yy-cy)**2)/(W*0.85),0,1)
    a=np.zeros((H,W,3),np.float32)
    for i,(hi,lo) in enumerate(zip(RED_HI,RED_DARK)): a[...,i]=hi*(1-dd)+lo*dd
    base=Image.fromarray(a.astype(np.uint8),"RGB").convert("RGBA")
    rays=Image.new("L",(W,H),0); rd=ImageDraw.Draw(rays); n=24
    for k in range(0,n,2):
        a0=(k/n)*2*math.pi; pts=[(cx,cy)]
        for da in(-0.13,0.13): pts.append((cx+math.cos(a0+da)*1600,cy+math.sin(a0+da)*1600))
        rd.polygon(pts,fill=26)
    rays=rays.filter(ImageFilter.GaussianBlur(6))
    glow=Image.new("RGBA",(W,H),RED_HI+(0,)); glow.putalpha(rays); base.alpha_composite(glow)
    return base

def pill(d,cx,cy,w,h,fill,radius=None):
    radius=radius or h//2
    d.rounded_rectangle([cx-w/2,cy-h/2,cx+w/2,cy+h/2],radius=radius,fill=fill)

# ================= ESTILO AMIGABLE (multi-producto, fondo suave) =================
# Inspirado en catálogos tipo "distribuidora": fondo claro con grilla, monedas %,
# wordmark limpio (sin recuadro), título grande, precio en píldora y 2+ productos.
PAL_TEAL = dict(
    bg=(150,210,214), bg2=(184,228,229), grid=(255,255,255), grid_a=44,
    blob=(120,196,201), coin=(70,165,172), coin_rim=(120,200,205),
    ink=(18,52,58), muted=(36,86,92), pill=(16,48,54), pill_txt=(255,255,255),
)
PAL_WARM = dict(
    bg=(250,236,222), bg2=(252,246,238), grid=(220,150,120), grid_a=26,
    blob=(248,214,188), coin=(228,92,70), coin_rim=(244,150,130),
    ink=(86,30,26), muted=(150,86,66), pill=(200,30,40), pill_txt=(255,255,255),
)
PAL_MINT = dict(
    bg=(204,228,200), bg2=(224,240,220), grid=(255,255,255), grid_a=40,
    blob=(176,212,170), coin=(120,176,108), coin_rim=(168,210,156),
    ink=(38,66,38), muted=(70,104,66), pill=(46,86,46), pill_txt=(255,255,255),
)
# Paleta El Maravilloso: crema cálida + ROJO de marca + monedas DORADAS (plata/ahorro).
# Layout amigable pero identidad propia (no el teal de la referencia).
PAL_MARCA = dict(
    bg=(247,238,224), bg2=(252,246,236), grid=(198,128,76), grid_a=18,
    blob=(248,222,188), coin=(208,166,86), coin_rim=(232,198,132),
    ink=(160,22,28), muted=(150,104,72), pill=(214,28,36), pill_txt=(255,255,255),
)
PALETTES={"marca":PAL_MARCA,"teal":PAL_TEAL,"warm":PAL_WARM,"mint":PAL_MINT}

def _rrect(d,box,r,fill):
    d.rounded_rectangle(box,radius=r,fill=fill)

def _wrap(s,maxc):
    words=s.split(); lines=[]; cur=""
    for w in words:
        if len(cur)+len(w)+1<=maxc: cur=(cur+" "+w).strip()
        else: lines.append(cur); cur=w
    if cur: lines.append(cur)
    return lines or [s]

def fit_title(name,maxw_px,size_hi,size_lo,max_lines=3,font_fn=None):
    """Ajusta la fuente para que TODO el texto entre en ancho y nº de líneas, sin perder
    palabras. Devuelve (font, lines, size). Achica de size_hi a size_lo. font_fn = rol tipográfico."""
    ff=font_fn or f_name
    name=(name or "").strip(); words=name.split()
    tmp=ImageDraw.Draw(Image.new("RGBA",(10,10)))
    for size in range(int(size_hi),int(size_lo)-1,-4):
        f=ff(size); lines=[]; cur=""
        for w in words:
            test=(cur+" "+w).strip()
            if not cur or tmp.textlength(test,font=f)<=maxw_px: cur=test
            else: lines.append(cur); cur=w
        if cur: lines.append(cur)
        if lines and len(lines)<=max_lines and all(tmp.textlength(l,font=f)<=maxw_px for l in lines):
            return f,lines,size
    f=ff(int(size_lo))
    return f,(_wrap(name,16)[:max_lines] or [name or " "]),int(size_lo)

# Titulares llamativos (rotan en cada generación para dar variedad)
HEADLINES=["¡OFERTÓN!","PRECIAZO","¡APROVECHA!","SÚPER PRECIO","¡IMPERDIBLE!",
           "LLÉVATELO HOY","OJO ESTE PRECIO","¡REBAJADO!","SOLO POR HOY","PRECIO INCREÍBLE",
           "¡NO TE LO PIERDAS!","OFERTA DE LA SEMANA","PRECIO BOMBA","¡ÚLTIMOS DÍAS!","DIRECTO DE FÁBRICA"]
def pick_headline(i):
    return HEADLINES[int(i)%len(HEADLINES)]

def brand_header(W, text_color=(160,22,28), text="EL MARAVILLOSO"):
    """Lockup horizontal LIMPIO compuesto por código: esfera + nombre bien espaciados,
    centrados verticalmente, sin cruces. Fondo transparente. Devuelve imagen RGBA."""
    ic=brand_icon()
    s=int(W*0.165); ich=int(ic.height*s/ic.width); ic=ic.resize((s,ich),Image.LANCZOS)
    f=f_name(int(W*0.052))
    tmp=ImageDraw.Draw(Image.new("RGBA",(10,10)))
    bb=tmp.textbbox((0,0),text,font=f); tw=bb[2]-bb[0]; th=bb[3]-bb[1]
    gap=int(W*0.022); pad=int(s*0.12)  # margen para la sombra
    Wt=pad+s+gap+tw+pad; Ht=max(ich,th)+pad*2
    im=Image.new("RGBA",(Wt,Ht),(0,0,0,0))
    icy=(Ht-ich)//2
    # sombra suave de la esfera (para que RESALTE sobre fondos claros, no se vea pálida)
    sh=Image.new("RGBA",(s,ich),(0,0,0,0)); sh.putalpha(ic.split()[3].point(lambda v:int(v*0.42)))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(max(2,int(s*0.05)))),(pad+int(s*0.02),icy+int(s*0.04)))
    im.alpha_composite(ic,(pad,icy))
    ImageDraw.Draw(im).text((pad+s+gap, Ht//2), text, font=f, fill=tuple(text_color)+(255,), anchor="lm")
    return im

def place_brand_header(im,cx,cy,target_h,text_color):
    """Coloca el header de marca (esfera glossy + EL MARAVILLOSO) escalado a una altura, centrado en (cx,cy)."""
    h=brand_header(im.width,text_color=text_color)
    sc=target_h/h.height
    h=h.resize((max(1,int(h.width*sc)),max(1,int(h.height*sc))),Image.LANCZOS)
    paste_c(im,h,cx,cy)

def brand_icon():
    """Solo la ESFERA M, sin el texto blanco de abajo NI el lavado gris semi-transparente
    de fondo (logo_v2 trae alpha ~51 en todo el fondo -> se ve un recuadro gris)."""
    lg=Image.open(os.path.join(ASSETS,"logo_v2.png")).convert("RGBA")
    r,g,b,a=lg.split()
    a=a.point(lambda v: 0 if v<140 else v)   # matar el lavado gris (alpha bajo) -> transparente
    lg=Image.merge("RGBA",(r,g,b,a))
    bb=lg.getbbox()
    if bb: lg=lg.crop(bb)
    sph=lg.crop((0,0,lg.width,int(lg.height*0.62)))  # el nombre blanco va en el ~30% inferior
    bb2=sph.getbbox()
    if bb2: sph=sph.crop(bb2)
    return sph

def bg_friendly(pal,Wf,Hf):
    """Fondo suave con degradé vertical sutil + grilla fina + blobs de profundidad."""
    yy=np.linspace(0,1,Hf,dtype=np.float32)[:,None]
    a=np.zeros((Hf,Wf,3),np.float32)
    for i in range(3): a[...,i]=pal["bg2"][i]*(1-yy)+pal["bg"][i]*yy
    base=Image.fromarray(a.astype(np.uint8),"RGB").convert("RGBA")
    blob=Image.new("RGBA",(Wf,Hf),(0,0,0,0)); bd=ImageDraw.Draw(blob)
    bd.ellipse([Wf*0.55,-Hf*0.10,Wf*1.25,Hf*0.30],fill=pal["blob"]+(120,))
    bd.ellipse([-Wf*0.25,Hf*0.62,Wf*0.30,Hf*1.05],fill=pal["blob"]+(90,))
    base.alpha_composite(blob.filter(ImageFilter.GaussianBlur(80)))
    grid=Image.new("RGBA",(Wf,Hf),(0,0,0,0)); gd=ImageDraw.Draw(grid)
    step=int(Wf/12); col=pal["grid"]+(pal["grid_a"],)
    for x in range(0,Wf+1,step): gd.line([(x,0),(x,Hf)],fill=col,width=2)
    for y in range(0,Hf+1,step): gd.line([(0,y),(Wf,y)],fill=col,width=2)
    base.alpha_composite(grid)
    return base

def coin_pct(size,pal):
    """Moneda decorativa con '%' (disco 3D plano)."""
    S=size*3
    im=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.ellipse([S*0.06,S*0.12,S*0.94,S],fill=pal["coin_rim"]+(255,))
    d.ellipse([S*0.06,0,S*0.94,S*0.88],fill=pal["coin"]+(255,))
    d.text((S*0.5,S*0.43),"%",font=f_price(int(S*0.5)),fill=(255,255,255,235),anchor="mm")
    return im.resize((size,size),Image.LANCZOS)

def wordmark(im,pal,cx,cy_top,style="banner"):
    """Header limpio (esfera + EL MARAVILLOSO) alineado a la IZQUIERDA, para que la
    moneda % del top-right no lo tape. Devuelve y inferior."""
    W=im.width
    hdr=brand_header(W, text_color=pal["ink"])
    tw=int(W*0.58); th=int(hdr.height*tw/hdr.width); hdr=hdr.resize((tw,th),Image.LANCZOS)
    im.alpha_composite(hdr,(int(W*0.06),int(cy_top)))
    return cy_top+th+int(W*0.025)

def price_tag(price,pal,fsz,gram=None):
    """Etiqueta de precio (píldora roja). Si hay gramaje, va arriba en chico + precio abajo."""
    f=f_price(fsz); txt=fmt(price)
    tmp=ImageDraw.Draw(Image.new("RGBA",(10,10)))
    bb=tmp.textbbox((0,0),txt,font=f); pw=bb[2]-bb[0]; ph=bb[3]-bb[1]
    gw=gh=0; gtxt=""; gf=None
    if gram:
        gtxt=str(gram).upper(); gf=f_ui(int(fsz*0.46))
        gb=tmp.textbbox((0,0),gtxt,font=gf); gw=gb[2]-gb[0]; gh=gb[3]-gb[1]
    padx,pady,gap=int(fsz*0.55),int(fsz*0.40),int(fsz*0.14)
    contentw=max(pw,gw); contenth=ph+((gh+gap) if gram else 0)
    W2,H2=contentw+padx*2,contenth+pady*2
    rad=int(min(W2,H2)*0.34)
    sh=Image.new("RGBA",(W2,H2),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle([0,4,W2-1,H2-1+4],radius=rad,fill=(0,0,0,70))
    base=Image.new("RGBA",(W2,H2+6),(0,0,0,0)); base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)),(0,2))
    d2=ImageDraw.Draw(base)
    d2.rounded_rectangle([0,0,W2-1,H2-1],radius=rad,fill=tuple(pal["pill"])+(255,))
    y=pady
    if gram:
        d2.text((W2/2,y-gb[1]),gtxt,font=gf,fill=(255,255,255,215),anchor="ma"); y+=gh+gap
    d2.text((W2/2,y-bb[1]),txt,font=f,fill=tuple(pal["pill_txt"])+(255,),anchor="ma")
    return base

def _norm_items(products,default_price):
    """Normaliza products a [{path,price,name,gram}]. Acepta rutas (str) o dicts."""
    out=[]
    for p in (products or []):
        if isinstance(p,dict):
            if p.get("path"): out.append({"path":p["path"],"price":p.get("price"),"name":p.get("name",""),"gram":p.get("gram")})
        elif p:
            out.append({"path":p,"price":default_price,"name":"","gram":None})
    return out[:3]

def products_geom(W,items,pal,maxh,top_y=None,cy=None,show_prices=False):
    """Calcula la geometría (imágenes + posiciones) de los productos y sus etiquetas.
    Devuelve lista de dicts: {img,cx,cy,floor, tag?,tcx?,tcy?}. Una sola fuente de verdad
    de posiciones, usada por la imagen estática Y por la animación del video."""
    items=_norm_items(items,None)
    if not items: return []
    n=len(items); ov=int(W*0.055)
    per_w=min(int(W*0.62),int((W*0.98+ov*(n-1))/n))
    prods=[load_product(it["path"],per_w,maxh) for it in items]
    if top_y is not None:
        cy=top_y+max(p.height for p in prods)/2
    total=sum(p.width for p in prods)-ov*(n-1)
    xs=[]; x=W/2-total/2
    for p in prods:
        xs.append(x+p.width/2); x+=p.width-ov
    tsz=int(W*(0.058 if n<=2 else 0.046))
    base_y=cy+max(p.height for p in prods)/2   # línea común = base del producto más alto
    out=[]
    for i,p in enumerate(prods):
        g={"img":p,"cx":xs[i],"cy":cy,"floor":shadow_of(p,blur=30,op=0.28)}
        if show_prices and items[i].get("price"):
            tag=price_tag(items[i]["price"],pal,tsz,gram=items[i].get("gram"))
            # TODAS las etiquetas a la MISMA altura (acorde), apenas bajo el producto
            g["tag"]=tag; g["tcx"]=xs[i]; g["tcy"]=base_y+tag.height*0.12
        out.append(g)
    return out

def draw_products_geom(im,geom):
    """Dibuja la geometría calculada (sombras, productos con centro al frente, etiquetas)."""
    n=len(geom)
    for g in geom:
        im.alpha_composite(g["floor"],(int(g["cx"]-g["img"].width/2+10),int(g["cy"]-g["img"].height/2+24)))
    for i in sorted(range(n),key=lambda i:abs(i-(n-1)/2),reverse=True):
        paste_c(im,geom[i]["img"],geom[i]["cx"],geom[i]["cy"])
    for g in geom:
        if g.get("tag") is not None: paste_c(im,g["tag"],g["tcx"],g["tcy"])

def place_products(im,items,pal,cy,maxh,show_prices=False,top_y=None):
    """Coloca 1..3 productos (fachada estática que usa products_geom + draw_products_geom)."""
    geom=products_geom(im.width,items,pal,maxh,top_y=top_y,cy=cy,show_prices=show_prices)
    draw_products_geom(im,geom)

def _pin(d,x,y,r,fill):
    """Dibuja un pin de ubicación simple (gota + punto)."""
    d.ellipse([x-r,y-r*1.4,x+r,y+r*0.2],fill=fill)
    d.polygon([(x-r*0.7,y-r*0.2),(x+r*0.7,y-r*0.2),(x,y+r*0.9)],fill=fill)
    d.ellipse([x-r*0.42,y-r*0.95,x+r*0.42,y-r*0.11],fill=(255,255,255,255))

def amigable_bars(im,pal,Wf,Hf,tagline="OFERTAS DE LA SEMANA",sub="Solo por unos días",
                  addr="GRECIA 1841, HUALPÉN",hours="Lun a Sáb 10–20   ·   Dom 10–17"):
    """Banner superior (logo blanco + urgencia) y barra inferior (dirección + horario),
    estilo flyer. Devuelve (alto_top, alto_bottom). Inspirado en flyers de bodega."""
    d=ImageDraw.Draw(im); red=tuple(pal["pill"]); gold=(212,170,90)
    th=int(Hf*0.108); bh=int(Hf*0.092)
    # ---- TOP banner ----
    d.rectangle([0,0,Wf,th],fill=red+(255,)); d.rectangle([0,th,Wf,th+6],fill=gold+(255,))
    hdr=brand_header(Wf,text_color=(255,255,255))
    hw=int(Wf*0.42); hh=int(hdr.height*hw/hdr.width); hdr=hdr.resize((hw,hh),Image.LANCZOS)
    im.alpha_composite(hdr,(int(Wf*0.035),(th-hh)//2))
    d.text((Wf*0.965,th*0.40),tagline,font=f_name(int(Wf*0.030)),fill=(255,255,255,255),anchor="rm")
    d.text((Wf*0.965,th*0.68),sub,font=f_ui(int(Wf*0.024)),fill=(255,232,180,255),anchor="rm")
    # ---- BOTTOM bar ----
    d.rectangle([0,Hf-bh,Wf,Hf],fill=red+(255,)); d.rectangle([0,Hf-bh,Wf,Hf-bh+6],fill=gold+(255,))
    af=f_name(int(Wf*0.036)); aw=d.textlength(addr,font=af)
    _pin(d,int(Wf/2-aw/2-Wf*0.035),int(Hf-bh*0.62),int(Wf*0.022),(255,232,180,255))
    d.text((Wf/2+Wf*0.012,Hf-bh*0.62),addr,font=af,fill=(255,255,255,255),anchor="mm")
    d.text((Wf/2,Hf-bh*0.26),hours,font=f_ui(int(Wf*0.026)),fill=(255,235,200,255),anchor="mm")
    return th,bh

def style_amigable(name,price,products,pal="marca",fmt_str=None,fmt2="feed45",headline=None,
                   header_style="banner",skip_products=False,return_geom=False):
    """Pieza amigable multi-producto. products: rutas o dicts {path,price,name,gram}.
    skip_products: no dibuja los productos/etiquetas (para la BASE del video animado).
    return_geom: devuelve (imagen, geom_productos) para que el video los anime en sus posiciones."""
    P=PALETTES.get(pal,PAL_MARCA)
    Wf,Hf=dims(fmt2)
    im=bg_friendly(P,Wf,Hf); d=ImageDraw.Draw(im); cx=Wf/2
    im.alpha_composite(coin_pct(int(Wf*0.20),P),(int(Wf*0.83),int(Hf*0.155)))
    im.alpha_composite(coin_pct(int(Wf*0.16),P),(int(-Wf*0.05),int(Hf*0.58)))
    top_h,bot_h=amigable_bars(im,P,Wf,Hf)   # banner superior (logo) + barra inferior (dirección/horario)
    y0=top_h
    # titular llamativo (display condensado) — rota para variar
    hl=headline or pick_headline(abs(hash(name or ""))%len(HEADLINES))
    hfnt,hlines,hsz=fit_title(hl,Wf*0.88,Wf*0.150,Wf*0.09,2,font_fn=f_display)
    sfnt,slines,ssz=fit_title(name,Wf*0.80,Wf*0.070,Wf*0.05,2,font_fn=f_name)
    yy=y0+Hf*0.022  # posicionado por BORDE SUPERIOR para no chocar con el header
    for ln in hlines:
        d.text((cx,yy+hsz*0.5),ln,font=hfnt,fill=P["pill"]+(255,),anchor="mm")  # rojo de marca = pega
        yy+=hsz*1.0
    yy+=Hf*0.008
    for ln in slines:
        d.text((cx,yy+ssz*0.55),ln,font=sfnt,fill=P["ink"]+(255,),anchor="mm")
        yy+=ssz*1.12
    block_bottom=yy
    items=_norm_items(products,price)
    per_product=len(items)>1   # 2+ productos = precio por producto (sin píldora central)
    foot_y=int(Hf-bot_h)       # los productos quedan por encima de la barra inferior
    if per_product:
        # productos GRANDES anclados por su borde superior justo bajo el subtítulo (sin hueco)
        maxh=int(Hf*0.45)
        geom=products_geom(Wf,items,P,maxh,top_y=int(block_bottom+Hf*0.04),show_prices=True)
    else:
        # 1 producto: píldora hero central + producto grande abajo
        ps=fmt_str or fmt(items[0]["price"] if items and items[0].get("price") else price)
        pf=f_price(int(Wf*0.135))
        bb=d.textbbox((0,0),ps,font=pf); pw=bb[2]-bb[0]; ph=bb[3]-bb[1]
        pad_x,pad_y=int(Wf*0.075),int(Wf*0.05)
        py=int(block_bottom+pad_y+ph/2+Wf*0.012)
        _rrect(d,[cx-pw/2-pad_x,py-ph/2-pad_y,cx+pw/2+pad_x,py+ph/2+pad_y],int(Wf*0.07),P["pill"]+(255,))
        d.text((cx,py),ps,font=pf,fill=P["pill_txt"]+(255,),anchor="mm")
        zone_top=py+ph/2+pad_y
        prod_cy=int((zone_top+(foot_y-Hf*0.05))/2)
        maxh=int((foot_y-Hf*0.05-zone_top)*0.84)
        geom=products_geom(Wf,items,P,maxh,cy=prod_cy)
    if not skip_products:
        draw_products_geom(im,geom)
    return (im,geom) if return_geom else im

# ---------------- ESTILO A: CLASICA ----------------
def style_clasica(name,price,product,tag="OFERTA DE LA SEMANA"):
    im=bg_red(); d=ImageDraw.Draw(im); cx=W/2
    place_brand_header(im,cx,170,128,(255,255,255))  # logo NUEVO en blanco sobre rojo
    pill(d,cx,360,560,84,YELLOW); txt(d,(cx,360),tag.upper(),f_impact(52),RED,stroke=0)
    prod=load_product(product,int(W*0.70),int(H*0.32))
    paste_c(im,shadow_of(prod),cx+10,H*0.43+prod.height*0.45+16)
    paste_c(im,prod,cx,H*0.43)
    txt(d,(cx,H*0.625),name.upper(),f_black(72),WHITE,stroke=3,sfill=RED_DARK)
    # precio en pastilla crema con filete oro (look premium, en vez del starburst viejo)
    pw,ph=int(W*0.64),int(H*0.122); pcy=H*0.80
    d.rounded_rectangle([cx-pw/2,pcy-ph/2,cx+pw/2,pcy+ph/2],radius=ph//2,fill=CREAM_HI)
    d.rounded_rectangle([cx-pw/2,pcy-ph/2,cx+pw/2,pcy+ph/2],radius=ph//2,outline=GOLD,width=5)
    txt(d,(cx,pcy),fmt(price),f_impact(168),RED)
    txt(d,(cx,H-150),"HUALPEN · PUBLICO Y NEGOCIOS",f_bold(40),WHITE)
    txt(d,(cx,H-98),"DESPACHO A DOMICILIO",f_bold(36),YELLOW)
    return im

# ---------------- ESTILO B: DESCUENTO ----------------
def style_descuento(name,price,product,price_old=None,tag="¡OFERTÓN!"):
    im=bg_red(); d=ImageDraw.Draw(im); cx=W/2
    # esquina diagonal amarilla
    d.polygon([(0,0),(W,0),(W,210),(0,360)],fill=YELLOW)
    txt(d,(cx,150),tag.upper(),f_impact(96),RED)
    prod=load_product(product,int(W*0.66),int(H*0.30))
    paste_c(im,shadow_of(prod),cx+10,H*0.42+prod.height*0.45+16)
    paste_c(im,prod,cx,H*0.42)
    txt(d,(cx,H*0.60),name.upper(),f_black(58),WHITE,stroke=3,sfill=RED_DARK)
    if price_old:
        txt(d,(cx,H*0.655),"NORMAL "+fmt(price_old),f_bold(46),WHITE)
        d.line([(cx-235,H*0.655),(cx+235,H*0.655)],fill=YELLOW,width=8)
    txt(d,(cx-150,H*0.745),"AHORA",f_black(56),YELLOW)
    txt(d,(cx,H*0.83),fmt(price),f_impact(250),WHITE,stroke=6,sfill=RED_DARK)
    # sello de ahorro
    if price_old:
        pct=round((1-price/price_old)*100)
        sello=starburst(300,WHITE,spikes=20,inner=0.82); paste_c(im,sello,W-180,H*0.40)
        sd=ImageDraw.Draw(im)
        txt(sd,(W-180,H*0.40-26),f"-{pct}%",f_impact(86),RED)
        txt(sd,(W-180,H*0.40+44),"DCTO",f_black(34),RED)
    place_brand_header(im,cx,H-118,98,(255,255,255))  # logo NUEVO en blanco sobre rojo
    return im

# ================= HELPERS PREMIUM (nivel agencia) =================
def bg_cream(w,h):
    """Fondo crema: gradiente vertical CREAM_HI->CREAM_LO + viñeta a CREAM_EDGE."""
    yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
    vy=yy/max(1,h-1)
    a=np.zeros((h,w,3),np.float32)
    for i,(hi,lo) in enumerate(zip(CREAM_HI,CREAM_LO)): a[...,i]=hi*(1-vy)+lo*vy
    cx,cy=w/2,h*0.46; dd=np.sqrt((xx-cx)**2+(yy-cy)**2)/(w*0.78)
    dd=np.clip(dd,0,1)[...,None]
    edge=np.array(CREAM_EDGE,np.float32)
    a=a*(1-0.5*dd)+edge*(0.5*dd)
    return Image.fromarray(np.clip(a,0,255).astype(np.uint8),"RGB").convert("RGBA")

def bar_red(im,y0,y1,filete="bottom"):
    """Barra roja con gradiente + sombra proyectada + filete dorado 2px."""
    w=im.width; h=y1-y0
    grad=np.zeros((h,w,3),np.float32); vy=(np.arange(h)/max(1,h-1))[:,None]
    for i,(hi,lo) in enumerate(zip(RED,RED_DEEP)): grad[...,i]=hi*(1-vy)+lo*vy
    bar=Image.fromarray(grad.astype(np.uint8),"RGB").convert("RGBA")
    # sombra proyectada hacia el interior
    sh=Image.new("RGBA",(w,40),(0,0,0,0)); sd=ImageDraw.Draw(sh)
    for k in range(40): sd.line([(0,k),(w,k)],fill=(0,0,0,int(50*(1-k/40))))
    im.alpha_composite(bar,(0,int(y0)))
    if filete=="bottom":
        im.alpha_composite(sh,(0,int(y1)))
        ImageDraw.Draw(im).rectangle([0,y1-2,w,y1],fill=GOLD)
    else:
        im.alpha_composite(sh.transpose(Image.FLIP_TOP_BOTTOM),(0,int(y0-40)))
        ImageDraw.Draw(im).rectangle([0,y0,w,y0+2],fill=GOLD)

def contact_shadow(im,cx,cy,w,op=0.30):
    """Sombra de contacto elíptica premium: núcleo oscuro concentrado + halo difuso.
    Más chica que el producto, con falloff radial (no parche plano)."""
    sw,sh=int(w*0.62),int(w*0.10)   # más chica/concentrada que antes
    pad=60
    cw,ch=sw+pad*2,sh+pad*2
    # halo amplio y muy suave
    halo=Image.new("RGBA",(cw,ch),(0,0,0,0))
    ImageDraw.Draw(halo).ellipse([pad-14,pad-6,pad+sw-1+14,pad+sh-1+6],
                                 fill=(38,28,26,int(255*op*0.55)))
    halo=halo.filter(ImageFilter.GaussianBlur(26))
    # núcleo oscuro y chico justo bajo la base
    core=Image.new("RGBA",(cw,ch),(0,0,0,0))
    ImageDraw.Draw(core).ellipse([pad+int(sw*0.16),pad+int(sh*0.10),
                                  pad+int(sw*0.84),pad+sh-1-int(sh*0.10)],
                                 fill=(28,20,18,int(255*op)))
    core=core.filter(ImageFilter.GaussianBlur(11))
    el=Image.new("RGBA",(cw,ch),(0,0,0,0))
    el.alpha_composite(halo); el.alpha_composite(core)
    im.alpha_composite(el,(int(cx-el.width/2),int(cy-el.height/2)))

def price_block(im,cx,cy,price,price_old=None,unit="c/u",color=RED,scale=1.0):
    """Bloque de precio HERO: número gigante con sombra sutil, '$' volado snug arriba,
    unidad discreta en texto fino gris (no pill cuadrada chillona)."""
    d=ImageDraw.Draw(im)
    num=fmt(price)[1:]  # sin el $
    fp=f_price(int(288*scale)); fd=f_price(int(112*scale))
    bb=d.textbbox((0,0),num,font=fp); nw=bb[2]-bb[0]; nh=bb[3]-bb[1]; ntop=bb[1]
    bd=d.textbbox((0,0),"$",font=fd); dw=bd[2]-bd[0]; dh=bd[3]-bd[1]
    gap=int(8*scale)
    total=dw+gap+nw
    x0=cx-total/2
    num_top=cy-nh/2  # tope visual del número
    # sombra sutil del número (lo despega del crema, look caro)
    sh=Image.new("RGBA",im.size,(0,0,0,0))
    ImageDraw.Draw(sh).text((x0+dw+gap-bb[0], num_top-ntop), num, font=fp,
                            fill=(30,12,14,150))
    sh=sh.filter(ImageFilter.GaussianBlur(6))
    im.alpha_composite(sh,(int(4*scale),int(7*scale)))
    d=ImageDraw.Draw(im)
    # '$' volado: alineado al tope del número (superíndice), snug
    d.text((x0, num_top - ntop), "$", font=fd, fill=color, anchor="la")
    # número hero
    d.text((x0+dw+gap-bb[0], num_top-ntop), num, font=fp, fill=color, anchor="la")
    num_bottom=num_top+nh
    # tachado "Normal $X" (fino, arriba del número)
    if price_old:
        fo=f_strike(int(42*scale))
        old="Normal "+fmt(price_old)
        oy=num_top-int(34*scale)
        d.text((cx,oy),old,font=fo,fill=GREY_STRIKE,anchor="mm")
        ob=d.textbbox((0,0),old,font=fo); ow=ob[2]-ob[0]
        d.line([(cx-ow/2-6,oy),(cx+ow/2+6,oy)],fill=RED,width=max(3,int(4*scale)))
    # unidad: texto fino gris con tracking (no pill)
    fu=f_ui(int(30*scale))
    ut=" ".join(unit.upper())  # tracking simple
    d.text((cx,num_bottom+int(20*scale)),ut,font=fu,fill=INK_SOFT,anchor="mm")

def badge_pct(im,cx,cy,pct):
    """Estrella de descuento con anillo dorado + anillo crema (-10°)."""
    size=300
    star=starburst(size,RED,spikes=18,inner=0.78).rotate(-10,expand=True,resample=Image.BICUBIC)
    # anillos
    ring=Image.new("RGBA",(size,size),(0,0,0,0)); rd=ImageDraw.Draw(ring)
    rd.ellipse([26,26,size-26,size-26],outline=GOLD,width=6)
    rd.ellipse([40,40,size-40,size-40],outline=CREAM_RING,width=4)
    paste_c(im,star,cx,cy)
    paste_c(im,ring.rotate(-10,expand=True,resample=Image.BICUBIC),cx,cy)
    d=ImageDraw.Draw(im)
    txt(d,(cx,cy-26),f"-{pct}%",f_price(96),WHITE)
    txt(d,(cx,cy+44),"DCTO",f_name(36),WHITE)

def tag_pill(im,cx,cy,text):
    """Sello OFERTA tipo ticket: pill rojo con filete oro, texto display crema.
    Posición libre (no choca con el logo). Persistente en imagen y video."""
    d=ImageDraw.Draw(im)
    s=text.upper()
    fnt=f_display(54)
    bb=d.textbbox((0,0),s,font=fnt); tw=bb[2]-bb[0]
    w=tw+72; h=82
    x0,y0,x1,y1=cx-w/2,cy-h/2,cx+w/2,cy+h/2
    # sombra suave
    sh=Image.new("RGBA",(int(w)+40,int(h)+40),(0,0,0,0))
    ImageDraw.Draw(sh).rounded_rectangle([20,24,sh.width-20,sh.height-16],radius=h//2,fill=(30,10,12,90))
    sh=sh.filter(ImageFilter.GaussianBlur(12))
    im.alpha_composite(sh,(int(x0-20),int(y0-20)))
    d.rounded_rectangle([x0,y0,x1,y1],radius=h//2,fill=RED)
    d.rounded_rectangle([x0,y0,x1,y1],radius=h//2,outline=GOLD,width=3)
    txt(d,(cx,cy),s,fnt,CREAM_HI)

def ribbon_oferta(im,text,corner="tl"):
    """Cinta diagonal 'OFERTA' en una esquina."""
    d=ImageDraw.Draw(im)
    if corner=="tl":
        d.polygon([(0,0),(360,0),(0,360)],fill=RED)
        rib=Image.new("RGBA",(440,90),(0,0,0,0))
        ImageDraw.Draw(rib).rectangle([0,0,439,89],fill=GOLD)
        ImageDraw.Draw(rib).text((220,45),text.upper(),font=f_display(58),fill=RED_INK,anchor="mm")
        rib=rib.rotate(45,expand=True,resample=Image.BICUBIC)
        paste_c(im,rib,150,150)

def disc_badge(im,cx,cy,price,price_old):
    """Sello compacto de % (para variantes)."""
    if not price_old: return
    pct=round((1-price/price_old)*100)
    badge_pct(im,cx,cy,pct)

def soft_panel(im,box,fill=CREAM_HI,radius=40,shadow=True):
    """Panel redondeado con sombra suave (para variantes)."""
    x0,y0,x1,y1=box
    if shadow:
        sh=Image.new("RGBA",(int(x1-x0)+60,int(y1-y0)+60),(0,0,0,0))
        ImageDraw.Draw(sh).rounded_rectangle([30,34,sh.width-30,sh.height-26],radius=radius,fill=(30,22,20,70))
        sh=sh.filter(ImageFilter.GaussianBlur(20))
        im.alpha_composite(sh,(int(x0-30),int(y0-30)))
    ImageDraw.Draw(im).rounded_rectangle(box,radius=radius,fill=fill+(255,) if len(fill)==3 else fill)

# ---------------- ESTILO C: PREMIUM (nivel agencia) ----------------
def style_premium(name,price,product,tag="OFERTA",price_old=None,unit="c/u",fmt="story"):
    Wf,Hf=dims(fmt)
    im=bg_cream(Wf,Hf); cx=Wf/2
    bar=int(Hf*0.084)   # barra superior con más cuerpo para que el logo tenga presencia
    bar_red(im,0,bar,"bottom")
    bar_red(im,Hf-bar,Hf,"top")
    d=ImageDraw.Draw(im)
    # logo NUEVO (esfera glossy + EL MARAVILLOSO) en blanco, GRANDE sobre la barra roja
    place_brand_header(im,cx,bar*0.5,int(bar*0.82),(255,255,255))
    # gancho: badge % si hay precio anterior; si no, sello OFERTA tipo ticket (no choca el logo)
    if price_old:
        pct=round((1-price/price_old)*100)
        badge_pct(im,Wf-185,int(Hf*0.235),pct)
    else:
        tag_pill(im,int(Wf*0.135),int(bar+Hf*0.052),tag)
    # producto con sombra de contacto elíptica bajo el producto
    feed=(Hf<=Wf*1.05)
    prod=load_product(product,int(Wf*0.80),int(Hf*(0.39 if feed else 0.45)))
    py=Hf*(0.31 if feed else 0.41)
    contact_shadow(im,cx,py+prod.height*0.52,prod.width*0.82,op=0.22)
    paste_c(im,prod,cx,py)
    # nombre + línea roja + filete oro + guiño azul
    ny=Hf*(0.60 if feed else 0.665)
    txt(d,(cx,ny),name.upper(),f_display(82),INK)
    lw=215
    d.line([(cx-lw,ny+64),(cx+lw,ny+64)],fill=RED,width=6)
    d.line([(cx-lw,ny+72),(cx+lw,ny+72)],fill=GOLD,width=3)
    d.line([(cx-70,ny+74),(cx+70,ny+74)],fill=BLUE,width=3)
    # precio (más contenido en feed cuadrado para que no domine toda la imagen)
    sc=(Wf/1080.0)*(0.58 if feed else 1.0)
    price_block(im,cx,int(Hf*(0.81 if feed else 0.815)),price,price_old,unit,color=RED,scale=sc)
    # footer
    txt(d,(cx,Hf-bar*0.5),"HUALPEN  ·  PUBLICO Y NEGOCIOS  ·  DESPACHO",f_ui(int(28 if feed else 34)),CREAM_HI)
    return im

# ---------------- VARIANTES PREMIUM ----------------
def premium_dark(name,price,product,tag="OFERTA",price_old=None,unit="c/u",fmt="story"):
    Wf,Hf=dims(fmt); cx=Wf/2
    im=Image.new("RGBA",(Wf,Hf),(20,17,15,255))
    # halo radial cálido
    yy,xx=np.mgrid[0:Hf,0:Wf].astype(np.float32)
    dd=np.clip(np.sqrt((xx-cx)**2+(yy-Hf*0.42)**2)/(Wf*0.7),0,1)
    halo=Image.new("RGBA",(Wf,Hf),(60,30,28,0))
    L=Image.fromarray(((1-dd)*120).astype(np.uint8),"L"); halo.putalpha(L)
    im.alpha_composite(halo)
    d=ImageDraw.Draw(im)
    bar=int(Hf*0.078); d.rectangle([0,0,Wf,bar],fill=RED_DEEP); d.rectangle([0,Hf-bar,Wf,Hf],fill=RED_DEEP)
    d.rectangle([0,bar-2,Wf,bar],fill=GOLD); d.rectangle([0,Hf-bar,Wf,Hf-bar+2],fill=GOLD)
    place_brand_header(im,cx,bar*0.5,int(bar*0.78),(255,255,255))
    if price_old: badge_pct(im,Wf-185,int(Hf*0.245),round((1-price/price_old)*100))
    else: ribbon_oferta(im,tag,"tl")
    prod=load_product(product,int(Wf*0.80),int(Hf*0.45)); py=Hf*0.44
    contact_shadow(im,cx,py+prod.height*0.50,prod.width*0.82,op=0.35)
    paste_c(im,prod,cx,py)
    ny=Hf*0.665
    txt(d,(cx,ny),name.upper(),f_display(80),CREAM_HI)
    d.line([(cx-205,ny+64),(cx+205,ny+64)],fill=GOLD,width=5)
    sc=Wf/1080.0
    price_block(im,cx,int(Hf*0.815),price,price_old,unit,color=(255,90,96),scale=sc)
    txt(d,(cx,Hf-bar*0.5),"HUALPEN  ·  PUBLICO Y NEGOCIOS  ·  DESPACHO",f_ui(int(34*sc)),CREAM_HI)
    return im

def premium_giant(name,price,product,tag="OFERTA",price_old=None,unit="c/u",fmt="story"):
    Wf,Hf=dims(fmt); cx=Wf/2
    im=bg_cream(Wf,Hf); d=ImageDraw.Draw(im)
    bar=int(Hf*0.078); bar_red(im,0,bar,"bottom"); bar_red(im,Hf-bar,Hf,"top")
    place_brand_header(im,cx,bar*0.5,int(bar*0.78),(255,255,255))
    prod=load_product(product,int(Wf*0.73),int(Hf*0.385)); py=Hf*0.28
    contact_shadow(im,cx,py+prod.height*0.50,prod.width*0.8,op=0.22)
    paste_c(im,prod,cx,py)
    ny=Hf*0.505
    txt(d,(cx,ny),name.upper(),f_display(76),INK)
    if price_old:
        old="Normal "+fmt_money(price_old)
        oy=ny+58; txt(d,(cx,oy),old,f_strike(44),GREY_STRIKE)
        ob=d.textbbox((0,0),old,font=f_strike(44)); ow=ob[2]-ob[0]
        d.line([(cx-ow/2-6,oy),(cx+ow/2+6,oy)],fill=RED,width=5)
    # precio gigante ocupa el tercio inferior
    sc=Wf/1080.0
    txt(d,(cx,int(Hf*0.725)),fmt_money(price),f_price(int(292*sc)),RED)
    pill(d,cx,int(Hf*0.83),250*sc,54*sc,GOLD); txt(d,(cx,int(Hf*0.83)),unit.upper(),f_ui(int(33*sc)),RED_INK)
    txt(d,(cx,Hf-bar*0.5),"HUALPEN  ·  PUBLICO Y NEGOCIOS  ·  DESPACHO",f_ui(int(34*sc)),CREAM_HI)
    return im

def premium_split(name,price,product,tag="OFERTA",price_old=None,unit="c/u",fmt="story"):
    Wf,Hf=dims(fmt); cx=Wf/2
    im=bg_cream(Wf,Hf); d=ImageDraw.Draw(im)
    # banda roja diagonal inferior
    d.polygon([(0,Hf*0.62),(Wf,Hf*0.52),(Wf,Hf),(0,Hf)],fill=RED)
    d.line([(0,Hf*0.62),(Wf,Hf*0.52)],fill=GOLD,width=4)
    place_brand_header(im,Wf*0.32,Hf*0.07,int(Hf*0.052),(176,16,24))
    if price_old: badge_pct(im,Wf-180,int(Hf*0.16),round((1-price/price_old)*100))
    else: ribbon_oferta(im,tag,"tl")
    prod=load_product(product,int(Wf*0.74),int(Hf*0.42)); py=Hf*0.385
    contact_shadow(im,cx,py+prod.height*0.50,prod.width*0.8,op=0.20)
    paste_c(im,prod,cx,py)
    sc=Wf/1080.0
    ny=Hf*0.69
    txt(d,(cx,ny),name.upper(),f_display(76),CREAM_HI)
    d.line([(cx-175,ny+54),(cx+175,ny+54)],fill=GOLD,width=4)  # filete que separa nombre del precio
    # precio sobre rojo en crema/amarillo, tachado a mano
    if price_old:
        old="Normal "+fmt_money(price_old); oy=ny+56
        txt(d,(cx,oy),old,f_strike(42),CREAM_HI)
        ob=d.textbbox((0,0),old,font=f_strike(42)); ow=ob[2]-ob[0]
        d.line([(cx-ow/2-6,oy),(cx+ow/2+6,oy)],fill=YELLOW,width=5)
    txt(d,(cx,int(Hf*0.84)),fmt_money(price),f_price(int(248*sc)),CREAM_HI)
    txt(d,(cx,int(Hf*0.93)),unit.upper()+"  ·  HUALPEN  ·  DESPACHO",f_ui(int(30*sc)),YELLOW)
    return im

STYLES={"clasica":style_clasica,"descuento":style_descuento,"premium":style_premium,
        "premium_dark":premium_dark,"premium_giant":premium_giant,"premium_split":premium_split}

if __name__=="__main__":
    import sys
    prod=sys.argv[1] if len(sys.argv)>1 else os.path.join(ASSETS,"milo-1kg-cut.png")
    out=os.path.join(os.path.dirname(__file__),"..","content","_previews")
    os.makedirs(out,exist_ok=True)
    style_clasica("Milo Bolsa 1 KG",7190,prod).convert("RGB").save(out+"/A_clasica.png",quality=90)
    style_descuento("Milo Bolsa 1 KG",7190,prod,price_old=9290).convert("RGB").save(out+"/B_descuento.png",quality=90)
    style_premium("Milo Bolsa 1 KG",7190,prod).convert("RGB").save(out+"/C_premium.png",quality=90)
    # premium con precio anterior (badge) + feed 1:1
    style_premium("Milo Bolsa 1 KG",7190,prod,price_old=9290,unit="EL KILO").convert("RGB").save(out+"/C_premium_oferta.png",quality=90)
    style_premium("Milo Bolsa 1 KG",7190,prod,price_old=9290,unit="EL KILO",fmt="feed").convert("RGB").save(out+"/C_premium_feed.png",quality=90)
    # variantes
    premium_dark ("Milo Bolsa 1 KG",7190,prod,price_old=9290,unit="EL KILO").convert("RGB").save(out+"/D_premium_dark.png",quality=90)
    premium_giant("Milo Bolsa 1 KG", 990,prod,unit="c/u").convert("RGB").save(out+"/E_premium_giant.png",quality=90)
    premium_split("Milo Bolsa 1 KG",7190,prod,price_old=9290,unit="EL KILO").convert("RGB").save(out+"/F_premium_split.png",quality=90)
    print("previews OK ->",out)
