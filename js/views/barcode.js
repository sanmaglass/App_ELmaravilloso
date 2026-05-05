// ──────────────────────────────────────────────────────────────
// Barcode Scanner View — Cascade + Manual fallback + Quota alerts
// ──────────────────────────────────────────────────────────────
window.Views = window.Views || {};

window.Views.barcode = async (container) => {
    // Cleanup previous view's camera if still running
    window.BarcodeScanner.stopCamera();
    if (window._viewCleanup) {
        try { window._viewCleanup(); } catch (e) { /* ignore */ }
    }

    container.innerHTML = `
        <style>
            .bc-card { margin-bottom: 20px; }
            .bc-result-card {
                display: flex; gap: 20px; padding: 20px;
                background: var(--bg-secondary); border-radius: 12px;
                border: 1px solid var(--border); margin-top: 16px;
            }
            .bc-result-card img.bc-product-img {
                width: 120px; height: 120px; object-fit: contain;
                border-radius: 8px; background: #fff; flex-shrink: 0;
            }
            .bc-result-info { flex: 1; min-width: 0; }
            .bc-result-info h3 { margin: 0 0 8px; font-size: 1.2rem; }
            .bc-result-info .bc-detail {
                font-size: 0.9rem; color: var(--text-muted); margin-bottom: 4px;
            }
            .bc-result-info .bc-detail b { color: var(--text-primary); }
            .bc-source-badge {
                display: inline-block; padding: 2px 10px; border-radius: 12px;
                font-size: 0.75rem; font-weight: 600; margin-left: 8px;
            }
            .bc-source-off { background: #dcfce7; color: #166534; }
            .bc-source-upc { background: #dbeafe; color: #1e40af; }
            .bc-source-cache { background: #f3e8ff; color: #6b21a8; }
            .bc-source-manual { background: #fef3c7; color: #92400e; }
            .dark-mode .bc-source-off { background: #064e3b; color: #6ee7b7; }
            .dark-mode .bc-source-upc { background: #1e3a5f; color: #93c5fd; }
            .dark-mode .bc-source-cache { background: #3b0764; color: #c4b5fd; }
            .dark-mode .bc-source-manual { background: #78350f; color: #fde68a; }

            #bc-camera-box {
                position: relative; width: 100%; max-width: 500px;
                margin: 16px auto; border-radius: 12px; overflow: hidden;
                background: #000; aspect-ratio: 4/3;
            }
            #bc-camera-box video, #bc-camera-box canvas {
                width: 100% !important; height: 100% !important; object-fit: cover;
            }
            .bc-scan-overlay {
                position: absolute; inset: 0; pointer-events: none;
                display: flex; align-items: center; justify-content: center;
            }
            .bc-scan-line {
                width: 80%; height: 2px; background: var(--primary);
                box-shadow: 0 0 12px var(--primary);
                animation: bcScanMove 2s ease-in-out infinite;
            }
            @keyframes bcScanMove {
                0%, 100% { transform: translateY(-60px); }
                50% { transform: translateY(60px); }
            }
            .bc-json-block {
                margin-top: 12px; padding: 14px; border-radius: 8px;
                background: var(--bg-secondary); border: 1px solid var(--border);
                font-family: monospace; font-size: 0.82rem; white-space: pre-wrap;
                overflow-x: auto; max-height: 300px;
            }
            .bc-alert {
                display: flex; align-items: flex-start; gap: 10px;
                padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;
                font-size: 0.85rem; line-height: 1.4;
            }
            .bc-alert-info { background: rgba(59,130,246,0.08); color: #2563eb; border: 1px solid rgba(59,130,246,0.2); }
            .bc-alert-warn { background: rgba(245,158,11,0.08); color: #d97706; border: 1px solid rgba(245,158,11,0.2); }
            .bc-alert-error { background: rgba(220,38,38,0.08); color: var(--danger); border: 1px solid rgba(220,38,38,0.2); }
            .dark-mode .bc-alert-info { color: #60a5fa; }
            .dark-mode .bc-alert-warn { color: #fbbf24; }
            .dark-mode .bc-alert-error { color: #f87171; background: rgba(220,38,38,0.15); }

            .bc-cascade-log {
                font-size: 0.8rem; color: var(--text-muted); margin-top: 12px;
                padding: 10px; background: var(--bg-secondary); border-radius: 8px;
                border: 1px solid var(--border);
            }
            .bc-cascade-log .bc-log-step {
                display: flex; align-items: center; gap: 8px; padding: 3px 0;
            }
            .bc-log-hit { color: #16a34a; }
            .bc-log-miss { color: var(--text-muted); }
            .bc-log-err { color: var(--danger); }

            .bc-manual-form {
                margin-top: 16px; padding: 20px; border-radius: 12px;
                background: rgba(245,158,11,0.06); border: 2px dashed #d97706;
            }
            .bc-manual-form h3 { margin: 0 0 4px; color: #d97706; }
            .bc-manual-form .bc-manual-sub { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; }

            .bc-quota-panel {
                display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 12px; margin-top: 12px;
            }
            .bc-quota-item {
                padding: 12px; border-radius: 8px; text-align: center;
                background: var(--bg-secondary); border: 1px solid var(--border);
            }
            .bc-quota-item .bc-q-num { font-size: 1.5rem; font-weight: 700; }
            .bc-quota-item .bc-q-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }

            .bc-history-item {
                display: flex; gap: 12px; align-items: center;
                padding: 10px 14px; background: var(--bg-secondary);
                border-radius: 8px; border: 1px solid var(--border); cursor: pointer;
                transition: background 0.15s;
            }
            .bc-history-item:hover { background: rgba(128,128,128,0.08); }

            @media (max-width: 600px) {
                .bc-result-card { flex-direction: column; align-items: center; text-align: center; }
                .bc-quota-panel { grid-template-columns: repeat(2, 1fr); }
            }
        </style>

        <!-- Alerts banner -->
        <div id="bc-alerts"></div>

        <div class="card bc-card">
            <h2 style="margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:12px;">
                <i class="ph ph-barcode" style="color:var(--accent);"></i> Escáner de Código de Barras
            </h2>

            <!-- Search bar -->
            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:end;">
                <div class="form-group" style="flex:1; min-width:200px; margin-bottom:0;">
                    <label class="form-label">Código EAN-13 / EAN-8 / UPC</label>
                    <input type="text" id="bc-input" class="form-input"
                           placeholder="Ej. 7802800710019" maxlength="14"
                           inputmode="numeric" autocomplete="off">
                </div>
                <button class="btn btn-primary" id="bc-search-btn" style="height:42px;">
                    <i class="ph ph-magnifying-glass"></i> Buscar
                </button>
                <button class="btn btn-secondary" id="bc-camera-btn" style="height:42px;">
                    <i class="ph ph-camera"></i> Escanear
                </button>
            </div>

            <!-- Camera -->
            <div id="bc-camera-wrapper" style="display:none; margin-top:16px; text-align:center;">
                <div id="bc-camera-box">
                    <div class="bc-scan-overlay"><div class="bc-scan-line"></div></div>
                </div>
                <button class="btn btn-secondary" id="bc-camera-stop" style="margin-top:8px;">
                    <i class="ph ph-stop-circle"></i> Detener cámara
                </button>
            </div>

            <!-- Loading -->
            <div id="bc-loading" style="display:none; text-align:center; padding:24px; color:var(--text-muted);">
                <i class="ph ph-spinner" style="font-size:2rem; animation: bcSpin 1s linear infinite;"></i>
                <p id="bc-loading-text">Buscando producto...</p>
                <style>@keyframes bcSpin { to { transform: rotate(360deg); } }</style>
            </div>

            <!-- Result -->
            <div id="bc-result"></div>

            <!-- Cascade log -->
            <div id="bc-cascade-log"></div>
        </div>

        <!-- Quota status panel -->
        <div class="card bc-card">
            <h3 style="margin-bottom:4px;">
                <i class="ph ph-chart-bar" style="color:var(--accent);"></i> Estado de APIs
            </h3>
            <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:8px;">
                Uso de consultas y cuota disponible
            </p>
            <div id="bc-quota-panel" class="bc-quota-panel"></div>
        </div>

        <!-- History -->
        <div class="card bc-card" id="bc-history-card" style="display:none;">
            <h3 style="margin-bottom:12px;">
                <i class="ph ph-clock-counter-clockwise" style="color:var(--accent);"></i>
                Historial de sesión
            </h3>
            <div id="bc-history"></div>
        </div>
    `;

    // ── DOM refs ─────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);
    const input = $('bc-input');
    const searchBtn = $('bc-search-btn');
    const cameraBtn = $('bc-camera-btn');
    const cameraWrapper = $('bc-camera-wrapper');
    const cameraStop = $('bc-camera-stop');
    const loadingEl = $('bc-loading');
    const loadingText = $('bc-loading-text');
    const resultEl = $('bc-result');
    const cascadeLogEl = $('bc-cascade-log');
    const alertsEl = $('bc-alerts');
    const quotaPanel = $('bc-quota-panel');
    const historyCard = $('bc-history-card');
    const historyEl = $('bc-history');

    const MAX_HISTORY = 50;
    const sessionHistory = [];
    let searching = false;
    let cameraActive = false;

    // Shared AudioContext (reused to avoid leaks)
    let audioCtx = null;

    // ── View cleanup (called when navigating away) ───────────────
    window._viewCleanup = () => {
        window.BarcodeScanner.stopCamera();
        cameraActive = false;
        if (audioCtx) {
            try { audioCtx.close(); } catch (e) { /* ignore */ }
            audioCtx = null;
        }
    };

    // ── Render quota panel ───────────────────────────────────────
    function renderQuota() {
        const q = window.BarcodeScanner.getQuotaStatus();
        quotaPanel.innerHTML = `
            <div class="bc-quota-item">
                <div class="bc-q-num" style="color:#16a34a;">${q.off.today}</div>
                <div class="bc-q-label">Open Food Facts hoy</div>
            </div>
            <div class="bc-quota-item">
                <div class="bc-q-num" style="color:#2563eb;">${q.upc.today}<span style="font-size:0.7rem;color:var(--text-muted);">/${100}</span></div>
                <div class="bc-q-label">UPCitemdb hoy</div>
            </div>
            <div class="bc-quota-item">
                <div class="bc-q-num" style="color:#7c3aed;">${q.cache.hits}</div>
                <div class="bc-q-label">Cache hits</div>
            </div>
            <div class="bc-quota-item">
                <div class="bc-q-num" style="color:#d97706;">${q.manual.entries}</div>
                <div class="bc-q-label">Ingresados manual</div>
            </div>
        `;
    }

    // ── Render alerts ────────────────────────────────────────────
    function renderAlerts(alerts) {
        if (!alerts || alerts.length === 0) { alertsEl.innerHTML = ''; return; }
        const seen = new Set();
        const unique = alerts.filter(a => { if (seen.has(a.msg)) return false; seen.add(a.msg); return true; });

        alertsEl.innerHTML = unique.map(a => {
            const icon = a.level === 'error' ? 'ph-warning-circle' : a.level === 'warn' ? 'ph-warning' : 'ph-info';
            return `<div class="bc-alert bc-alert-${Utils.escapeHTML(a.level)}">
                <i class="ph ${icon}" style="font-size:1.1rem; flex-shrink:0; margin-top:1px;"></i>
                <div><b>${Utils.escapeHTML(a.api)}:</b> ${Utils.escapeHTML(a.msg)}</div>
            </div>`;
        }).join('');
    }

    // ── Render cascade log ───────────────────────────────────────
    function renderCascadeLog(log) {
        if (!log || log.length === 0) { cascadeLogEl.innerHTML = ''; return; }
        cascadeLogEl.innerHTML = `
            <div class="bc-cascade-log">
                <div style="font-weight:600; margin-bottom:6px; font-size:0.82rem;">Cascada de búsqueda:</div>
                ${log.map(l => {
                    const status = String(l.status || '');
                    const isHit = status === 'found' || status === 'hit';
                    const isMiss = status === 'miss' || status === 'not found' || status === 'skipped';
                    const cls = isHit ? 'bc-log-hit' : (isMiss ? 'bc-log-miss' : 'bc-log-err');
                    const icon = isHit ? 'ph-check-circle' : (isMiss ? 'ph-minus-circle' : 'ph-x-circle');
                    const detail = l.detail ? ` — ${l.detail}` : '';
                    return `<div class="bc-log-step ${cls}">
                        <i class="ph ${icon}"></i>
                        <span>${Utils.escapeHTML(l.api)}: ${Utils.escapeHTML(status)}${Utils.escapeHTML(detail)}</span>
                    </div>`;
                }).join('')}
            </div>`;
    }

    // ── Source badge helper ───────────────────────────────────────
    function sourceBadge(source) {
        const cls = source === 'Open Food Facts' ? 'bc-source-off'
                  : source === 'UPCitemdb' ? 'bc-source-upc'
                  : source === 'Cache Local' ? 'bc-source-cache'
                  : 'bc-source-manual';
        return `<span class="bc-source-badge ${cls}">${Utils.escapeHTML(source)}</span>`;
    }

    // ── Render result ────────────────────────────────────────────
    function renderResult(product, source) {
        const p = product;
        const safeImg = p.imagen && typeof p.imagen === 'string' && p.imagen.startsWith('https://') ? p.imagen : null;
        const imgHtml = safeImg
            ? `<img class="bc-product-img" src="${Utils.escapeHTML(safeImg)}" alt="${Utils.escapeHTML(p.nombre)}" onerror="this.style.display='none'">`
            : `<div style="width:120px;height:120px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border-radius:8px;color:#9ca3af;font-size:2.5rem;flex-shrink:0;"><i class="ph ph-package"></i></div>`;

        const json = JSON.stringify(p, null, 2);

        resultEl.innerHTML = `
            <div class="bc-result-card">
                ${imgHtml}
                <div class="bc-result-info">
                    <h3>${Utils.escapeHTML(p.nombre)} ${sourceBadge(source)}</h3>
                    <div class="bc-detail"><b>Código:</b> ${Utils.escapeHTML(p.barcode)}</div>
                    <div class="bc-detail"><b>Marca:</b> ${Utils.escapeHTML(p.marca)}</div>
                    <div class="bc-detail"><b>Categoría:</b> ${Utils.escapeHTML(p.categoria)}</div>
                </div>
            </div>
            <details style="margin-top:12px;">
                <summary style="cursor:pointer; color:var(--text-muted); font-size:0.85rem;">
                    <i class="ph ph-code"></i> Ver JSON
                </summary>
                <div class="bc-json-block">${Utils.escapeHTML(json)}</div>
                <button class="btn btn-secondary" id="bc-copy-json" style="margin-top:8px; font-size:0.8rem;">
                    <i class="ph ph-copy"></i> Copiar JSON
                </button>
            </details>`;

        const copyBtn = $('bc-copy-json');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(json).then(() => {
                        copyBtn.innerHTML = '<i class="ph ph-check"></i> Copiado';
                        setTimeout(() => { copyBtn.innerHTML = '<i class="ph ph-copy"></i> Copiar JSON'; }, 2000);
                    }).catch(() => {
                        selectJsonText();
                    });
                } else {
                    selectJsonText();
                }
            });
        }

        function selectJsonText() {
            const el = $('bc-copy-json');
            const jsonBlock = el ? el.previousElementSibling : null;
            if (jsonBlock) {
                const r = document.createRange();
                r.selectNodeContents(jsonBlock);
                const s = getSelection();
                s.removeAllRanges();
                s.addRange(r);
            }
        }
    }

    // ── Render manual entry form ─────────────────────────────────
    function renderManualForm(barcode) {
        resultEl.innerHTML = `
            <div class="bc-manual-form">
                <h3><i class="ph ph-pencil-simple-line"></i> Producto no encontrado</h3>
                <div class="bc-manual-sub">
                    No se encontró <b>${Utils.escapeHTML(barcode)}</b> en ninguna API.
                    Ingresa los datos manualmente para guardarlo en tu base local.
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div class="form-group" style="grid-column:1/-1;">
                        <label class="form-label">Nombre del producto *</label>
                        <input type="text" id="bc-m-nombre" class="form-input" placeholder="Ej. Galletas Tritón">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Marca</label>
                        <input type="text" id="bc-m-marca" class="form-input" placeholder="Ej. McKay">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Categoría</label>
                        <input type="text" id="bc-m-categoria" class="form-input" placeholder="Ej. Galletas, Snacks">
                    </div>
                    <div class="form-group" style="grid-column:1/-1;">
                        <label class="form-label">URL de imagen (opcional, solo https)</label>
                        <input type="url" id="bc-m-imagen" class="form-input" placeholder="https://...">
                    </div>
                </div>
                <div style="display:flex; gap:12px; margin-top:16px;">
                    <button class="btn btn-primary" id="bc-m-save">
                        <i class="ph ph-floppy-disk"></i> Guardar producto
                    </button>
                    <button class="btn btn-secondary" id="bc-m-cancel">Cancelar</button>
                </div>
                <div id="bc-m-error" style="display:none; margin-top:12px; padding:10px; border-radius:8px; background:rgba(220,38,38,0.08); color:var(--danger); font-size:0.85rem;"></div>
            </div>`;

        $('bc-m-save').addEventListener('click', async () => {
            const nombre = ($('bc-m-nombre').value || '').trim();
            if (!nombre) {
                const errEl = $('bc-m-error');
                errEl.textContent = 'El nombre del producto es obligatorio.';
                errEl.style.display = '';
                $('bc-m-nombre').focus();
                return;
            }

            const imgUrl = ($('bc-m-imagen').value || '').trim();
            const product = await window.BarcodeScanner.saveManualProduct({
                barcode,
                nombre,
                marca: ($('bc-m-marca').value || '').trim(),
                categoria: ($('bc-m-categoria').value || '').trim(),
                imagen: (imgUrl && imgUrl.startsWith('https://')) ? imgUrl : null
            });

            sessionHistory.unshift({ product, source: 'Manual' });
            if (sessionHistory.length > MAX_HISTORY) sessionHistory.pop();
            renderResult(product, 'Manual');
            renderHistory();
            renderQuota();
        });

        $('bc-m-cancel').addEventListener('click', () => {
            resultEl.innerHTML = '';
            cascadeLogEl.innerHTML = '';
        });
    }

    // ── Render history ───────────────────────────────────────────
    function renderHistory() {
        if (sessionHistory.length === 0) { historyCard.style.display = 'none'; return; }
        historyCard.style.display = '';
        historyEl.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${sessionHistory.map((h, i) => {
                    const p = h.product;
                    const safeImg = p.imagen && typeof p.imagen === 'string' && p.imagen.startsWith('https://') ? p.imagen : null;
                    return `<div class="bc-history-item" data-idx="${i}">
                        ${safeImg ? `<img src="${Utils.escapeHTML(safeImg)}" style="width:40px;height:40px;object-fit:contain;border-radius:4px;background:#fff;" onerror="this.style.display='none'">` : '<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border-radius:4px;color:#9ca3af;"><i class="ph ph-package"></i></div>'}
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${Utils.escapeHTML(p.nombre)} ${sourceBadge(h.source)}
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">
                                ${Utils.escapeHTML(p.barcode)} · ${Utils.escapeHTML(p.marca)}
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        historyEl.querySelectorAll('.bc-history-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx, 10);
                const h = sessionHistory[idx];
                if (h) {
                    input.value = h.product.barcode;
                    renderResult(h.product, h.source);
                    cascadeLogEl.innerHTML = '';
                }
            });
        });
    }

    // ── Main search ──────────────────────────────────────────────
    async function doSearch(code) {
        if (!code || searching) return;

        if (!/^\d+$/.test(code)) {
            resultEl.innerHTML = `<div class="bc-alert bc-alert-error" style="margin-top:16px;">
                <i class="ph ph-warning-circle"></i>
                <div>El código debe contener solo números.</div>
            </div>`;
            return;
        }
        if (code.length < 8 || code.length > 14) {
            resultEl.innerHTML = `<div class="bc-alert bc-alert-error" style="margin-top:16px;">
                <i class="ph ph-warning-circle"></i>
                <div>El código debe tener entre 8 y 14 dígitos. Ingresaste ${Utils.escapeHTML(String(code.length))}.</div>
            </div>`;
            return;
        }

        searching = true;
        searchBtn.disabled = true;
        loadingEl.style.display = '';
        resultEl.innerHTML = '';
        cascadeLogEl.innerHTML = '';
        loadingText.textContent = 'Buscando producto...';

        try {
            const res = await window.BarcodeScanner.lookupProduct(code);

            renderAlerts(res.alerts);
            renderCascadeLog(res.log);
            renderQuota();

            if (res.success) {
                sessionHistory.unshift({ product: res.product, source: res.source });
                if (sessionHistory.length > MAX_HISTORY) sessionHistory.pop();
                renderResult(res.product, res.source);
                renderHistory();
            } else if (res.needsManualEntry) {
                renderManualForm(res.barcode);
            } else {
                resultEl.innerHTML = `<div class="bc-alert bc-alert-error" style="margin-top:16px;">
                    <i class="ph ph-warning-circle"></i>
                    <div>${Utils.escapeHTML(res.error || 'Error desconocido')}</div>
                </div>`;
            }
        } catch (err) {
            resultEl.innerHTML = `<div class="bc-alert bc-alert-error" style="margin-top:16px;">
                <i class="ph ph-warning-circle"></i>
                <div>Error inesperado: ${Utils.escapeHTML(err.message || 'desconocido')}</div>
            </div>`;
        } finally {
            loadingEl.style.display = 'none';
            searching = false;
            searchBtn.disabled = false;
        }
    }

    // ── Events ───────────────────────────────────────────────────
    searchBtn.addEventListener('click', () => doSearch(input.value.trim()));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doSearch(input.value.trim()); }
    });
    input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '');
    });

    // ── Beep helper ──────────────────────────────────────────────
    function playBeep() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 1200;
            gain.gain.value = 0.3;
            osc.connect(gain).connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.12);
        } catch (e) { /* no audio support */ }
    }

    // ── Camera ───────────────────────────────────────────────────
    cameraBtn.addEventListener('click', async () => {
        if (cameraActive || searching) return;

        if (typeof Quagga === 'undefined') {
            loadingEl.style.display = '';
            loadingText.textContent = 'Cargando librería de escaneo...';
            try {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2/dist/quagga.min.js';
                    s.onload = resolve;
                    s.onerror = () => reject(new Error('No se pudo cargar QuaggaJS'));
                    document.head.appendChild(s);
                });
            } catch (err) {
                loadingEl.style.display = 'none';
                resultEl.innerHTML = `<div class="bc-alert bc-alert-error" style="margin-top:16px;">
                    <i class="ph ph-warning-circle"></i>
                    <div>No se pudo cargar la librería de escaneo. Verifica tu conexión a internet.</div>
                </div>`;
                return;
            }
            loadingEl.style.display = 'none';
        }

        cameraWrapper.style.display = '';
        resultEl.innerHTML = '';
        cascadeLogEl.innerHTML = '';
        cameraActive = true;

        try {
            await window.BarcodeScanner.startCamera('bc-camera-box', (code) => {
                playBeep();
                window.BarcodeScanner.stopCamera();
                cameraWrapper.style.display = 'none';
                cameraActive = false;
                input.value = code;
                doSearch(code);
            });
        } catch (err) {
            cameraWrapper.style.display = 'none';
            cameraActive = false;
            const msg = String(err.message || err || '');
            let userMsg = 'No se pudo acceder a la cámara.';
            if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
                userMsg = 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.';
            } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFound')) {
                userMsg = 'No se detectó ninguna cámara en este dispositivo.';
            } else if (msg.includes('NotReadableError')) {
                userMsg = 'La cámara está siendo usada por otra aplicación.';
            } else if (msg.includes('insecure') || msg.includes('secure')) {
                userMsg = 'La cámara requiere HTTPS. Abre la app desde una conexión segura.';
            }
            resultEl.innerHTML = `<div class="bc-alert bc-alert-error" style="margin-top:16px;">
                <i class="ph ph-camera-slash" style="font-size:1.2rem;"></i>
                <div>${Utils.escapeHTML(userMsg)}</div>
            </div>`;
        }
    });

    cameraStop.addEventListener('click', () => {
        window.BarcodeScanner.stopCamera();
        cameraWrapper.style.display = 'none';
        cameraActive = false;
    });

    // ── Init ─────────────────────────────────────────────────────
    renderQuota();
    renderAlerts(window.BarcodeScanner.getQuotaStatus().alerts);
};
