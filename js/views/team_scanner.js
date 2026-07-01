// team_scanner.js — Consultar Precio (empleado)
// Dos modos: búsqueda por texto + escaneo de código de barras
window.Views = window.Views || {};

(function () {
    // Cache del catálogo: construirlo recorre miles de ventas (eleventa_sales),
    // lo que congelaba el teléfono cada vez que se abría "Consultar Precio".
    // Se cachea 60s (los precios no cambian a cada segundo).
    let _catalogCache = null;
    let _catalogCacheAt = 0;
    const CATALOG_TTL_MS = 60000;

    // Construir catálogo de precios desde db.products + eleventa_sales.items
    async function buildCatalog() {
        if (_catalogCache && (Date.now() - _catalogCacheAt) < CATALOG_TTL_MS) {
            return _catalogCache;
        }
        const catalog = new Map(); // name → { name, price, stock, lastSeen }

        // 1. Productos de la tabla products (precio oficial + stock)
        try {
            const products = await window.db.products.toArray();
            for (const p of products) {
                if (p.deleted) continue;
                const name = (p.name || '').trim().toUpperCase();
                if (!name) continue;
                const price = parseFloat(p.salePrice || p.price || p.sellingPrice) || 0;
                const stock = parseFloat(p.stock) || 0;
                if (price > 0) catalog.set(name, { name, price, stock, lastSeen: p.updated_at || p.created_at || '' });
            }
        } catch { /* tabla puede no existir */ }

        // 2. Items de ventas Eleventa (precio más reciente, sin pisar stock)
        try {
            const sales = await window.db.eleventa_sales.toArray();
            for (const s of sales) {
                if (s.deleted) continue;
                let items = s.items;
                if (typeof items === 'string') {
                    try { items = JSON.parse(items || '[]'); } catch { items = []; }
                }
                if (!Array.isArray(items)) continue;
                for (const item of items) {
                    const name = (item.name || '').trim().toUpperCase();
                    if (!name) continue;
                    const price = parseFloat(item.price) || 0;
                    const existing = catalog.get(name);
                    if (!existing || new Date(s.date) > new Date(existing.lastSeen)) {
                        catalog.set(name, { name, price, stock: existing?.stock || 0, lastSeen: s.date });
                    }
                }
            }
        } catch { /* tabla puede no existir */ }

        _catalogCache = Array.from(catalog.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es-CL'));
        _catalogCacheAt = Date.now();
        return _catalogCache;
    }

    function renderResults(products, container) {
        if (!products || products.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                    <i class="ph ph-magnifying-glass" style="font-size:2.5rem; display:block; margin-bottom:12px; opacity:0.4;"></i>
                    <p style="font-size:0.9rem;">Sin resultados. Intenta con otro término.</p>
                </div>
            `;
            return;
        }
        container.innerHTML = products.slice(0, 20).map(p => {
            const stockColor = p.stock > 5 ? '#16a34a' : (p.stock > 0 ? '#d97706' : '#ef4444');
            const stockLabel = p.stock > 0 ? `${Math.round(p.stock)} uds` : 'Sin stock';
            return `
            <div style="display:flex; align-items:center; justify-content:space-between;
                        padding:14px 16px; background:var(--bg-card); border:1px solid var(--border);
                        border-radius:12px; margin-bottom:8px; gap:12px;">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; color:var(--text-primary); font-size:0.92rem;
                                overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        ${window.escapeHTML(p.name)}
                    </div>
                    <div style="font-size:0.75rem; color:${stockColor}; font-weight:600; margin-top:2px;">
                        <i class="ph ph-package" style="margin-right:2px;"></i>${stockLabel}
                    </div>
                </div>
                <span style="font-size:1.15rem; font-weight:800; color:var(--primary); flex-shrink:0; white-space:nowrap;">
                    ${window.formatCurrency(p.price)}
                </span>
            </div>`;
        }).join('');
    }

    window.Views.team_scanner = async (container) => {
        container.innerHTML = `
            <div style="max-width:640px; margin:0 auto; padding:0 16px 40px;">

                <!-- Encabezado -->
                <div style="margin-bottom:24px;">
                    <div style="font-size:0.78rem; color:var(--primary); font-weight:700; letter-spacing:1.5px;
                                text-transform:uppercase; margin-bottom:4px;">El Maravilloso</div>
                    <h1 style="margin:0 0 4px; font-size:1.6rem; color:var(--text-primary);">Consultar Precio</h1>
                    <p style="margin:0; color:var(--text-muted); font-size:0.88rem;">Escanea o busca un producto</p>
                </div>

                <!-- Barra de búsqueda -->
                <div style="position:relative; margin-bottom:12px;">
                    <i class="ph ph-magnifying-glass" style="position:absolute; left:14px; top:50%; transform:translateY(-50%);
                       font-size:1.1rem; color:var(--text-muted); pointer-events:none;"></i>
                    <input id="ts-search-input" type="text" placeholder="Buscar producto..."
                           autocomplete="off" autocorrect="off" spellcheck="false"
                           style="width:100%; box-sizing:border-box; padding:13px 14px 13px 42px;
                                  background:var(--bg-card); border:1px solid var(--border); border-radius:14px;
                                  font-size:0.95rem; color:var(--text-primary); outline:none; transition:border-color 0.2s;">
                </div>

                <!-- Botón escanear -->
                <button id="ts-scan-btn"
                        style="width:100%; padding:13px; background:var(--primary); color:#fff; border:none;
                               border-radius:14px; font-size:0.95rem; font-weight:700; cursor:pointer;
                               display:flex; align-items:center; justify-content:center; gap:8px;
                               margin-bottom:24px; transition:opacity 0.15s;">
                    <i class="ph ph-barcode" style="font-size:1.2rem;"></i> Escanear Código
                </button>

                <!-- Área de resultados -->
                <div id="ts-results">
                    <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                        <i class="ph ph-package" style="font-size:2.5rem; display:block; margin-bottom:12px; opacity:0.4;"></i>
                        <p style="font-size:0.9rem;">Escribe para buscar o escanea un código.</p>
                    </div>
                </div>

            </div>
        `;

        // Cargar catálogo
        let catalog = [];
        try {
            catalog = await buildCatalog();
        } catch (err) {
            console.error('[team_scanner] Error construyendo catálogo:', err);
        }

        const searchInput = container.querySelector('#ts-search-input');
        const resultsEl   = container.querySelector('#ts-results');
        const scanBtn     = container.querySelector('#ts-scan-btn');

        // Foco al input
        searchInput.addEventListener('focus', () => {
            searchInput.style.borderColor = 'var(--primary)';
        });
        searchInput.addEventListener('blur', () => {
            searchInput.style.borderColor = 'var(--border)';
        });

        // Búsqueda con debounce
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const q = searchInput.value.trim().toUpperCase();
                if (!q) {
                    resultsEl.innerHTML = `
                        <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                            <i class="ph ph-package" style="font-size:2.5rem; display:block; margin-bottom:12px; opacity:0.4;"></i>
                            <p style="font-size:0.9rem;">Escribe para buscar o escanea un código.</p>
                        </div>
                    `;
                    return;
                }
                const matches = catalog.filter(p => p.name.includes(q));
                renderResults(matches, resultsEl);
            }, 300);
        });

        // Función de búsqueda por término (usada desde escaneo)
        function searchAndShow(term) {
            const q = (term || '').trim().toUpperCase();
            searchInput.value = term;
            if (!q) { renderResults([], resultsEl); return; }
            const matches = catalog.filter(p => p.name.includes(q));
            renderResults(matches, resultsEl);
        }

        // ── Escanear con cámara ──
        let _scanning = false;
        let _scanStream = null;

        async function stopScanning() {
            _scanning = false;
            if (_scanStream) {
                _scanStream.getTracks().forEach(t => t.stop());
                _scanStream = null;
            }
            // QuaggaJS cleanup
            if (typeof Quagga !== 'undefined') {
                try { Quagga.offDetected(); Quagga.stop(); } catch {}
            }
            // Liberar tracks de video manualmente (iOS no siempre los suelta)
            try {
                container.querySelectorAll('video').forEach(v => {
                    if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; }
                });
            } catch {}
            const videoWrap = container.querySelector('#ts-camera-wrap');
            if (videoWrap) videoWrap.remove();
            scanBtn.disabled = false;
            scanBtn.innerHTML = '<i class="ph ph-barcode" style="font-size:1.2rem;"></i> Escanear Código';
        }

        function onBarcodeDetected(barcode) {
            stopScanning();
            searchInput.value = barcode;
            // Buscar en catálogo
            const matches = catalog.filter(p => p.name.includes(barcode));
            if (matches.length > 0) {
                renderResults(matches, resultsEl);
            } else if (window.BarcodeScanner) {
                resultsEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="ph ph-spinner ph-spin" style="font-size:1.5rem;"></i></div>';
                window.BarcodeScanner.lookupProduct(barcode).then(result => {
                    if (result?.success && result.product?.nombre) {
                        searchAndShow(result.product.nombre);
                    } else {
                        resultsEl.innerHTML = `
                            <div style="text-align:center; padding:30px 20px; background:var(--bg-card); border:1px solid var(--border); border-radius:14px;">
                                <i class="ph ph-barcode" style="font-size:2rem; color:var(--text-muted); opacity:0.5; display:block; margin-bottom:8px;"></i>
                                <p style="font-weight:700; color:var(--text-primary); margin:0 0 4px;">Código: ${window.escapeHTML(barcode)}</p>
                                <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">Producto no encontrado en el catálogo.</p>
                            </div>`;
                    }
                }).catch(() => {
                    resultsEl.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">Código: ${window.escapeHTML(barcode)} — no encontrado.</p>`;
                });
            }
        }

        scanBtn.addEventListener('click', async () => {
            if (_scanning) { stopScanning(); return; }

            scanBtn.disabled = true;
            scanBtn.innerHTML = '<i class="ph ph-spinner ph-spin" style="font-size:1.2rem;"></i> Abriendo cámara…';

            // Crear contenedor de video
            const wrap = document.createElement('div');
            wrap.id = 'ts-camera-wrap';
            wrap.style.cssText = 'position:relative; margin-bottom:16px; border-radius:14px; overflow:hidden; border:2px solid var(--primary);';

            // ── Método 1: BarcodeDetector nativo (Chrome/Android) ──
            if ('BarcodeDetector' in window) {
                try {
                    _scanStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                    });
                    wrap.innerHTML = `
                        <video id="ts-camera-video" autoplay playsinline muted style="width:100%; display:block; border-radius:12px;"></video>
                        <div style="position:absolute; top:8px; right:8px;">
                            <button id="ts-camera-close" style="background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; font-size:0.82rem;">
                                <i class="ph ph-x"></i> Cerrar</button>
                        </div>
                        <div style="position:absolute; bottom:0; left:0; right:0; padding:8px; text-align:center; background:linear-gradient(transparent, rgba(0,0,0,0.6));">
                            <span style="color:#fff; font-size:0.78rem;">Apunta al código de barras…</span>
                        </div>`;
                    resultsEl.before(wrap);
                    wrap.querySelector('#ts-camera-close').addEventListener('click', stopScanning);
                    const video = wrap.querySelector('#ts-camera-video');
                    video.srcObject = _scanStream;
                    await video.play();
                    _scanning = true;
                    scanBtn.disabled = false;
                    scanBtn.innerHTML = '<i class="ph ph-stop" style="font-size:1.2rem;"></i> Detener cámara';

                    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
                    const scanLoop = async () => {
                        if (!_scanning) return;
                        try {
                            const codes = await detector.detect(video);
                            if (codes.length > 0) { onBarcodeDetected(codes[0].rawValue); return; }
                        } catch {}
                        if (_scanning) requestAnimationFrame(scanLoop);
                    };
                    requestAnimationFrame(scanLoop);
                    return;
                } catch (err) {
                    stopScanning();
                    // Si falla, intentar QuaggaJS
                }
            }

            // ── Método 2: QuaggaJS (Safari/iOS/Firefox) ──
            if (typeof Quagga !== 'undefined') {
                try {
                    wrap.innerHTML = `
                        <div id="ts-quagga-target" style="width:100%; min-height:280px; background:#000; border-radius:12px; overflow:hidden;"></div>
                        <div style="position:absolute; top:8px; right:8px;">
                            <button id="ts-camera-close" style="background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; font-size:0.82rem;">
                                <i class="ph ph-x"></i> Cerrar</button>
                        </div>
                        <div style="position:absolute; bottom:0; left:0; right:0; padding:8px; text-align:center; background:linear-gradient(transparent, rgba(0,0,0,0.6));">
                            <span style="color:#fff; font-size:0.78rem;">Apunta al código de barras…</span>
                        </div>`;
                    resultsEl.before(wrap);
                    wrap.querySelector('#ts-camera-close').addEventListener('click', stopScanning);

                    await new Promise((resolve, reject) => {
                        Quagga.init({
                            inputStream: { name: 'Live', type: 'LiveStream', target: document.getElementById('ts-quagga-target'),
                                constraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
                            decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader'] },
                            locate: true, frequency: 10
                        }, (err) => { if (err) reject(err); else resolve(); });
                    });
                    Quagga.start();
                    _scanning = true;
                    scanBtn.disabled = false;
                    scanBtn.innerHTML = '<i class="ph ph-stop" style="font-size:1.2rem;"></i> Detener cámara';

                    let lastCode = null, codeCount = 0;
                    Quagga.onDetected((result) => {
                        const code = result.codeResult?.code;
                        if (!code || code.length < 8) return;
                        if (code === lastCode) { codeCount++; } else { lastCode = code; codeCount = 1; }
                        if (codeCount >= 3) { onBarcodeDetected(code); }
                    });
                    return;
                } catch (err) {
                    stopScanning();
                }
            }

            // ── Sin escáner disponible ──
            stopScanning();
            window.showToast?.('No se pudo abrir la cámara. Usa la búsqueda de texto.', 'error');
        });

        // Cleanup al salir de la vista
        window._viewCleanup = () => { stopScanning(); };
    };
})();
