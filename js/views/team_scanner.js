// team_scanner.js — Consultar Precio (empleado)
// Dos modos: búsqueda por texto + escaneo de código de barras
window.Views = window.Views || {};

(function () {
    // Construir catálogo de precios desde eleventa_sales.items
    async function buildCatalog() {
        const sales = await window.db.eleventa_sales.toArray();
        const catalog = new Map(); // name → { name, price, lastSeen }
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
                    catalog.set(name, { name, price, lastSeen: s.date });
                }
            }
        }
        // Ordenar alfabéticamente
        return Array.from(catalog.values()).sort((a, b) => a.name.localeCompare(b.name, 'es-CL'));
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
        container.innerHTML = products.slice(0, 20).map(p => `
            <div style="display:flex; align-items:center; justify-content:space-between;
                        padding:14px 16px; background:var(--bg-card); border:1px solid var(--border);
                        border-radius:12px; margin-bottom:8px; gap:12px;">
                <span style="font-weight:600; color:var(--text-primary); font-size:0.92rem; flex:1; min-width:0;
                             overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${window.escapeHTML(p.name)}
                </span>
                <span style="font-size:1.15rem; font-weight:800; color:var(--primary); flex-shrink:0; white-space:nowrap;">
                    ${window.formatCurrency(p.price)}
                </span>
            </div>
        `).join('');
    }

    window.Views.team_scanner = async (container) => {
        container.innerHTML = `
            <div style="max-width:640px; margin:0 auto; padding:0 0 40px;">

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

                <!-- Input oculto para cámara (fallback) -->
                <input id="ts-file-input" type="file" accept="image/*" capture="environment"
                       style="display:none;">

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
        const fileInput   = container.querySelector('#ts-file-input');

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

        // Botón escanear
        scanBtn.addEventListener('click', async () => {
            if (window.BarcodeScanner && typeof window.BarcodeScanner.startCameraScanner === 'function') {
                // Usar el escáner de cámara si está disponible
                try {
                    scanBtn.disabled = true;
                    scanBtn.innerHTML = '<i class="ph ph-spinner" style="font-size:1.2rem;"></i> Escaneando…';
                    const result = await window.BarcodeScanner.startCameraScanner();
                    if (result && result.barcode) {
                        // Buscar por nombre que contenga el código, o mostrar el código directamente
                        searchAndShow(result.nombre || result.barcode);
                    }
                } catch (err) {
                    window.showToast('No se pudo usar la cámara. Sube una foto.', 'error');
                    fileInput.click();
                } finally {
                    scanBtn.disabled = false;
                    scanBtn.innerHTML = '<i class="ph ph-barcode" style="font-size:1.2rem;"></i> Escanear Código';
                }
            } else {
                // Fallback: input de archivo (foto desde cámara)
                fileInput.click();
            }
        });

        // Fallback: escanear desde imagen capturada
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) return;
            if (window.BarcodeScanner && typeof window.BarcodeScanner.lookupBarcode === 'function') {
                scanBtn.disabled = true;
                scanBtn.innerHTML = '<i class="ph ph-spinner" style="font-size:1.2rem;"></i> Buscando…';
                try {
                    // Intentar leer el barcode del archivo con la API del navegador
                    if ('BarcodeDetector' in window) {
                        const detector = new BarcodeDetector();
                        const bitmap = await createImageBitmap(file);
                        const codes = await detector.detect(bitmap);
                        if (codes && codes.length > 0) {
                            const barcode = codes[0].rawValue;
                            const product = await window.BarcodeScanner.lookupBarcode(barcode);
                            searchAndShow(product?.nombre || barcode);
                        } else {
                            window.showToast('No se detectó código en la imagen.', 'error');
                        }
                    } else {
                        window.showToast('Escáner no disponible. Usa la búsqueda de texto.', 'error');
                    }
                } catch (err) {
                    window.showToast('Error al leer el código.', 'error');
                } finally {
                    scanBtn.disabled = false;
                    scanBtn.innerHTML = '<i class="ph ph-barcode" style="font-size:1.2rem;"></i> Escanear Código';
                    fileInput.value = '';
                }
            }
        });
    };
})();
