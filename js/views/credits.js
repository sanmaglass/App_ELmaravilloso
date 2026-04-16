// Credits View (Cartera Vencida)
window.Views = window.Views || {};

window.Views.credits = async (container) => {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <div>
                <h1 class="mb-2 text-primary flex items-center gap-2">
                    <i class="ph ph-hand-holding-dollar"></i> Cartera de Clientes
                </h1>
                <p class="text-muted">Directo desde la caja de Eleventa en tiempo real.</p>
            </div>
            <button class="btn btn-secondary" id="btn-refresh-credits">
                <i class="ph ph-arrows-clockwise"></i> Recargar
            </button>
        </div>

        <div class="mb-4">
            <div class="w-full relative">
                <i class="ph ph-magnifying-glass absolute" style="left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="credits-search" class="form-input" placeholder="Buscar cliente por nombre..." style="padding-left:36px;">
            </div>
        </div>

        <!-- Estadísticas -->
        <div class="responsive-grid mb-6">
             <div class="stat-card" style="background: linear-gradient(135deg, rgba(220,38,38,0.1) 0%, transparent 100%); border-left: 4px solid var(--danger);">
                 <div class="stat-label">Deuda Total en la Calle</div>
                 <div class="stat-value text-danger" id="credits-total-debt">$0.00</div>
             </div>
             <div class="stat-card">
                 <div class="stat-label">Clientes con Deuda</div>
                 <div class="stat-value" id="credits-total-clients">0</div>
             </div>
        </div>

        <div id="credits-list" class="grid-cols-auto gap-4">
            <div class="loading-state" style="grid-column:1/-1;">
                <div class="spinner"></div>
                <p>Cargando Saldos desde Supabase...</p>
            </div>
        </div>
    `;

    const supabase = window.SyncV2?.client || window.supabase.createClient(window.AppConfig.supabaseUrl, window.AppConfig.supabaseKey);

    let clientesArray = [];

    async function loadData() {
        const list = document.getElementById('credits-list');
        try {
            // Obtener datos directo de Supabase (esta tabla no pasa por SyncV2)
            const { data, error } = await supabase.from('eleventa_clientes')
                .select('*')
                .order('saldo_deuda', { ascending: false });
                
            if (error) throw error;
            clientesArray = data || [];
            render();
        } catch (e) {
            console.error(e);
            list.innerHTML = `<div class="p-6 text-center text-danger" style="grid-column:1/-1;">Error consultando Supabase. Revisa las políticas RLS: ${e.message}</div>`;
        }
    }

    function render() {
        const list = document.getElementById('credits-list');
        if (!list) return;

        const val = document.getElementById('credits-search').value.toLowerCase();
        const filtered = clientesArray.filter(c => c.nombre && c.nombre.toLowerCase().includes(val));

        // Actualizar estadísticas
        const deudaTotal = clientesArray.reduce((acc, c) => acc + (Number(c.saldo_deuda) || 0), 0);
        const clientesConDeuda = clientesArray.filter(c => Number(c.saldo_deuda) > 0).length;
        
        document.getElementById('credits-total-debt').innerHTML = window.Utils ? window.Utils.formatCurrency(deudaTotal) : `$${deudaTotal}`;
        document.getElementById('credits-total-clients').textContent = clientesConDeuda;

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="p-6 text-center" style="grid-column: 1/-1; background:var(--bg-card); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-users mb-3 text-muted" style="font-size:3rem;"></i>
                    <h3 class="text-muted">No hay clientes con ese nombre</h3>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(c => {
            const deuda = Number(c.saldo_deuda) || 0;
            const limite = Number(c.limite_credito) || 0;
            const porcentaje = limite > 0 ? (deuda / limite) * 100 : 0;
            
            let colorClase = deuda > 0 ? 'text-danger' : 'text-primary';
            if (deuda === 0) colorClase = 'text-muted'; // Si no debe, gris

            return `
            <div class="card p-4 flex justify-between items-center" style="${deuda > 0 ? 'border-left: 4px solid var(--danger)' : ''}">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center font-bold" style="width:40px; height:40px; background:rgba(0,0,0,0.05); color:var(--text-main); border-radius:50%;">
                        ${c.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-bold text-primary" style="font-size:1.1rem;">${c.nombre}</div>
                        <div class="text-xs text-muted" style="margin-top:2px;">
                            ${limite > 0 ? `Límite Autorizado: ${window.Utils ? window.Utils.formatCurrency(limite) : limite}` : 'Sin límite configurado'}
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-bold ${colorClase}" style="font-size:1.25rem;">
                        ${window.Utils ? window.Utils.formatCurrency(deuda) : deuda}
                    </div>
                    ${deuda > 0 ? `<div class="text-xs text-warning mt-1">Saldos pendientes</div>` : `<div class="text-xs text-muted mt-1">Al día</div>`}
                </div>
            </div>
        `}).join('');
    }

    // Eventos
    document.getElementById('credits-search').addEventListener('input', render);
    document.getElementById('btn-refresh-credits').addEventListener('click', () => {
         const btn = document.getElementById('btn-refresh-credits');
         btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Cargando...';
         loadData().then(() => btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Recargar');
    });

    // Suscripción Realtime a Clientes (reusar cliente existente)
    const channel = supabase.channel('clientes-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'eleventa_clientes' }, payload => {
            console.log('Cambio en clientes recibido!', payload);
            loadData();
        })
        .subscribe();

    // Cargar inicial
    await loadData();
};
