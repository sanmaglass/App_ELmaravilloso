// Caja del Día — vista para trabajadoras
// Fondo de apertura + ventas + gastos caja chica + cuadre + facturas recientes
// Todo persiste en cash_register y el admin lo ve en Arqueo de Caja.
window.Views = window.Views || {};

(function () {
    const TZ = 'America/Santiago';
    const fmt = (n) => (window.formatCurrency ? window.formatCurrency(n) : '$' + Math.round(n).toLocaleString('es-CL'));
    const chileDate = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
    const chileTime = (d) => new Date(d).toLocaleTimeString('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
    const chileShortDate = (d) => new Date(d).toLocaleDateString('es-CL', { timeZone: TZ, day: '2-digit', month: 'short' });
    const userRef = () => window.state?.currentUser || window.Auth?.session?.user?.email || '';

    const PM = {
        'Efectivo':      { col: '#16a34a', icon: 'ph-money' },
        'Tarjeta':       { col: '#2563eb', icon: 'ph-credit-card' },
        'Transferencia': { col: '#7c3aed', icon: 'ph-bank' },
        'Crédito':       { col: '#d97706', icon: 'ph-notebook' },
        'Mixto':         { col: '#0891b2', icon: 'ph-arrows-split' },
    };
    const pmInfo = (k) => PM[k] || { col: '#64748b', icon: 'ph-receipt' };

    // ── Helpers DB (cash_register) ──
    async function loadByType(dia, type) {
        try {
            const all = await window.db.cash_register.toArray();
            return all.filter(r => !r.deleted && r.type === type && r.date === dia);
        } catch { return []; }
    }
    async function loadOne(dia, type) { return (await loadByType(dia, type))[0] || null; }

    async function saveRecord(dia, type, category, amount, description, extra = {}) {
        const existing = await loadOne(dia, type);
        const data = existing ? { ...existing } : {};
        Object.assign(data, { date: dia, type, category, amount, description, paymentMethod: 'Efectivo', reference: userRef(), deleted: false, ...extra });
        return window.DataManager.saveAndSync('cash_register', data);
    }

    async function saveGasto(dia, desc, amount) {
        const data = {
            date: dia, type: 'gasto_caja', category: 'caja_chica',
            amount: -Math.abs(amount), description: desc,
            paymentMethod: 'Efectivo', reference: userRef(), deleted: false
        };
        return window.DataManager.saveAndSync('cash_register', data);
    }

    async function deleteGasto(id) {
        return window.DataManager.deleteAndSync('cash_register', id);
    }

    // ── Cruce Mercado Pago (async, fire-and-forget render) ──
    async function fetchMPCuadre(dia) {
        try {
            const token = window.Auth?.session?.access_token || '';
            const res = await fetch(`/api/mp-cuadre?date=${dia}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return null;
            return await res.json();
        } catch { return null; }
    }

    function renderMPCard(data, isEmp) {
        const wrap = (content) => `
            <div style="background:var(--bg-card); border:1px solid var(--border); border-left:4px solid #6366f1; border-radius:14px; padding:16px; margin-bottom:20px;" id="mp-cruce-card">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                    <i class="ph-fill ph-credit-card" style="color:#6366f1; font-size:1.2rem;"></i>
                    <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">Cruce Mercado Pago</span>
                </div>
                ${content}
            </div>`;

        if (!data) {
            return wrap(`<p style="color:var(--text-muted); font-size:0.82rem; margin:0;">Cruce MP no disponible</p>`);
        }

        if (isEmp) {
            // Cajera: solo badges, sin montos
            const badge = (label, status) => {
                const ok = status === 'ok';
                const col = ok ? '#16a34a' : '#d97706';
                const bg = ok ? '#16a34a18' : '#d9770618';
                const icon = ok ? 'ph-check-circle' : 'ph-warning';
                const txt = ok ? `${label} ✓ cuadran` : `${label} ⚠ avísale al admin`;
                return `<div style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:${bg}; border-radius:8px; margin:4px 4px 4px 0;">
                    <i class="ph-fill ${icon}" style="color:${col}; font-size:1rem;"></i>
                    <span style="font-size:0.82rem; font-weight:600; color:${col};">${txt}</span>
                </div>`;
            };
            return wrap(`
                <div style="display:flex; flex-wrap:wrap; gap:4px;">
                    ${badge('Tarjetas', data.status?.tarjeta)}
                    ${badge('Transferencia', data.status?.transferencia)}
                </div>`);
        }

        // Admin: montos completos
        const { mp = {}, eleventa = {}, diff = {}, alerts = {} } = data;

        const fila = (label, elMonto, mpMonto, diffVal, alerta, desglose) => {
            const ok = !alerta;
            const absDiff = Math.abs(diffVal || 0);
            const badgeCol = ok ? '#16a34a' : (diffVal < 0 ? '#ef4444' : '#d97706');
            const badgeBg = ok ? '#16a34a18' : (diffVal < 0 ? '#ef444418' : '#d9770618');
            const badgeIcon = ok ? 'ph-check-circle' : 'ph-warning';
            const badgeTxt = ok
                ? '✓'
                : (diffVal < 0 ? `faltan ${fmt(absDiff)}` : `sobran ${fmt(absDiff)}`);
            return `
                <div style="padding:10px 0; border-bottom:1px solid var(--border);">
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                        <span style="font-weight:600; font-size:0.88rem; color:var(--text-primary);">${label}</span>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-size:0.82rem; color:var(--text-muted);">Sistema <b style="color:var(--text-primary);">${fmt(elMonto)}</b></span>
                            <span style="font-size:0.78rem; color:var(--text-muted);">vs MP</span>
                            <span style="font-size:0.82rem; color:var(--text-muted);"><b style="color:var(--text-primary);">${fmt(mpMonto)}</b></span>
                            <span style="display:inline-flex; align-items:center; gap:4px; padding:3px 9px; background:${badgeBg}; border-radius:6px; font-size:0.78rem; font-weight:700; color:${badgeCol};">
                                <i class="ph-fill ${badgeIcon}" style="font-size:0.9rem;"></i> ${badgeTxt}
                            </span>
                        </div>
                    </div>
                    ${desglose ? `<div style="color:var(--text-muted); font-size:0.74rem; margin-top:4px;">${desglose}</div>` : ''}
                </div>`;
        };

        const desgloseTarjeta = `Débito ${fmt(mp.debito || 0)} · Crédito ${fmt(mp.credito || 0)}`;

        const notaCredito = (eleventa.credito || 0) > 0
            ? `<div style="margin-top:8px; padding:7px 10px; background:#d9770610; border-radius:8px; font-size:0.76rem; color:#d97706;">
                <i class="ph ph-notebook" style="vertical-align:-2px;"></i>
                Crédito (fiado) <b>${fmt(eleventa.credito)}</b> — no es pago, no entra al cruce
               </div>` : '';

        const notaMixto = (eleventa.mixto || 0) > 0
            ? `<div style="margin-top:6px; padding:7px 10px; background:#0891b210; border-radius:8px; font-size:0.76rem; color:#0891b2;">
                <i class="ph ph-arrows-split" style="vertical-align:-2px;"></i>
                Mixto <b>${fmt(eleventa.mixto)}</b> sin desglosar — revisar manualmente
               </div>` : '';

        return wrap(`
            ${fila('TARJETAS', eleventa.tarjeta || 0, mp.totalTarjetas || 0, diff.tarjeta, alerts.tarjeta, desgloseTarjeta)}
            ${fila('TRANSFERENCIA', eleventa.transferencia || 0, mp.transferencia || 0, diff.transferencia, alerts.transferencia, '')}
            ${notaCredito}
            ${notaMixto}
        `);
    }

    // ── Facturas (read-only, employee sin montos) ──
    async function renderFacturas() {
        const isEmp = !!window._isEmployee;
        try {
            const all = await window.db.purchase_invoices.toArray();
            const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
            const recientes = all
                .filter(f => !f.deleted && (parseFloat(f.amount) || 0) > 0 && new Date(f.date) >= cutoff)
                .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

            if (!recientes.length) return `
                <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; padding:24px 20px; text-align:center;">
                    <i class="ph ph-package" style="font-size:2.2rem; color:var(--text-muted); opacity:0.5;"></i>
                    <h3 style="color:var(--text-primary); margin:10px 0 4px; font-size:1rem;">Sin facturas recientes</h3>
                    <p style="color:var(--text-muted); font-size:0.82rem; margin:0;">Cuando lleguen facturas, aparecerán aquí.</p>
                </div>`;

            const sc = { 'Pendiente': '#ef4444', 'Crédito': '#d97706', 'Abonado': '#f59e0b', 'Pagado': '#16a34a' };
            const items = recientes.map(f => {
                const col = sc[f.paymentStatus] || '#64748b';
                return `<div style="display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border-bottom:1px solid var(--border); gap:8px;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; color:var(--text-primary); font-size:0.88rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.supplierName || 'Proveedor'}</div>
                        <div style="display:flex; gap:8px; align-items:center; margin-top:2px;">
                            <span style="color:var(--text-muted); font-size:0.75rem;">${chileShortDate(f.date)}</span>
                            ${f.invoiceNumber ? `<span style="color:var(--text-muted); font-size:0.75rem;">#${f.invoiceNumber}</span>` : ''}
                            <span style="font-size:0.7rem; font-weight:600; color:${col}; background:${col}18; padding:1px 7px; border-radius:6px;">${f.paymentStatus || 'Pendiente'}</span>
                        </div>
                    </div>
                    ${!isEmp ? `<span style="font-weight:700; color:var(--text-primary); font-variant-numeric:tabular-nums; font-size:0.92rem;">${fmt(parseFloat(f.amount) || 0)}</span>` : ''}
                </div>`;
            }).join('');

            const hdr = isEmp
                ? `${recientes.length} factura${recientes.length !== 1 ? 's' : ''}`
                : `${recientes.length} · ${fmt(recientes.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0))}`;

            return `<div style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; overflow:hidden;">
                <div style="padding:14px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--text-primary); font-size:1.05rem;">Facturas recientes</h3>
                    <span style="color:var(--text-muted); font-size:0.82rem;">${hdr}</span>
                </div>${items}</div>`;
        } catch { return ''; }
    }

    // ══════════════════════════════════════════════════════════════
    // VISTA PRINCIPAL
    // ══════════════════════════════════════════════════════════════
    window.Views.caja_dia = async (container) => {
        const today = chileDate(new Date());
        const isEmp = !!window._isEmployee;

        container.innerHTML = `
          <div style="max-width:680px; margin:0 auto; padding:0 16px 32px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
                <div>
                    <div style="font-size:0.8rem; color:var(--primary); font-weight:bold; letter-spacing:1px; text-transform:uppercase;">El Maravilloso</div>
                    <h1 style="margin:4px 0 4px; color:var(--text-primary);">Caja del Día</h1>
                    <p style="color:var(--text-muted); font-size:0.9rem; margin:0;">Fondo, ventas, gastos y cuadre</p>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${isEmp ? '' : `<input type="date" id="caja-fecha" value="${today}" max="${today}"
                        style="padding:9px 12px; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; color:var(--text-primary); font:inherit;">`}
                    <button id="caja-refresh" class="btn btn-secondary" style="padding:9px 12px; display:inline-flex; align-items:center; gap:6px;">
                        <i class="ph ph-arrows-clockwise"></i>
                    </button>
                </div>
            </div>
            <div id="caja-body"></div>
          </div>`;

        const body = container.querySelector('#caja-body');
        const fechaInput = container.querySelector('#caja-fecha');

        async function render() {
            const dia = isEmp ? today : (fechaInput?.value || today);
            const esHoy = dia === today;

            // ── Datos ──
            let sales = [];
            try {
                const all = await window.db.eleventa_sales.toArray();
                sales = all.filter(s => !s.deleted && (parseFloat(s.total) || 0) > 0 && chileDate(s.date) === dia);
            } catch { body.innerHTML = `<p style="color:var(--danger);">No se pudieron cargar las ventas.</p>`; return; }
            sales.sort((a, b) => new Date(b.date) - new Date(a.date));

            const grupos = {};
            let totalVentas = 0;
            for (const s of sales) {
                const m = parseFloat(s.total) || 0;
                const fp = s.forma_pago || 'Efectivo';
                if (!grupos[fp]) grupos[fp] = { monto: 0, n: 0 };
                grupos[fp].monto += m; grupos[fp].n++; totalVentas += m;
            }
            const nTickets = sales.length;
            const efectivoVentas = (grupos['Efectivo'] || {}).monto || 0;

            const fondo = await loadOne(dia, 'fondo_apertura');
            const fondoMonto = fondo ? (parseFloat(fondo.amount) || 0) : 0;
            const gastos = await loadByType(dia, 'gasto_caja');
            const totalGastos = gastos.reduce((s, g) => s + Math.abs(parseFloat(g.amount) || 0), 0);
            const cuadre = await loadOne(dia, 'cuadre');

            // Efectivo esperado = fondo + ventas efectivo - gastos caja chica
            const efectivoEsperado = fondoMonto + efectivoVentas - totalGastos;

            const orden = ['Efectivo', 'Tarjeta', 'Transferencia', 'Crédito', 'Mixto'];
            const formas = orden.filter(k => grupos[k]).concat(Object.keys(grupos).filter(k => !orden.includes(k)));

            const facturasHTML = await renderFacturas();

            // ── Cards formas de pago ──
            const fpCards = formas.map(fp => {
                const g = grupos[fp]; const info = pmInfo(fp);
                return `<div style="flex:1; min-width:120px; background:var(--bg-card); border:1px solid var(--border); border-left:4px solid ${info.col}; border-radius:14px; padding:14px 16px;">
                    <div style="display:flex; align-items:center; gap:7px; color:var(--text-muted); font-size:0.82rem; font-weight:600;">
                        <i class="ph-fill ${info.icon}" style="font-size:1.05rem;"></i> ${fp}
                    </div>
                    <div style="font-size:1.7rem; font-weight:800; color:${info.col}; margin-top:6px; line-height:1;">${fmt(g.monto)}</div>
                    <div style="color:var(--text-muted); font-size:0.78rem; margin-top:4px;">${g.n} venta${g.n !== 1 ? 's' : ''}</div>
                </div>`;
            }).join('');

            // ── Gastos caja chica list ──
            const gastosListHTML = gastos.length ? gastos.map(g => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);">
                    <span style="font-size:0.85rem; color:var(--text-primary);">${window.escapeHTML ? window.escapeHTML(g.description) : g.description}</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${isEmp ? '' : `<span style="font-weight:700; color:#ef4444; font-size:0.88rem;">-${fmt(Math.abs(g.amount))}</span>`}
                        ${esHoy && !isEmp ? `<button class="btn-del-gasto" data-id="${g.id}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:2px 4px; font-size:0.9rem;" title="Eliminar"><i class="ph ph-x-circle"></i></button>` : ''}
                    </div>
                </div>
            `).join('') : '<p style="color:var(--text-muted); font-size:0.82rem; margin:4px 0;">Sin gastos registrados.</p>';

            // ── Cuadre badge ──
            const cuadreBadge = cuadre
                ? `<div style="display:flex; align-items:center; gap:6px; padding:8px 12px; background:#16a34a18; border-radius:8px; margin-top:12px;">
                        <i class="ph-fill ph-check-circle" style="color:#16a34a; font-size:1.1rem;"></i>
                        <span style="color:#16a34a; font-size:0.82rem; font-weight:600;">Cuadre guardado${isEmp ? '' : ': ' + fmt(cuadre.amount)} — ${cuadre.notes || ''}</span>
                   </div>` : '';

            // ── Lista de ventas (5 iniciales + ver más) ──
            const VENTAS_INIT = 5;
            const ventaRow = (s) => {
                const info = pmInfo(s.forma_pago || 'Efectivo');
                return `<div style="display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border-bottom:1px solid var(--border);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:0.85rem; color:var(--text-muted); font-variant-numeric:tabular-nums;">${chileTime(s.date)}</span>
                        <span style="font-size:0.72rem; padding:2px 8px; border-radius:6px; font-weight:600; background:${info.col}14; color:${info.col};">${s.forma_pago || 'Efectivo'}</span>
                    </div>
                    <span style="font-weight:700; color:var(--text-primary); font-variant-numeric:tabular-nums;">${fmt(parseFloat(s.total) || 0)}</span>
                </div>`;
            };
            const listaVentas = sales.slice(0, VENTAS_INIT).map(ventaRow).join('');
            const ventasRestantes = sales.length > VENTAS_INIT ? sales.slice(VENTAS_INIT) : [];
            const verMasHTML = ventasRestantes.length > 0
                ? `<div id="ventas-extra" style="display:none;">${ventasRestantes.map(ventaRow).join('')}</div>
                   <button id="btn-ver-mas-ventas" style="width:100%; padding:12px; background:none; border:none; border-top:1px solid var(--border); color:var(--primary); font-weight:600; font-size:0.88rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                       <i class="ph ph-caret-down"></i> Ver ${ventasRestantes.length} venta${ventasRestantes.length !== 1 ? 's' : ''} más
                   </button>`
                : '';

            // ═══════════════════════ RENDER HTML ═══════════════════════
            body.innerHTML = `
                <!-- ── FONDO DE APERTURA ── (solo admin ve el monto, cajera solo registra) -->
                <div style="background:var(--bg-card); border:1px solid var(--border); border-left:4px solid #f59e0b; border-radius:14px; padding:16px; margin-bottom:16px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="ph-fill ph-vault" style="color:#f59e0b; font-size:1.2rem;"></i>
                            <span style="font-weight:700; font-size:0.92rem; color:var(--text-primary);">Fondo de apertura</span>
                        </div>
                        ${esHoy ? `
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="number" id="fondo-input" placeholder="0" inputmode="numeric" value="${isEmp ? '' : (fondoMonto || '')}"
                                style="width:120px; padding:8px 10px; background:var(--bg-input, var(--bg-secondary)); border:1px solid var(--border); border-radius:8px; color:var(--text-primary); font:inherit; font-size:0.95rem; box-sizing:border-box;">
                            <button id="btn-guardar-fondo" class="btn btn-secondary" style="padding:8px 14px; font-size:0.82rem;">
                                <i class="ph ph-floppy-disk"></i> ${fondo ? 'Actualizar' : 'Guardar'}
                            </button>
                        </div>` : `
                        <span style="font-size:1.3rem; font-weight:800; color:#f59e0b;">${isEmp ? (fondo ? '✓' : '—') : (fondoMonto ? fmt(fondoMonto) : '—')}</span>`}
                    </div>
                    ${fondo ? `<span style="font-size:0.72rem; color:var(--text-muted); margin-top:4px; display:block;">Registrado${isEmp ? '' : ': ' + fmt(fondoMonto)}${fondo.reference ? ` por ${fondo.reference.split('@')[0]}` : ''}${fondo.updated_at_hlc ? ` · ${new Date(Math.floor(fondo.updated_at_hlc / 1e6)).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })}` : ''}</span>` : ''}
                </div>

                ${nTickets > 0 ? (isEmp ? `
                <!-- ── RESUMEN VENTAS (cajera: solo cantidad, sin montos) ── -->
                <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:14px; padding:16px; margin-bottom:16px; text-align:center;">
                    <i class="ph-fill ph-receipt" style="font-size:1.5rem; color:var(--primary); margin-bottom:6px;"></i>
                    <div style="font-size:1.4rem; font-weight:800; color:var(--text-primary);">${nTickets}</div>
                    <div style="font-size:0.82rem; color:var(--text-muted);">venta${nTickets !== 1 ? 's' : ''} registrada${nTickets !== 1 ? 's' : ''} hoy</div>
                </div>` : `
                <!-- ── RESUMEN VENTAS (admin: montos completos) ── -->
                <div style="display:flex; gap:14px; flex-wrap:wrap; margin-bottom:16px;">
                    <div style="flex:2; min-width:200px; background:linear-gradient(135deg, var(--primary), #c0392b); border-radius:16px; padding:18px 22px; color:#fff;">
                        <div style="font-size:0.82rem; opacity:0.9; text-transform:uppercase; letter-spacing:0.5px;">Total ventas</div>
                        <div style="font-size:2.2rem; font-weight:800; margin-top:4px; line-height:1;">${fmt(totalVentas)}</div>
                        <div style="font-size:0.82rem; opacity:0.9; margin-top:6px;">${nTickets} ventas · promedio ${fmt(totalVentas / nTickets)}</div>
                    </div>
                </div>
                <div style="display:flex; gap:14px; flex-wrap:wrap; margin-bottom:20px;">${fpCards}</div>`) : `
                <div style="text-align:center; padding:30px 20px; background:var(--bg-card); border:1px solid var(--border); border-radius:16px; margin-bottom:16px;">
                    <i class="ph ph-receipt-x" style="font-size:2.5rem; color:var(--text-muted); opacity:0.5;"></i>
                    <p style="color:var(--text-muted); margin:10px 0 0; font-size:0.9rem;">Sin ventas ${esHoy ? 'todavía hoy' : 'ese día'}</p>
                </div>`}

                <!-- ── GASTOS CAJA CHICA ── -->
                <div style="background:var(--bg-card); border:1px solid var(--border); border-left:4px solid #ef4444; border-radius:14px; padding:16px; margin-bottom:16px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="ph-fill ph-coins" style="color:#ef4444; font-size:1.1rem;"></i>
                            <span style="font-weight:700; font-size:0.92rem; color:var(--text-primary);">Gastos caja chica</span>
                        </div>
                        <span style="font-weight:700; color:#ef4444; font-size:0.95rem;">${isEmp ? `${gastos.length} gasto${gastos.length !== 1 ? 's' : ''}` : (totalGastos > 0 ? '-' + fmt(totalGastos) : '$0')}</span>
                    </div>
                    ${gastosListHTML}
                    ${esHoy ? `
                    <div id="gasto-form" style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; align-items:flex-end;">
                        <input type="text" id="gasto-desc" placeholder="Ej: Artículos de limpieza" maxlength="80"
                            style="flex:2; min-width:140px; padding:8px 10px; background:var(--bg-input, var(--bg-secondary)); border:1px solid var(--border); border-radius:8px; color:var(--text-primary); font:inherit; font-size:0.88rem; box-sizing:border-box;">
                        <input type="number" id="gasto-monto" placeholder="$" inputmode="numeric"
                            style="width:90px; padding:8px 10px; background:var(--bg-input, var(--bg-secondary)); border:1px solid var(--border); border-radius:8px; color:var(--text-primary); font:inherit; font-size:0.88rem; box-sizing:border-box;">
                        <button id="btn-add-gasto" class="btn btn-secondary" style="padding:8px 14px; font-size:0.82rem; white-space:nowrap;">
                            <i class="ph ph-plus"></i> Agregar
                        </button>
                    </div>` : ''}
                </div>

                <!-- ── CUADRE DE EFECTIVO ── -->
                <div style="background:var(--bg-card); border:1px solid var(--border); border-left:4px solid #16a34a; border-radius:14px; padding:16px; margin-bottom:20px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                        <i class="ph-fill ph-scales" style="color:#16a34a; font-size:1.1rem;"></i>
                        <span style="font-weight:700; font-size:0.92rem; color:var(--text-primary);">Cuadre de efectivo</span>
                    </div>
                    <!-- Resumen del esperado (solo admin) -->
                    ${isEmp ? `
                    <div style="margin-bottom:14px;">
                        <div style="font-size:0.92rem; color:var(--text-muted);">
                            Cuenta cuánto efectivo hay en caja
                        </div>
                    </div>` : `
                    <div style="margin-bottom:14px;">
                        <div style="font-size:1.15rem; font-weight:800; color:var(--text-primary); margin-bottom:6px;">
                            Esperado: ${fmt(efectivoEsperado)}
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:0.78rem; color:var(--text-muted);">
                            <span>Fondo ${fmt(fondoMonto)}</span>
                            <span>+ Efectivo ${fmt(efectivoVentas)}</span>
                            <span>- Gastos ${fmt(totalGastos)}</span>
                        </div>
                    </div>`}
                    ${esHoy ? `
                    <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:flex-end;">
                        <div>
                            <label style="color:var(--text-muted); font-size:0.78rem; display:block; margin-bottom:4px;">¿Cuánto contaste? ($)</label>
                            <input type="number" id="caja-contado" placeholder="0" inputmode="numeric"
                                value="${cuadre ? cuadre.amount : ''}"
                                style="width:140px; padding:11px 13px; background:var(--bg-input, var(--bg-secondary)); border:1px solid var(--border); border-radius:10px; color:var(--text-primary); font:inherit; font-size:1.05rem; box-sizing:border-box;">
                        </div>
                        <div id="caja-dif" style="font-weight:700; font-size:1.05rem; padding-bottom:10px;"></div>
                    </div>
                    <!-- ── CONTADOR POR DENOMINACIÓN ── -->
                    <div style="margin-top:14px;">
                        <button id="btn-toggle-denom" style="background:none; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:5px; color:var(--text-muted); font-size:0.8rem; font-weight:600; padding:4px 0;">
                            <i class="ph ph-caret-right" id="denom-caret" style="transition:transform 0.2s;"></i>
                            Contar por denominación
                        </button>
                        <div id="denom-panel" style="display:none; margin-top:10px; padding:14px; background:var(--bg-secondary,var(--bg-card)); border:1px solid var(--border); border-radius:12px;">
                            <div style="font-size:0.76rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">Billetes</div>
                            <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; margin-bottom:12px;">
                                ${[20000,10000,5000,2000,1000].map(d => `
                                <div style="display:flex; align-items:center; gap:7px; background:var(--bg-card); border:1px solid var(--border); border-radius:9px; padding:7px 10px;">
                                    <span style="font-size:0.78rem; color:var(--text-muted); font-weight:600; min-width:42px;">${d >= 1000 ? '$'+(d/1000)+'k' : '$'+d}</span>
                                    <input type="number" class="denom-input" data-val="${d}" placeholder="0" min="0" inputmode="numeric"
                                        style="width:50px; padding:5px 7px; background:var(--bg-input,var(--bg-secondary)); border:1px solid var(--border); border-radius:7px; color:var(--text-primary); font:inherit; font-size:0.88rem; box-sizing:border-box; text-align:right;">
                                    <span style="font-size:0.7rem; color:var(--text-muted);">uds</span>
                                </div>`).join('')}
                            </div>
                            <div style="font-size:0.76rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">Monedas</div>
                            <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; margin-bottom:12px;">
                                ${[500,100,50,10].map(d => `
                                <div style="display:flex; align-items:center; gap:7px; background:var(--bg-card); border:1px solid var(--border); border-radius:9px; padding:7px 10px;">
                                    <span style="font-size:0.78rem; color:var(--text-muted); font-weight:600; min-width:42px;">$${d}</span>
                                    <input type="number" class="denom-input" data-val="${d}" placeholder="0" min="0" inputmode="numeric"
                                        style="width:50px; padding:5px 7px; background:var(--bg-input,var(--bg-secondary)); border:1px solid var(--border); border-radius:7px; color:var(--text-primary); font:inherit; font-size:0.88rem; box-sizing:border-box; text-align:right;">
                                    <span style="font-size:0.7rem; color:var(--text-muted);">uds</span>
                                </div>`).join('')}
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid var(--border);">
                                <span style="font-size:0.82rem; color:var(--text-muted);">Total calculado:</span>
                                <span id="denom-total" style="font-size:1.1rem; font-weight:800; color:var(--text-primary);">$0</span>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; margin-top:14px; flex-wrap:wrap;">
                        <button id="btn-guardar-cuadre" class="btn btn-primary" style="padding:10px 20px; display:inline-flex; align-items:center; gap:6px; font-weight:600;">
                            <i class="ph ph-floppy-disk"></i> Guardar Cuadre
                        </button>
                        <span id="cuadre-status" style="font-size:0.82rem; color:var(--text-muted);"></span>
                    </div>
                    ${cuadreBadge}` : `
                    ${cuadre
                        ? `<div style="display:flex; align-items:center; gap:6px; padding:8px 12px; background:#16a34a18; border-radius:8px;">
                                <i class="ph-fill ph-check-circle" style="color:#16a34a; font-size:1.1rem;"></i>
                                <span style="color:#16a34a; font-size:0.82rem; font-weight:600;">Cuadre: ${fmt(cuadre.amount)} — ${cuadre.notes}</span>
                           </div>`
                        : `<p style="color:var(--text-muted); font-size:0.82rem;">No se registró cuadre este día.</p>`}
                    <p style="color:var(--text-muted); font-size:0.72rem; margin:8px 0 0;">Solo puedes cuadrar el día de hoy.</p>`}
                </div>

                <!-- ── CRUCE MERCADO PAGO (se rellena async) ── -->
                <div id="mp-cruce-placeholder">
                    <div style="background:var(--bg-card); border:1px solid var(--border); border-left:4px solid #6366f1; border-radius:14px; padding:16px; margin-bottom:20px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                            <i class="ph-fill ph-credit-card" style="color:#6366f1; font-size:1.2rem;"></i>
                            <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">Cruce Mercado Pago</span>
                        </div>
                        <p style="color:var(--text-muted); font-size:0.82rem; margin:0; display:flex; align-items:center; gap:6px;">
                            <i class="ph ph-spinner ph-spin"></i> Cargando cruce…
                        </p>
                    </div>
                </div>

                ${!isEmp && nTickets > 0 ? `
                <!-- ── VENTAS DEL DÍA (solo admin) ── -->
                <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; overflow:hidden; margin-bottom:20px;">
                    <div style="padding:14px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="ph-fill ph-receipt" style="color:var(--primary); font-size:1.1rem;"></i>
                            <h3 style="margin:0; color:var(--text-primary); font-size:1.05rem;">Ventas del día</h3>
                        </div>
                        <span style="color:var(--text-muted); font-size:0.82rem;">${nTickets} ticket${nTickets !== 1 ? 's' : ''}</span>
                    </div>
                    ${listaVentas}
                    ${verMasHTML}
                </div>` : ''}

                ${!isEmp ? `
                <!-- ── FACTURAS (solo admin) ── -->
                <div style="margin-top:8px;">
                    <h2 style="font-size:1.1rem; color:var(--text-primary); margin:0 0 12px; display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-receipt" style="color:var(--primary);"></i> Facturas de Proveedores
                    </h2>
                    ${facturasHTML}
                </div>` : ''}
            `;

            // ═══════════════ EVENT LISTENERS ═══════════════

            // ── Fondo de apertura ──
            const btnFondo = body.querySelector('#btn-guardar-fondo');
            if (btnFondo) {
                btnFondo.addEventListener('click', async () => {
                    const v = parseFloat(body.querySelector('#fondo-input')?.value);
                    if (isNaN(v) || v < 0) { window.showToast?.('Monto inválido'); return; }
                    btnFondo.disabled = true;
                    try {
                        const res = await saveRecord(dia, 'fondo_apertura', 'apertura', v, `Fondo apertura: ${fmt(v)}`);
                        if (res && res.success === false) {
                            window.showToast?.('No se pudo guardar el fondo, intenta de nuevo');
                        } else {
                            window.showToast?.('Fondo guardado');
                        }
                        await render();
                    } catch (e) {
                        console.error('[caja] Error guardando fondo:', e);
                        window.showToast?.('No se pudo guardar el fondo, intenta de nuevo');
                    } finally {
                        btnFondo.disabled = false;
                    }
                });
            }

            // ── Agregar gasto ──
            const btnGasto = body.querySelector('#btn-add-gasto');
            if (btnGasto) {
                btnGasto.addEventListener('click', async () => {
                    const desc = body.querySelector('#gasto-desc')?.value.trim();
                    const monto = parseFloat(body.querySelector('#gasto-monto')?.value);
                    if (!desc) { window.showToast?.('Describe el gasto'); return; }
                    if (isNaN(monto) || monto <= 0) { window.showToast?.('Monto inválido'); return; }
                    btnGasto.disabled = true;
                    try {
                        const res = await saveGasto(dia, desc, monto);
                        if (res && res.success === false) {
                            window.showToast?.('No se pudo registrar el gasto, intenta de nuevo');
                        } else {
                            window.showToast?.('Gasto registrado');
                        }
                        await render();
                    } catch (e) {
                        console.error('[caja] Error guardando gasto:', e);
                        window.showToast?.('No se pudo registrar el gasto, intenta de nuevo');
                    } finally {
                        btnGasto.disabled = false;
                    }
                });
            }

            // ── Eliminar gasto ──
            body.querySelectorAll('.btn-del-gasto').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const ok = await window.showConfirmDialog('Eliminar gasto', '¿Eliminar este gasto de caja chica?');
                    if (!ok) return;
                    await deleteGasto(btn.dataset.id);
                    render();
                });
            });

            // ── Contador por denominación ──
            const btnToggleDenom = body.querySelector('#btn-toggle-denom');
            const denomPanel = body.querySelector('#denom-panel');
            const denomCaret = body.querySelector('#denom-caret');
            const denomTotalEl = body.querySelector('#denom-total');
            if (btnToggleDenom && denomPanel) {
                btnToggleDenom.addEventListener('click', () => {
                    const open = denomPanel.style.display !== 'none';
                    denomPanel.style.display = open ? 'none' : 'block';
                    if (denomCaret) denomCaret.style.transform = open ? '' : 'rotate(90deg)';
                });
                denomPanel.querySelectorAll('.denom-input').forEach(inp => {
                    inp.addEventListener('input', () => {
                        let total = 0;
                        denomPanel.querySelectorAll('.denom-input').forEach(i => {
                            const qty = parseInt(i.value, 10) || 0;
                            total += qty * parseInt(i.dataset.val, 10);
                        });
                        if (denomTotalEl) denomTotalEl.textContent = fmt(total);
                        const contadoInp = body.querySelector('#caja-contado');
                        if (contadoInp) {
                            contadoInp.value = total || '';
                            contadoInp.dispatchEvent(new Event('input'));
                        }
                    });
                });
            }

            // ── Ver más ventas ──
            const btnVerMas = body.querySelector('#btn-ver-mas-ventas');
            if (btnVerMas) {
                btnVerMas.addEventListener('click', () => {
                    const extra = body.querySelector('#ventas-extra');
                    if (extra) {
                        const showing = extra.style.display !== 'none';
                        extra.style.display = showing ? 'none' : 'block';
                        btnVerMas.innerHTML = showing
                            ? `<i class="ph ph-caret-down"></i> Ver ${ventasRestantes.length} venta${ventasRestantes.length !== 1 ? 's' : ''} más`
                            : `<i class="ph ph-caret-up"></i> Ocultar`;
                    }
                });
            }

            // ── Cuadre interactivo ──
            const contado = body.querySelector('#caja-contado');
            const difEl = body.querySelector('#caja-dif');
            const btnCuadre = body.querySelector('#btn-guardar-cuadre');
            const statusEl = body.querySelector('#cuadre-status');

            function updateDif() {
                if (!contado || !difEl) return;
                const v = parseFloat(contado.value);
                if (isNaN(v)) { difEl.textContent = ''; return; }
                const dif = v - efectivoEsperado;
                if (isEmp) {
                    // Cajera solo ve si cuadra o no, sin montos
                    if (Math.abs(dif) < 1) { difEl.textContent = '✓ Cuadra'; difEl.style.color = '#16a34a'; }
                    else { difEl.textContent = '⚠ No cuadra'; difEl.style.color = 'var(--danger)'; }
                } else {
                    if (Math.abs(dif) < 1) { difEl.textContent = '✓ Cuadra'; difEl.style.color = '#16a34a'; }
                    else if (dif > 0) { difEl.innerHTML = `Sobra ${fmt(dif)}`; difEl.style.color = '#d97706'; }
                    else { difEl.innerHTML = `Falta ${fmt(-dif)}`; difEl.style.color = 'var(--danger)'; }
                }
            }

            if (contado) {
                contado.addEventListener('input', updateDif);
                if (cuadre) updateDif();
            }

            // ── Cruce MP (async, rellena el placeholder) ──
            fetchMPCuadre(dia).then(data => {
                const placeholder = body.querySelector('#mp-cruce-placeholder');
                if (!placeholder) return;
                placeholder.outerHTML = renderMPCard(data, isEmp);
            });

            if (btnCuadre) {
                btnCuadre.addEventListener('click', async () => {
                    const v = parseFloat(contado?.value);
                    if (isNaN(v) || v < 0) { if (statusEl) { statusEl.textContent = 'Monto inválido'; statusEl.style.color = 'var(--danger)'; } return; }
                    btnCuadre.disabled = true;
                    btnCuadre.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
                    const dif = v - efectivoEsperado;
                    const notes = Math.abs(dif) < 1 ? 'Cuadra perfecto' : (dif > 0 ? `Sobra ${fmt(dif)}` : `Falta ${fmt(-dif)}`);
                    const desc = isEmp
                        ? `Contado: ${fmt(v)} | ${Math.abs(dif) < 1 ? 'Cuadra' : 'No cuadra'}`
                        : `Contado: ${fmt(v)} | Esperado: ${fmt(efectivoEsperado)} | Dif: ${fmt(dif)}`;
                    const result = await saveRecord(dia, 'cuadre', 'cierre_cajera', v, desc, { notes });
                    if (result.success) {
                        btnCuadre.innerHTML = '<i class="ph-fill ph-check-circle"></i> Guardado';
                        btnCuadre.style.background = '#16a34a';
                        if (statusEl) { statusEl.textContent = 'El admin puede ver este cuadre'; statusEl.style.color = '#16a34a'; }
                        // Notificación fire-and-forget — no bloquea UI
                        fetch('/api/notify?job=cuadre', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (window.Auth?.session?.access_token || '') }, body: JSON.stringify({ date: dia }) }).catch(() => {});
                        setTimeout(() => { btnCuadre.disabled = false; btnCuadre.innerHTML = '<i class="ph ph-floppy-disk"></i> Actualizar'; btnCuadre.style.background = ''; }, 2000);
                    } else {
                        btnCuadre.disabled = false;
                        btnCuadre.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar Cuadre';
                        if (statusEl) { statusEl.textContent = 'Error — se reintentará'; statusEl.style.color = 'var(--danger)'; }
                    }
                });
            }
        }

        await render();
        if (fechaInput) fechaInput.addEventListener('change', render);
        container.querySelector('#caja-refresh').addEventListener('click', render);
        const iv = setInterval(render, 60000);
        window._viewCleanup = () => clearInterval(iv);
    };
})();
