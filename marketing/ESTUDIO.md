# 🎬 Estudio de contenido — El Maravilloso

> El flujo para generar posts en lote. Tú traes fotos, Claude devuelve todo
> listo y te dice cuánto te alcanza. Pensado para hacerlo 1 vez cada 1-2 semanas.

---

## Cómo se usa (3 pasos)

### 1. Tiras tus fotos acá
Carpeta de entrada: **`marketing/assets/entrada/`**

- Arrastra fotos de productos (las del celular sirven).
- Nómbralas con algo reconocible del producto: `milo.jpg`, `aceite-chef.jpg`, `coca-15.jpg`.
- No te preocupes del fondo ni del precio — eso lo pongo yo.

### 2. Abres Claude y dices: **"genera"**
Claude hace, por cada foto, en una sola pasada:

| Paso | Qué hace | Gasto |
|------|----------|-------|
| 🔎 Match | Busca el producto en tu base de datos y saca el **precio vigente** | 0 |
| ✅ Confirma | Te muestra "foto → producto → $precio" para que apruebes o corrijas | 0 |
| ✂️ Fondo | Recorta el producto (`assets/_rembg.py`) | 0 |
| 🖼️ Imagen | Lo monta en tu plantilla de oferta 1080×1080 | tokens |
| ✍️ Textos | Escribe caption de IG + texto de TikTok en tu voz de marca | tokens |
| 📅 Agenda | Lo ubica en el próximo hueco libre del `calendar.md` | 0 |

### 3. Recibes el reporte de cobertura
```
Ok Luis — 12 imágenes procesadas.
Con tu ritmo (6 posts/semana) te alcanza para 2 SEMANAS,
hasta el 28 de junio. Para llegar a fin de mes te faltan 6 fotos.

📄 Te dejé el CSV listo: marketing/content/lote-2026-06-14.csv
   → impórtalo en Metricool/Publer y queda toda la quincena programada.
```

---

## La cuenta de "cuánto me alcanza"
**1 foto de producto ≈ 1 día de feed** (y se recicla a Story).

| Fotos que traes | Te alcanza para |
|-----------------|-----------------|
| 6 | 1 semana |
| 12 | 2 semanas |
| 24 | ~1 mes |

---

## Dónde queda cada cosa
- Fotos crudas que traes → `assets/entrada/`
- Producto recortado → `assets/` (reutilizable)
- Imagen final + caption → `content/instagram/` y `content/tiktok/`
- Agenda actualizada → `calendar.md`
- Archivo para importar al tool → `content/lote-FECHA.csv`

---

## Qué gasta tokens y qué no
- **Gasta** (1 vez por lote): generar imágenes + escribir textos.
- **Gratis**: sacar precios, recortar fondos, agendar, el CSV.
- **Gratis** (fuera del estudio): publicar (lo hace el tool) y recordarte el día (script local).

---

## Reglas
- El precio **siempre** sale de la BD y tú lo confirmas. Nunca se publica un precio a ojo.
- Nada de "fiado/crédito" en los textos (regla de marca).
- Antes de programar, revisas el lote. Tú apruebas, el tool publica.
