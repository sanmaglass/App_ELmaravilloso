// ──────────────────────────────────────────────────────────────
// Barcode Scanner — Cascade lookup + rate limit tracking
// APIs: Local Cache → Open Food Facts → UPCitemdb → Manual
// ──────────────────────────────────────────────────────────────

window.BarcodeScanner = {

    // ── Rate limit / quota tracking ──────────────────────────────
    _STORAGE_KEY: 'wm_barcode_api_stats',

    _getStats() {
        try {
            const raw = localStorage.getItem(this._STORAGE_KEY);
            const stats = raw ? JSON.parse(raw) : {};
            const today = new Date().toISOString().slice(0, 10);
            const month = today.slice(0, 7);

            if (stats._day !== today) {
                stats._day = today;
                stats.off_today = 0;
                stats.upc_today = 0;
            }
            if (stats._month !== month) {
                stats._month = month;
                stats.upc_month = 0;
            }
            if (!stats.off_total) stats.off_total = 0;
            if (!stats.upc_total) stats.upc_total = 0;
            if (!stats.off_errors) stats.off_errors = 0;
            if (!stats.upc_errors) stats.upc_errors = 0;
            if (!stats.upc_blocked_until) stats.upc_blocked_until = 0;
            if (!stats.cache_hits) stats.cache_hits = 0;
            if (!stats.manual_entries) stats.manual_entries = 0;

            return stats;
        } catch (e) {
            return { _day: '', _month: '', off_today: 0, off_total: 0, off_errors: 0,
                     upc_today: 0, upc_total: 0, upc_month: 0, upc_errors: 0,
                     upc_blocked_until: 0, cache_hits: 0, manual_entries: 0 };
        }
    },

    _saveStats(stats) {
        try { localStorage.setItem(this._STORAGE_KEY, JSON.stringify(stats)); } catch (e) { /* full */ }
    },

    _trackRequest(api, success) {
        const s = this._getStats();
        if (api === 'off') {
            s.off_today++;
            s.off_total++;
            if (!success) s.off_errors++;
        } else if (api === 'upc') {
            s.upc_today++;
            s.upc_total++;
            s.upc_month++;
            if (!success) s.upc_errors++;
        } else if (api === 'cache') {
            s.cache_hits++;
        } else if (api === 'manual') {
            s.manual_entries++;
        }
        this._saveStats(s);
        return s;
    },

    getQuotaStatus() {
        const s = this._getStats();
        const alerts = [];
        const UPC_DAILY_LIMIT = 100;
        const OFF_REASONABLE_LIMIT = 100;

        if (s.off_today >= OFF_REASONABLE_LIMIT) {
            alerts.push({ level: 'warn', api: 'Open Food Facts', msg: `${s.off_today} consultas hoy — acercándose al uso razonable (sin límite duro, pero la ONG pide moderación)` });
        }

        const upcRemaining = Math.max(0, UPC_DAILY_LIMIT - s.upc_today);
        if (s.upc_today >= UPC_DAILY_LIMIT) {
            alerts.push({ level: 'error', api: 'UPCitemdb', msg: `Cuota diaria agotada (${UPC_DAILY_LIMIT}/día). Se renueva mañana.` });
        } else if (upcRemaining <= 20) {
            alerts.push({ level: 'warn', api: 'UPCitemdb', msg: `Quedan ${upcRemaining} consultas hoy de ${UPC_DAILY_LIMIT}.` });
        }

        if (s.upc_blocked_until > Date.now()) {
            const mins = Math.ceil((s.upc_blocked_until - Date.now()) / 60000);
            alerts.push({ level: 'error', api: 'UPCitemdb', msg: `Bloqueado por rate limit. Reintenta en ~${mins} min.` });
        }

        return {
            off: { today: s.off_today, total: s.off_total, errors: s.off_errors },
            upc: { today: s.upc_today, total: s.upc_total, month: s.upc_month, remaining: upcRemaining, errors: s.upc_errors },
            cache: { hits: s.cache_hits },
            manual: { entries: s.manual_entries },
            alerts
        };
    },

    // ── Fetch with timeout (compatible with older browsers) ──────
    _fetchWithTimeout(url, options, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs || 10000);
        return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timer));
    },

    // ── Local cache (IndexedDB via Dexie settings) ───────────────
    async _cacheGet(barcode) {
        try {
            const entry = await db.settings.get('barcode_' + barcode);
            if (entry && entry.value) {
                this._trackRequest('cache', true);
                return entry.value;
            }
        } catch (e) { /* ignore */ }
        return null;
    },

    async _cachePut(barcode, product) {
        try {
            await db.settings.put({
                key: 'barcode_' + barcode,
                value: { ...product, _cached_at: Date.now() }
            });
        } catch (e) { /* ignore */ }
    },

    // ── Normalize product output ─────────────────────────────────
    _normalize(barcode, data) {
        // Only allow https:// image URLs
        let imagen = data.imagen || null;
        if (imagen && typeof imagen === 'string' && !imagen.startsWith('https://')) {
            imagen = null;
        }
        return {
            barcode: String(barcode),
            nombre: (data.nombre || '').trim() || 'Sin nombre',
            marca: (data.marca || '').trim() || 'Sin marca',
            imagen: imagen,
            categoria: (data.categoria || '').trim() || 'Sin categoría'
        };
    },

    // ── API 1: Open Food Facts ───────────────────────────────────
    async _queryOpenFoodFacts(code) {
        try {
            const resp = await this._fetchWithTimeout(
                `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
                {},
                10000
            );

            if (!resp.ok) {
                this._trackRequest('off', false);
                return { found: false, error: `Open Food Facts: HTTP ${resp.status}` };
            }

            let data;
            try {
                data = await resp.json();
            } catch (parseErr) {
                this._trackRequest('off', false);
                return { found: false, error: 'Open Food Facts: Respuesta no válida del servidor' };
            }

            this._trackRequest('off', true);

            if (Number(data.status) !== 1 || !data.product) {
                return { found: false };
            }

            const p = data.product;
            return {
                found: true,
                source: 'Open Food Facts',
                product: this._normalize(code, {
                    nombre: p.product_name || p.product_name_es || p.product_name_en || '',
                    marca: p.brands || '',
                    imagen: p.image_front_url || p.image_url || null,
                    categoria: p.categories_tags
                        ? p.categories_tags.map(c => c.replace(/^en:/, '')).slice(0, 3).join(', ')
                        : (p.categories || '')
                })
            };
        } catch (err) {
            this._trackRequest('off', false);
            if (err.name === 'AbortError') {
                return { found: false, error: 'Open Food Facts: Timeout (>10s)' };
            }
            return { found: false, error: `Open Food Facts: ${err.message}` };
        }
    },

    // ── API 2: UPCitemdb (needs proxy due to CORS) ───────────────
    async _queryUPCitemdb(code) {
        // Always re-read proxy URL from DB (user may change it in settings)
        let proxyUrl = '';
        try {
            const setting = await db.settings.get('barcode_upc_proxy');
            proxyUrl = setting ? setting.value : '';
        } catch (e) { proxyUrl = ''; }

        if (!proxyUrl) {
            return { found: false, skipped: true, reason: 'UPCitemdb: Sin proxy configurado (CORS no permite acceso directo)' };
        }

        const stats = this._getStats();
        if (stats.upc_today >= 100) {
            return { found: false, skipped: true, reason: 'UPCitemdb: Cuota diaria agotada (100/día)' };
        }
        if (stats.upc_blocked_until > Date.now()) {
            return { found: false, skipped: true, reason: 'UPCitemdb: Bloqueado temporalmente por rate limit' };
        }

        try {
            const url = proxyUrl.replace('{barcode}', encodeURIComponent(code));
            const resp = await this._fetchWithTimeout(url, {}, 10000);

            if (resp.status === 429) {
                const s = this._getStats();
                s.upc_blocked_until = Date.now() + 60 * 60 * 1000;
                this._saveStats(s);
                this._trackRequest('upc', false);
                return { found: false, error: 'UPCitemdb: Rate limit alcanzado (429). Bloqueado por 1 hora.' };
            }

            if (!resp.ok) {
                this._trackRequest('upc', false);
                return { found: false, error: `UPCitemdb: HTTP ${resp.status}` };
            }

            let data;
            try {
                data = await resp.json();
            } catch (parseErr) {
                this._trackRequest('upc', false);
                return { found: false, error: 'UPCitemdb: Respuesta no válida del servidor' };
            }

            this._trackRequest('upc', true);

            if (data.code !== 'OK' || !data.items || data.items.length === 0) {
                return { found: false };
            }

            const item = data.items[0];
            return {
                found: true,
                source: 'UPCitemdb',
                product: this._normalize(code, {
                    nombre: item.title || '',
                    marca: item.brand || '',
                    imagen: (item.images && item.images.length > 0) ? item.images[0] : null,
                    categoria: item.category || ''
                })
            };
        } catch (err) {
            this._trackRequest('upc', false);
            if (err.name === 'AbortError') {
                return { found: false, error: 'UPCitemdb: Timeout (>10s)' };
            }
            return { found: false, error: `UPCitemdb: ${err.message}` };
        }
    },

    // ── Cascade lookup ───────────────────────────────────────────
    async lookupProduct(barcode) {
        const code = String(barcode).trim();
        if (!/^\d{8,14}$/.test(code)) {
            return { success: false, error: 'Código de barras inválido. Debe tener entre 8 y 14 dígitos numéricos.' };
        }

        const log = [];
        const alerts = [];

        // Step 0: Local cache
        const cached = await this._cacheGet(code);
        if (cached) {
            log.push({ api: 'Cache Local', status: 'hit' });
            return {
                success: true,
                product: cached,
                source: 'Cache Local',
                log,
                alerts: this.getQuotaStatus().alerts
            };
        }
        log.push({ api: 'Cache Local', status: 'miss' });

        // Step 1: Open Food Facts
        const off = await this._queryOpenFoodFacts(code);
        if (off.found) {
            log.push({ api: 'Open Food Facts', status: 'found' });
            await this._cachePut(code, { ...off.product, _source: 'Open Food Facts' });
            return {
                success: true,
                product: off.product,
                source: 'Open Food Facts',
                log,
                alerts: this.getQuotaStatus().alerts
            };
        }
        log.push({ api: 'Open Food Facts', status: off.error || 'not found' });
        if (off.error) alerts.push({ level: 'warn', api: 'Open Food Facts', msg: off.error });

        // Step 2: UPCitemdb
        const upc = await this._queryUPCitemdb(code);
        if (upc.found) {
            log.push({ api: 'UPCitemdb', status: 'found' });
            await this._cachePut(code, { ...upc.product, _source: 'UPCitemdb' });
            return {
                success: true,
                product: upc.product,
                source: 'UPCitemdb',
                log,
                alerts: this.getQuotaStatus().alerts
            };
        }
        if (upc.skipped) {
            log.push({ api: 'UPCitemdb', status: 'skipped', detail: upc.reason });
        } else {
            log.push({ api: 'UPCitemdb', status: upc.error || 'not found' });
        }
        if (upc.error) alerts.push({ level: 'warn', api: 'UPCitemdb', msg: upc.error });
        if (upc.reason) alerts.push({ level: 'info', api: 'UPCitemdb', msg: upc.reason });

        // Step 3: Not found → trigger manual entry
        return {
            success: false,
            needsManualEntry: true,
            barcode: code,
            log,
            alerts: [...alerts, ...this.getQuotaStatus().alerts]
        };
    },

    // ── Save manual entry ────────────────────────────────────────
    async saveManualProduct(product) {
        const normalized = this._normalize(product.barcode, product);
        normalized._source = 'Manual';
        normalized._manual = true;
        await this._cachePut(product.barcode, normalized);
        this._trackRequest('manual', true);
        return normalized;
    },

    // ── Camera-based scanning (QuaggaJS) ─────────────────────────
    _onDetectedHandler: null,

    async startCamera(videoContainerId, onDetected) {
        if (typeof Quagga === 'undefined') {
            throw new Error('QuaggaJS no está cargado');
        }

        const target = document.getElementById(videoContainerId);
        if (!target) {
            throw new Error('Contenedor de cámara no encontrado: ' + videoContainerId);
        }

        // Clean up any previous handler
        if (this._onDetectedHandler) {
            try { Quagga.offDetected(this._onDetectedHandler); } catch (e) { /* ignore */ }
            this._onDetectedHandler = null;
        }

        return new Promise((resolve, reject) => {
            Quagga.init({
                inputStream: {
                    name: 'Live',
                    type: 'LiveStream',
                    target: target,
                    constraints: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                },
                decoder: {
                    readers: ['ean_reader', 'ean_8_reader', 'upc_reader']
                },
                locate: true,
                frequency: 10
            }, (err) => {
                if (err) return reject(err);
                Quagga.start();
                resolve();
            });

            let lastCode = null;
            let codeCount = 0;

            this._onDetectedHandler = (result) => {
                const code = result.codeResult.code;
                if (!code || code.length < 8) return;
                if (code === lastCode) {
                    codeCount++;
                } else {
                    lastCode = code;
                    codeCount = 1;
                }
                if (codeCount >= 3) {
                    codeCount = 0;
                    lastCode = null;
                    onDetected(code);
                }
            };

            Quagga.onDetected(this._onDetectedHandler);
        });
    },

    stopCamera() {
        if (typeof Quagga !== 'undefined') {
            try {
                if (this._onDetectedHandler) {
                    Quagga.offDetected(this._onDetectedHandler);
                    this._onDetectedHandler = null;
                }
                Quagga.stop();
            } catch (e) { /* ignore */ }
        }
    }
};
