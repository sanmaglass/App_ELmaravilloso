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
W,H=1080,1920
FONTS="C:/Windows/Fonts/"
ASSETS=os.path.join(os.path.dirname(__file__),"..","assets")

def font(names,size):
    if isinstance(names,str): names=[names]
    for n in names+["arialbd.ttf","arial.ttf"]:
        p=os.path.join(FONTS,n)
        if os.path.exists(p): return ImageFont.truetype(p,size)
    return ImageFont.load_default()
def f_impact(s): return font("impact.ttf",s)
def f_black(s):  return font(["ariblk.ttf","arialbd.ttf"],s)         # Arial Black
def f_cond(s):   return font(["bahnschrift.ttf","ariblk.ttf"],s)    # condensada moderna
def f_bold(s):   return font("arialbd.ttf",s)

def fmt(p): return "$"+format(int(p),",d").replace(",",".")

def load_product(path,maxw,maxh):
    im=Image.open(path).convert("RGBA")
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

# ---------------- ESTILO C: PREMIUM ----------------
def style_premium(name,price,product,tag="OFERTA"):
    im=Image.new("RGBA",(W,H),CREAM+(255,)); d=ImageDraw.Draw(im); cx=W/2
    d.rectangle([0,0,W,150],fill=RED)               # barra superior
    d.rectangle([0,H-150,W,H],fill=RED)             # barra inferior
    lg=logo(330); paste_c(im,lg,cx,76)
    # tag minimal
    pill(d,cx,300,300,72,RED); txt(d,(cx,300),tag.upper(),f_cond(46),WHITE)
    prod=load_product(product,int(W*0.72),int(H*0.40))
    paste_c(im,shadow_of(prod,blur=30,op=0.30),cx+8,H*0.45+prod.height*0.46+14)
    paste_c(im,prod,cx,H*0.45)
    txt(d,(cx,H*0.70),name.upper(),f_cond(70),INK)
    d.line([(cx-150,H*0.735),(cx+150,H*0.735)],fill=RED,width=6)
    txt(d,(cx,H*0.80),fmt(price),f_impact(220),RED)
    txt(d,(cx,H-76),"HUALPEN  ·  PUBLICO Y NEGOCIOS  ·  DESPACHO",f_bold(34),WHITE)
    return im

STYLES={"clasica":style_clasica,"descuento":style_descuento,"premium":style_premium}

if __name__=="__main__":
    import sys
    prod=sys.argv[1] if len(sys.argv)>1 else os.path.join(ASSETS,"milo-1kg-cut.png")
    out=os.path.join(os.path.dirname(__file__),"..","content","_previews")
    os.makedirs(out,exist_ok=True)
    style_clasica("Milo Bolsa 1 KG",7190,prod).convert("RGB").save(out+"/A_clasica.png",quality=90)
    style_descuento("Milo Bolsa 1 KG",7190,prod,price_old=9290).convert("RGB").save(out+"/B_descuento.png",quality=90)
    style_premium("Milo Bolsa 1 KG",7190,prod).convert("RGB").save(out+"/C_premium.png",quality=90)
    print("previews OK ->",out)
