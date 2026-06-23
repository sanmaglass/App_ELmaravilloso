// Caja del Día — vista simple para trabajadoras (cuadrar caja)
// Lee eleventa_sales (sincronizado en vivo desde Eleventa). NO muestra ganancias/márgenes.
window.Views = window.Views || {};

(function () {
    const TZ = 'America/Santiago';
    const fmt = (n) => (window.formatCurrency ? window.formatCurrency(n) : '$' + Math.round(n).toLocaleString('es-CL'));
    const chileDate = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });        // YYYY-MM-DD
    const chileTime = (d) => new Date(d).toLocaleTimeString('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

    // Etiqueta + ícono + color por forma de pago
    const PM = {
        'Efectivo':      { ic: 'ph-money',        col: '#16a34a', emoji: '💵' },
        'Tarjeta':       { ic: 'ph-credit-card',  col: '#2563eb', emoji: '💳' },
        'Transferencia': { ic: 'ph-bank',         col: '#7c3aed', emoji: '🏦' },
        'Crédito':       { ic: 'ph-notebook',     col: '#d97706', emoji: '📒' },
        'Mixto':         { ic: 'ph-shuffle',      col: '#0891b2', emoji: '🔀' },
    };
    const pmInfo = (k) => PM[k] || { ic: 'ph-receipt', col: '#64748b', emoji: '🧾' };

    window.Views.caja_dia = async (container) => {
        const today = chileDate(new Date());

        container.innerHTML = `
          <div style="max-width:680px; margin:0 auto; padding:0 16px 32px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
                <div>
                    <div style="font-size:0.8rem; color:var(--primary); font-weight:bold; letter-spacing:1px; text-transform:uppercase;">El Maravilloso</div>
                    <h1 style="margin:4px 0 4px; color:var(--text-primary);">Caja del Día</h1>
                    <p style="color:var(--text-muted); font-size:0.9rem; margin:0;">Ventas en efectivo y tarjeta para cuadrar la caja</p>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <input type="date" id="caja-fecha" value="${today}" max="${today}"
                        style="padding:9px 12px; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; color:var(--text-primary); font:inherit;">
                    <button id="caja-refresh" class="btn btn-secondary" style="padding:9px 12px; display:inline-flex; align-items:center; gap:6px;">
                        <i class="ph ph-arrows-clockwise"></i> Actualizar
                    </button>
                </div>
            </div>
            <div id="caja-body"></div>
          </div>
        `;

        const body = container.querySelector('#caja-body');
        const fechaInput = container.querySelector('#caja-fecha');

        async function render() {
            const dia = fechaInput.value || today;
            let sales = [];
            try {
                const all = await window.db.eleventa_sales.toArray();
                sales = all.filter(s => !s.deleted && (parseFloat(s.total) || 0) > 0 && chileDate(s.date) === dia);
            } catch (e) {
                body.innerHTML = `<p style="color:var(--danger);">No se pudieron cargar las ventas.</p>`;
                return;
            }
            sales.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Agrupar por forma de pago
            const grupos = {};
            let total = 0;
            for (const s of sales) {
                const monto = parseFloat(s.total) || 0;
                const fp = s.forma_pago || 'Efectivo';
                if (!grupos[fp]) grupos[fp] = { monto: 0, n: 0 };
                grupos[fp].monto += monto; grupos[fp].n++;
                total += monto;
            }
            const nTickets = sales.length;
            const promedio = nTickets ? total / nTickets : 0;
            const efectivoVentas = (grupos['Efectivo'] || {}).monto || 0;

            // Orden fijo de formas de pago (las que existan + las base)
            const orden = ['Efectivo', 'Tarjeta', 'Transferencia', 'Crédito', 'Mixto'];
            const formas = orden.filter(k => grupos[k]).concat(Object.keys(grupos).filter(k => !orden.includes(k)));

            if (nTickets === 0) {
                body.innerHTML = `
                    <div style="text-align:center; padding:50px 20px; background:var(--bg-card); border:1px solid var(--border); border-radius:16px;">
                        <i class="ph ph-receipt-x" style="font-size:3rem; color:var(--text-muted); opacity:0.6;"></i>
                        <h3 style="color:var(--text-primary); margin:14px 0 6px;">Sin ventas ${dia === today ? 'todavía hoy' : 'ese día'}</h3>
                        <p style="color:var(--text-muted); margin:0;">Cuando se hagan ventas en la caja, aparecen aquí al toque.</p>
                    </div>`;
                return;
            }

            const cards = formas.map(fp => {
                const g = grupos[fp]; const info = pmInfo(fp);
                return `
                    <div style="flex:1; min-width:120px; background:var(--bg-card); border:1px solid var(--border); border-left:4px solid ${info.col}; border-radius:14px; padding:14px 16px;">
                        <div style="display:flex; align-items:center; gap:7px; color:var(--text-muted); font-size:0.82rem; font-weight:600;">
                            <span style="font-size:1.05rem;">${info.emoji}</span> ${fp}
                        </div>
                        <div style="font-size:1.7rem; font-weight:800; color:${info.col}; margin-top:6px; line-height:1;">${fmt(g.monto)}</div>
                        <div style="color:var(--text-muted); font-size:0.78rem; margin-top:4px;">${g.n} venta${g.n !== 1 ? 's' : ''}</div>
                    </div>`;
            }).join('');

            const lista = sales.slice(0, 80).map(s => {
                const info = pmInfo(s.forma_pago || 'Efectivo');
                return `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border-bottom:1px solid var(--border);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:0.85rem; color:var(--text-muted); font-variant-numeric:tabular-nums;">${chileTime(s.date)}</span>
                            <span style="font-size:0.78rem; color:${info.col}; font-weight:600;">${info.emoji} ${s.forma_pago || 'Efectivo'}</span>
                        </div>
                        <span style="font-weight:700; color:var(--text-primary); font-variant-numeric:tabular-nums;">${fmt(parseFloat(s.total) || 0)}</span>
                    </div>`;
            }).join('');

            body.innerHTML = `
                <!-- Resumen del día -->
                <div style="display:flex; gap:14px; flex-wrap:wrap; margin-bottom:16px;">
                    <div style="flex:2; min-width:200px; background:linear-gradient(135deg, var(--primary), #c0392b); border-radius:16px; padding:18px 22px; color:#fff;">
                        <div style="font-size:0.82rem; opacity:0.9; text-transform:uppercase; letter-spacing:0.5px;">Total del día</div>
                        <div style="font-size:2.2rem; font-weight:800; margin-top:4px; line-height:1;">${fmt(total)}</div>
                        <div style="font-size:0.82rem; opacity:0.9; margin-top:6px;">${nTickets} ventas · promedio ${fmt(promedio)}</div>
                    </div>
                </div>

                <!-- Tarjetas por forma de pago -->
                <div style="display:flex; gap:14px; flex-wrap:wrap; margin-bottom:20px;">${cards}</div>

                <!-- Cuadre de efectivo -->
                <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; padding:18px 20px; margin-bottom:20px;">
                    <h3 style="margin:0 0 4px; color:var(--text-primary); font-size:1.05rem;">💵 Cuadre de efectivo</h3>
                    <p style="color:var(--text-muted); font-size:0.82rem; margin:0 0 14px;">Cuenta el efectivo de la caja y compáralo con lo vendido en efectivo.</p>
                    <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:flex-end;">
                        <div>
                            <div style="color:var(--text-muted); font-size:0.78rem; margin-bottom:4px;">Efectivo vendido (sistema)</div>
                            <div style="font-size:1.4rem; font-weight:800; color:#16a34a;">${fmt(efectivoVentas)}</div>
                        </div>
                        <div>
                            <label style="color:var(--text-muted); font-size:0.78rem; display:block; margin-bottom:4px;">¿Cuánto contaste? ($)</label>
                            <input type="number" id="caja-contado" placeholder="0" inputmode="numeric"
                                style="width:100%; max-width:160px; padding:11px 13px; background:var(--bg-secondary, #0a0f0b); border:1px solid var(--border); border-radius:10px; color:var(--text-primary); font:inherit; font-size:1.05rem; box-sizing:border-box;">
                        </div>
                        <div id="caja-dif" style="font-weight:700; font-size:1.05rem; padding-bottom:10px;"></div>
                    </div>
                    <p style="color:var(--text-muted); font-size:0.72rem; margin:12px 0 0;">Nota: solo compara con las ventas en efectivo del día. No incluye el fondo inicial de caja ni gastos pagados en efectivo (para el cuadre completo está "Arqueo de Caja").</p>
                </div>

                <!-- Lista de ventas -->
                <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; overflow:hidden;">
                    <div style="padding:14px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; color:var(--text-primary); font-size:1.05rem;">Ventas del día</h3>
                        <span style="color:var(--text-muted); font-size:0.82rem;">${nTickets} ticket${nTickets !== 1 ? 's' : ''}${nTickets > 80 ? ' · mostrando 80' : ''}</span>
                    </div>
                    ${lista}
                </div>
            `;

            // Cuadre interactivo
            const contado = body.querySelector('#caja-contado');
            const difEl = body.querySelector('#caja-dif');
            if (contado && difEl) {
                contado.addEventListener('input', () => {
                    const v = parseFloat(contado.value);
                    if (isNaN(v)) { difEl.textContent = ''; return; }
                    const dif = v - efectivoVentas;
                    if (Math.abs(dif) < 1) { difEl.textContent = '✓ Cuadra'; difEl.style.color = '#16a34a'; }
                    else if (dif > 0) { difEl.textContent = `Sobra ${fmt(dif)}`; difEl.style.color = '#d97706'; }
                    else { difEl.textContent = `Falta ${fmt(-dif)}`; difEl.style.color = 'var(--danger)'; }
                });
            }
        }

        await render();
        fechaInput.addEventListener('change', render);
        container.querySelector('#caja-refresh').addEventListener('click', render);

        // Auto-refresh cada 60s (ventas nuevas) — con limpieza al cambiar de vista
        const iv = setInterval(render, 60000);
        window._viewCleanup = () => clearInterval(iv);
    };
})();
