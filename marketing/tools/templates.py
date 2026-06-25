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

def logo(maxw):
    im=Image.open(os.path.join(ASSETS,"logo.png")).convert("RGBA")
    sc=maxw/im.width; return im.resize((int(im.width*sc),int(im.height*sc)),Image.LANCZOS)

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
PALETTES={"teal":PAL_TEAL,"warm":PAL_WARM,"mint":PAL_MINT}

def _rrect(d,box,r,fill):
    d.rounded_rectangle(box,radius=r,fill=fill)

def _wrap(s,maxc):
    words=s.split(); lines=[]; cur=""
    for w in words:
        if len(cur)+len(w)+1<=maxc: cur=(cur+" "+w).strip()
        else: lines.append(cur); cur=w
    if cur: lines.append(cur)
    return lines or [s]

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

def wordmark(im,pal,cx,cy):
    """Wordmark limpio tipo catálogo (sin recuadro): logo M transparente + texto."""
    d=ImageDraw.Draw(im)
    try:
        lg=Image.open(os.path.join(ASSETS,"logo_v2.png")).convert("RGBA")
        lg=defringe(lg,erode=2)
        s=int(im.width*0.10); lg=lg.resize((s,s),Image.LANCZOS)
        im.alpha_composite(lg,(int(cx-s/2),int(cy-s*0.60)))
        cy+=s*0.50
    except Exception: pass
    d.text((cx,cy),"D I S T R I B U I D O R A",font=f_ui(int(im.width*0.026)),
           fill=pal["muted"]+(255,),anchor="mm")
    d.text((cx,cy+im.width*0.052),"El Maravilloso",font=f_name(int(im.width*0.072)),
           fill=pal["ink"]+(255,),anchor="mm")

def place_products(im,paths,pal,cy,maxh):
    """Coloca 1..3 productos en fila, ligeramente solapados, con sombra suave."""
    paths=[p for p in paths if p][:3]
    if not paths: return
    prods=[load_product(p,int(im.width*0.50),maxh) for p in paths]
    n=len(prods); ov=int(im.width*0.06)  # solape
    widths=[p.width for p in prods]
    total=sum(widths)-ov*(n-1)
    xs=[]; x=im.width/2-total/2
    for i,p in enumerate(prods):
        xs.append(x+p.width/2); x+=p.width-ov
    # sombras primero
    for i,p in enumerate(prods):
        sh=shadow_of(p,blur=30,op=0.28)
        im.alpha_composite(sh,(int(xs[i]-p.width/2+10),int(cy-p.height/2+24)))
    # centro al frente
    for i in sorted(range(n),key=lambda i:abs(i-(n-1)/2),reverse=True):
        paste_c(im,prods[i],xs[i],cy)

def style_amigable(name,price,products,pal="teal",fmt_str=None,fmt2="feed45"):
    """Pieza amigable multi-producto. products: lista de rutas de recortes PNG."""
    P=PALETTES.get(pal,PAL_TEAL)
    Wf,Hf=dims(fmt2)
    im=bg_friendly(P,Wf,Hf); d=ImageDraw.Draw(im); cx=Wf/2
    im.alpha_composite(coin_pct(int(Wf*0.30),P),(int(Wf*0.73),int(Hf*0.015)))
    im.alpha_composite(coin_pct(int(Wf*0.27),P),(int(-Wf*0.09),int(Hf*0.48)))
    im.alpha_composite(coin_pct(int(Wf*0.19),P),(int(Wf*0.80),int(Hf*0.86)))
    wordmark(im,P,cx,int(Hf*0.085))
    lines=_wrap((name or "").strip(),14)[:2]
    ty=Hf*0.225
    for ln in lines:
        d.text((cx,ty),ln,font=f_name(int(Wf*0.10)),fill=P["ink"]+(255,),anchor="mm")
        ty+=Wf*0.11
    ps=fmt_str or fmt(price)
    pf=f_price(int(Wf*0.135))
    bb=d.textbbox((0,0),ps,font=pf); pw=bb[2]-bb[0]; ph=bb[3]-bb[1]
    pad_x,pad_y=int(Wf*0.075),int(Wf*0.05); py=ty+Wf*0.04
    _rrect(d,[cx-pw/2-pad_x,py-ph/2-pad_y,cx+pw/2+pad_x,py+ph/2+pad_y],int(Wf*0.07),P["pill"]+(255,))
    d.text((cx,py),ps,font=pf,fill=P["pill_txt"]+(255,),anchor="mm")
    place_products(im,products,P,int(Hf*0.715),int(Hf*0.44))
    return im

# ---------------- ESTILO A: CLASICA ----------------
def style_clasica(name,price,product,tag="OFERTA DE LA SEMANA"):
    im=bg_red(); d=ImageDraw.Draw(im); cx=W/2
    lg=logo(360); paste_c(im,lg,cx,180)
    pill(d,cx,360,560,84,YELLOW); txt(d,(cx,360),tag.upper(),f_impact(52),RED,stroke=0)
    prod=load_product(product,int(W*0.70),int(H*0.32))
    paste_c(im,shadow_of(prod),cx+10,H*0.43+prod.height*0.45+16)
    paste_c(im,prod,cx,H*0.43)
    txt(d,(cx,H*0.625),name.upper(),f_black(64),WHITE,stroke=3,sfill=RED_DARK)
    bs=starburst(560,YELLOW); paste_c(im,bs,cx,H*0.80)
    txt(d,(cx,H*0.80),fmt(price),f_impact(230),RED)
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
    lg=logo(300); paste_c(im,lg,cx,H-120)
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
    fp=f_price(int(310*scale)); fd=f_price(int(118*scale))
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
    bar=int(Hf*0.068)   # barra superior más slim (menos pesada)
    bar_red(im,0,bar,"bottom")
    bar_red(im,Hf-bar,Hf,"top")
    d=ImageDraw.Draw(im)
    # logo centrado sobre la barra roja, tamaño equilibrado
    lg=logo(int(Wf*0.30)); paste_c(im,lg,cx,bar*0.5)
    # gancho: badge % si hay precio anterior; si no, sello OFERTA tipo ticket (no choca el logo)
    if price_old:
        pct=round((1-price/price_old)*100)
        badge_pct(im,Wf-185,int(Hf*0.235),pct)
    else:
        tag_pill(im,int(Wf*0.135),int(bar+Hf*0.052),tag)
    # producto con sombra de contacto elíptica bajo el producto
    feed=(Hf<=Wf*1.05)
    prod=load_product(product,int(Wf*0.72),int(Hf*(0.34 if feed else 0.40)))
    py=Hf*(0.32 if feed else 0.42)
    contact_shadow(im,cx,py+prod.height*0.52,prod.width*0.82,op=0.22)
    paste_c(im,prod,cx,py)
    # nombre + línea roja + filete oro + guiño azul
    ny=Hf*(0.60 if feed else 0.665)
    txt(d,(cx,ny),name.upper(),f_display(72),INK)
    lw=180
    d.line([(cx-lw,ny+58),(cx+lw,ny+58)],fill=RED,width=6)
    d.line([(cx-lw,ny+66),(cx+lw,ny+66)],fill=GOLD,width=3)
    d.line([(cx-70,ny+74),(cx+70,ny+74)],fill=BLUE,width=3)
    # precio
    sc=(Wf/1080.0)*(0.72 if feed else 1.0)
    price_block(im,cx,int(Hf*(0.80 if feed else 0.815)),price,price_old,unit,color=RED,scale=sc)
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
    paste_c(im,logo(int(Wf*0.28)),cx,bar*0.5)
    if price_old: badge_pct(im,Wf-185,int(Hf*0.245),round((1-price/price_old)*100))
    else: ribbon_oferta(im,tag,"tl")
    prod=load_product(product,int(Wf*0.72),int(Hf*0.40)); py=Hf*0.44
    contact_shadow(im,cx,py+prod.height*0.50,prod.width*0.82,op=0.35)
    paste_c(im,prod,cx,py)
    ny=Hf*0.665
    txt(d,(cx,ny),name.upper(),f_display(72),CREAM_HI)
    d.line([(cx-180,ny+58),(cx+180,ny+58)],fill=GOLD,width=5)
    sc=Wf/1080.0
    price_block(im,cx,int(Hf*0.815),price,price_old,unit,color=(255,90,96),scale=sc)
    txt(d,(cx,Hf-bar*0.5),"HUALPEN  ·  PUBLICO Y NEGOCIOS  ·  DESPACHO",f_ui(int(34*sc)),CREAM_HI)
    return im

def premium_giant(name,price,product,tag="OFERTA",price_old=None,unit="c/u",fmt="story"):
    Wf,Hf=dims(fmt); cx=Wf/2
    im=bg_cream(Wf,Hf); d=ImageDraw.Draw(im)
    bar=int(Hf*0.078); bar_red(im,0,bar,"bottom"); bar_red(im,Hf-bar,Hf,"top")
    paste_c(im,logo(int(Wf*0.26)),cx,bar*0.5)
    prod=load_product(product,int(Wf*0.56),int(Hf*0.30)); py=Hf*0.30
    contact_shadow(im,cx,py+prod.height*0.50,prod.width*0.8,op=0.22)
    paste_c(im,prod,cx,py)
    ny=Hf*0.475
    txt(d,(cx,ny),name.upper(),f_display(64),INK)
    if price_old:
        old="Normal "+fmt_money(price_old)
        oy=ny+58; txt(d,(cx,oy),old,f_strike(44),GREY_STRIKE)
        ob=d.textbbox((0,0),old,font=f_strike(44)); ow=ob[2]-ob[0]
        d.line([(cx-ow/2-6,oy),(cx+ow/2+6,oy)],fill=RED,width=5)
    # precio gigante ocupa el tercio inferior
    sc=Wf/1080.0
    txt(d,(cx,int(Hf*0.72)),fmt_money(price),f_price(int(360*sc)),RED)
    pill(d,cx,int(Hf*0.83),260*sc,56*sc,GOLD); txt(d,(cx,int(Hf*0.83)),unit.upper(),f_ui(int(34*sc)),RED_INK)
    txt(d,(cx,Hf-bar*0.5),"HUALPEN  ·  PUBLICO Y NEGOCIOS  ·  DESPACHO",f_ui(int(34*sc)),CREAM_HI)
    return im

def premium_split(name,price,product,tag="OFERTA",price_old=None,unit="c/u",fmt="story"):
    Wf,Hf=dims(fmt); cx=Wf/2
    im=bg_cream(Wf,Hf); d=ImageDraw.Draw(im)
    # banda roja diagonal inferior
    d.polygon([(0,Hf*0.62),(Wf,Hf*0.52),(Wf,Hf),(0,Hf)],fill=RED)
    d.line([(0,Hf*0.62),(Wf,Hf*0.52)],fill=GOLD,width=4)
    paste_c(im,logo(int(Wf*0.26)),Wf*0.26,Hf*0.07)
    if price_old: badge_pct(im,Wf-180,int(Hf*0.16),round((1-price/price_old)*100))
    else: ribbon_oferta(im,tag,"tl")
    prod=load_product(product,int(Wf*0.66),int(Hf*0.36)); py=Hf*0.40
    contact_shadow(im,cx,py+prod.height*0.50,prod.width*0.8,op=0.20)
    paste_c(im,prod,cx,py)
    sc=Wf/1080.0
    ny=Hf*0.685
    txt(d,(cx,ny),name.upper(),f_display(66),CREAM_HI)
    # precio sobre rojo en crema/amarillo, tachado a mano
    if price_old:
        old="Normal "+fmt_money(price_old); oy=ny+56
        txt(d,(cx,oy),old,f_strike(42),CREAM_HI)
        ob=d.textbbox((0,0),old,font=f_strike(42)); ow=ob[2]-ob[0]
        d.line([(cx-ow/2-6,oy),(cx+ow/2+6,oy)],fill=YELLOW,width=5)
    txt(d,(cx,int(Hf*0.84)),fmt_money(price),f_price(int(260*sc)),CREAM_HI)
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
