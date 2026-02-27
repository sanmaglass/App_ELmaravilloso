// Mis Tareas — Pro Version with Priority, Snooze, Notes & Notifications
window.Views = window.Views || {};

window.Views.reminders = async (container) => {
    let tasks = [];
    let currentFilter = 'all';

    const PRIORITY = {
        high: { label: 'Alta', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: 'ph-fire' },
        medium: { label: 'Media', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: 'ph-minus-circle' },
        low: { label: 'Baja', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: 'ph-arrow-down-circle' },
    };

    // ── Render Base UI ────────────────────────────────────────
    const renderBase = () => {
        container.innerHTML = `
            <div class="stack-on-mobile" style="justify-content:space-between; align-items:center; margin-bottom:20px;">
                <div>
                    <h1 style="margin:0;">Mis Tareas</h1>
                    <p style="color:var(--text-muted); margin:4px 0 0;">Gestiona actividades y alertas de negocio</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <button class="btn btn-secondary btn-sm" id="btn-notif-perm" style="display:none;">
                        <i class="ph ph-bell-ringing"></i> Activar alertas
                    </button>
                    <button class="btn btn-primary" id="btn-add-alert">
                        <i class="ph ph-bell-plus"></i> Nueva Alerta
                    </button>
                </div>
            </div>

            <!-- Stats Strip -->
            <div class="responsive-grid-3" style="margin-bottom:20px;">
                <div class="card" style="background:linear-gradient(135deg,#dc2626,#991b1b); color:white; border:none; padding:16px;">
                    <div style="font-size:0.8rem; opacity:0.9; margin-bottom:4px;">Para Hoy</div>
                    <h2 id="stat-today" style="font-size:2rem; margin:0;">0</h2>
                </div>
                <div class="card" style="background:linear-gradient(135deg,#7c3aed,#4338ca); color:white; border:none; padding:16px;">
                    <div style="font-size:0.8rem; opacity:0.9; margin-bottom:4px;">Próxima Alerta</div>
                    <div id="stat-next" style="font-size:0.95rem; font-weight:600; margin-top:4px;">--</div>
                </div>
                <div class="card" style="border:1px solid var(--border); padding:16px;">
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Completadas</div>
                    <h2 id="stat-done" style="font-size:2rem; margin:0; color:var(--text-primary);">0</h2>
                </div>
            </div>

            <!-- Quick Entry -->
            <div class="card" style="padding:12px; margin-bottom:20px;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <i class="ph ph-lightning" style="font-size:1.4rem; color:var(--primary);"></i>
                    <input type="text" id="quick-task-input" placeholder='Ej: Pagar luz +3d  ·  Reunión +5h  (Enter para guardar)'
                        style="flex-grow:1; border:none; background:transparent; font-size:1rem; outline:none; font-family:var(--font-main);">
                </div>
            </div>

            <!-- Task List -->
            <div class="card" style="padding:0; overflow:hidden; border:none; box-shadow:0 4px 20px rgba(0,0,0,0.06);">
                <div style="padding:14px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
                    <h3 style="margin:0; font-size:1.05rem;">Lista de Tareas</h3>
                    <div class="btn-group">
                        <button class="btn btn-secondary btn-sm active" data-filter="all">Todas</button>
                        <button class="btn btn-secondary btn-sm" data-filter="pending">Pendientes</button>
                        <button class="btn btn-secondary btn-sm" data-filter="high">🔴 Alta</button>
                    </div>
                </div>
                <div id="tasks-list-container" style="min-height:280px; background:white;"></div>
            </div>
        `;

        // Show permission button if not granted
        if (Notification.permission !== 'granted' && 'Notification' in window) {
            document.getElementById('btn-notif-perm').style.display = 'inline-flex';
        }

        // Events
        document.getElementById('btn-add-alert').addEventListener('click', () => showAddModal());
        document.getElementById('btn-notif-perm').addEventListener('click', async () => {
            const granted = await window.AppNotify?.requestPermission();
            if (granted) {
                document.getElementById('btn-notif-perm').style.display = 'none';
                window.AppNotify?.playChime('success');
                window.Sync?.showToast('✅ Alertas activadas — El Maravilloso', 'success');
            }
        });

        document.getElementById('quick-task-input').addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                await saveQuickTask(e.target.value.trim());
                e.target.value = '';
            }
        });

        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                updateListView();
            });
        });
    };

    renderBase();

    // ── Load Tasks ───────────────────────────────────────────
    const loadTasks = async () => {
        try {
            tasks = await window.db.reminders.filter(r => !r.deleted).toArray();
            updateListView();
            updateStats();
        } catch (e) {
            console.error('[Reminders] Load error:', e);
            tasks = [];
            updateListView();
        }
    };

    // ── Stats ─────────────────────────────────────────────────
    const updateStats = () => {
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const pending = tasks.filter(r => !r.completed);

        document.getElementById('stat-today').textContent =
            pending.filter(r => new Date(r.next_run) <= endOfToday).length;

        const next = pending.sort((a, b) => new Date(a.next_run) - new Date(b.next_run))[0];
        document.getElementById('stat-next').textContent = next
            ? new Date(next.next_run).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : 'Sin alertas';

        document.getElementById('stat-done').textContent = tasks.filter(r => r.completed).length;
    };

    // ── List ──────────────────────────────────────────────────
    const updateListView = () => {
        const list = document.getElementById('tasks-list-container');

        let filtered = [...tasks];
        if (currentFilter === 'pending') filtered = filtered.filter(r => !r.completed);
        if (currentFilter === 'high') filtered = filtered.filter(r => r.priority === 'high');

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="padding:60px 20px; text-align:center; color:var(--text-muted);">
                    <i class="ph ph-list-checks" style="font-size:3.5rem; opacity:0.12; display:block; margin-bottom:12px;"></i>
                    <p style="font-size:1rem;">No hay tareas aquí. ¡Crea una!</p>
                </div>`;
            return;
        }

        filtered.sort((a, b) => {
            const pOrder = { high: 0, medium: 1, low: 2 };
            if (!a.completed && b.completed) return -1;
            if (a.completed && !b.completed) return 1;
            const pDiff = (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
            if (pDiff !== 0) return pDiff;
            return new Date(a.next_run) - new Date(b.next_run);
        });

        // Group
        const now = new Date();
        const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const endTomorrow = new Date(endToday); endTomorrow.setDate(endTomorrow.getDate() + 1);
        const groups = {
            overdue: { label: '⚠️ Vencidas', items: [] },
            today: { label: '📅 Hoy', items: [] },
            tomorrow: { label: '🌅 Mañana', items: [] },
            upcoming: { label: '🗓 Próximamente', items: [] },
            done: { label: '✅ Completadas', items: [] },
        };

        filtered.forEach(t => {
            if (t.completed) { groups.done.items.push(t); return; }
            const d = new Date(t.next_run);
            if (d < now) groups.overdue.items.push(t);
            else if (d <= endToday) groups.today.items.push(t);
            else if (d <= endTomorrow) groups.tomorrow.items.push(t);
            else groups.upcoming.items.push(t);
        });

        let html = '';
        for (const [, g] of Object.entries(groups)) {
            if (!g.items.length) continue;
            html += `<div style="padding:10px 20px; background:#f1f5f9; font-size:0.8rem; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border); letter-spacing:0.05em;">${g.label}</div>`;
            html += g.items.map(t => renderItem(t)).join('');
        }
        list.innerHTML = html;

        list.querySelectorAll('.btn-check').forEach(b =>
            b.addEventListener('click', () => toggleComplete(Number(b.dataset.id))));
        list.querySelectorAll('.btn-delete-task').forEach(b =>
            b.addEventListener('click', () => deleteTask(Number(b.dataset.id))));
        list.querySelectorAll('.btn-snooze-1h').forEach(b =>
            b.addEventListener('click', () => snooze(Number(b.dataset.id), 'hour')));
        list.querySelectorAll('.btn-snooze-1d').forEach(b =>
            b.addEventListener('click', () => snooze(Number(b.dataset.id), 'day')));
    };

    // ── Render single task ────────────────────────────────────
    const renderItem = (t) => {
        const pri = PRIORITY[t.priority || 'medium'];
        const date = new Date(t.next_run);
        const isOver = !t.completed && date < new Date();
        const recurr = t.type === 'periodic';
        const overdueCss = isOver ? 'border-left:3px solid #ef4444;' : '';

        return `
        <div style="padding:14px 20px; display:flex; align-items:flex-start; gap:14px; border-bottom:1px solid rgba(0,0,0,0.04); ${t.completed ? 'opacity:0.55;' : ''} ${overdueCss}">
            <button class="btn-check ${t.completed ? 'checked' : ''}" data-id="${t.id}"
                style="width:26px; height:26px; border-radius:8px; border:2px solid ${t.completed ? '#22c55e' : '#cbd5e1'}; background:${t.completed ? '#22c55e' : 'white'}; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:.2s; margin-top:2px;">
                ${t.completed ? '<i class="ph ph-check" style="color:white; font-size:13px;"></i>' : ''}
            </button>
            <div style="flex-grow:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="font-weight:600; font-size:0.95rem; ${t.completed ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${t.title}</span>
                    <span style="font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:99px; background:${pri.bg}; color:${pri.color};">
                        <i class="ph ${pri.icon}"></i> ${pri.label}
                    </span>
                    ${recurr ? `<span style="font-size:0.7rem; padding:2px 7px; border-radius:99px; background:rgba(99,102,241,0.1); color:#6366f1;"><i class="ph ph-arrows-clockwise"></i> Recurrente</span>` : ''}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:3px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <i class="ph ${isOver ? 'ph-warning' : 'ph-clock'}" style="${isOver ? 'color:#ef4444;' : ''}"></i>
                    <span style="${isOver ? 'color:#ef4444; font-weight:600;' : ''}">${date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                    ${t.notes ? `· <i class="ph ph-note"></i> ${t.notes.substring(0, 40)}${t.notes.length > 40 ? '…' : ''}` : ''}
                </div>
                ${!t.completed ? `
                <div style="margin-top:8px; display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm btn-snooze-1h" data-id="${t.id}" style="font-size:0.72rem; padding:3px 10px; height:auto;">⏸ +1h</button>
                    <button class="btn btn-secondary btn-sm btn-snooze-1d" data-id="${t.id}" style="font-size:0.72rem; padding:3px 10px; height:auto;">⏸ Mañana</button>
                </div>` : ''}
            </div>
            <button class="btn btn-icon btn-delete-task" data-id="${t.id}" style="color:#f87171; border:none; background:transparent; flex-shrink:0;">
                <i class="ph ph-trash"></i>
            </button>
        </div>`;
    };

    // ── CRUD Actions ──────────────────────────────────────────
    const saveQuickTask = async (rawTitle) => {
        let title = rawTitle;
        let nextRun = new Date();
        const dayM = title.match(/\+(\d+)d/i);
        const hourM = title.match(/\+(\d+)h/i);
        if (dayM) { nextRun.setDate(nextRun.getDate() + parseInt(dayM[1])); title = title.replace(dayM[0], '').trim(); }
        else if (hourM) { nextRun.setHours(nextRun.getHours() + parseInt(hourM[1])); title = title.replace(hourM[0], '').trim(); }

        const res = await window.DataManager.saveAndSync('reminders', {
            title, type: 'once', frequency_unit: 'days', frequency_value: 0,
            next_run: nextRun.toISOString(), completed: 0, deleted: false,
            priority: 'medium', created_at: new Date().toISOString()
        });
        if (res.success) { window.AppNotify?.playChime('success'); await loadTasks(); }
    };

    const toggleComplete = async (id) => {
        const t = tasks.find(x => x.id === id);
        if (!t) return;
        await window.DataManager.saveAndSync('reminders', { ...t, completed: t.completed ? 0 : 1 });
        if (!t.completed) window.AppNotify?.playChime('success');
        await loadTasks();
        window.AppNotify?.updateBadge();
    };

    const deleteTask = async (id) => {
        if (!confirm('¿Eliminar tarea?')) return;
        await window.DataManager.deleteAndSync('reminders', id);
        await loadTasks();
        window.AppNotify?.updateBadge();
    };

    const snooze = async (id, unit) => {
        const t = tasks.find(x => x.id === id);
        if (!t) return;
        const next = new Date();
        if (unit === 'hour') next.setHours(next.getHours() + 1);
        else { next.setDate(next.getDate() + 1); next.setHours(9, 0, 0, 0); }
        await window.DataManager.saveAndSync('reminders', { ...t, next_run: next.toISOString(), snoozed_until: next.toISOString() });
        window.Sync?.showToast(`⏸ Pospuesto para ${next.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`, 'info');
        await loadTasks();
    };

    // ── Add Modal (Pro) ───────────────────────────────────────
    const showAddModal = () => {
        const now = new Date();
        const minTime = now.toISOString().slice(0, 16);
        const modalContainer = document.getElementById('modal-container');

        modalContainer.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>Nueva Alerta / Tarea</h2>
                <button class="btn-close-modal"><i class="ph ph-x"></i></button>
            </div>
            <div class="modal-body">
                <form id="form-full-task">
                    <div class="form-group">
                        <label class="form-label">Descripción *</label>
                        <input type="text" id="ft-title" class="form-input" placeholder="Ej: Pagar luz eléctrica" required autofocus>
                    </div>

                    <div class="responsive-grid-2">
                        <div class="form-group">
                            <label class="form-label">Prioridad</label>
                            <select id="ft-priority" class="form-input">
                                <option value="low">🟢 Baja</option>
                                <option value="medium" selected>🟡 Media</option>
                                <option value="high">🔴 Alta</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Frecuencia</label>
                            <select id="ft-type" class="form-input">
                                <option value="once">Una vez</option>
                                <option value="hours">Repetir c/ Horas</option>
                                <option value="days">Repetir c/ Días</option>
                            </select>
                        </div>
                    </div>

                    <div id="ft-val-container" class="form-group" style="display:none;">
                        <label class="form-label" id="ft-val-label">Intervalo</label>
                        <input type="number" id="ft-value" class="form-input" min="1" value="1">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Primera alerta *</label>
                        <input type="datetime-local" id="ft-start" class="form-input" value="${minTime}" min="${minTime}" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notas <span style="color:var(--text-muted); font-weight:400;">(opcional)</span></label>
                        <textarea id="ft-notes" class="form-input" rows="2" placeholder="Información adicional..." style="resize:vertical;"></textarea>
                    </div>

                    <div id="ft-error" style="display:none; color:#ef4444; background:rgba(239,68,68,0.1); border-radius:8px; padding:10px 14px; font-size:0.85rem; margin-top:4px;"></div>

                    <button type="submit" class="btn btn-primary" id="ft-submit" style="width:100%; margin-top:20px; height:50px; font-weight:700;">
                        <i class="ph ph-check-circle"></i> GUARDAR ALERTA
                    </button>
                </form>
            </div>
        </div>`;

        modalContainer.classList.remove('hidden');

        const typeSelect = document.getElementById('ft-type');
        typeSelect.addEventListener('change', () => {
            const valWrap = document.getElementById('ft-val-container');
            const label = document.getElementById('ft-val-label');
            if (typeSelect.value === 'once') { valWrap.style.display = 'none'; }
            else {
                valWrap.style.display = 'block';
                label.textContent = typeSelect.value === 'hours' ? 'Cada X Horas' : 'Cada X Días';
            }
        });

        document.getElementById('form-full-task').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('ft-submit');
            const errDiv = document.getElementById('ft-error');
            const title = document.getElementById('ft-title').value.trim();
            if (!title) return;

            btn.disabled = true;
            btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Guardando...';
            errDiv.style.display = 'none';

            const task = {
                title,
                priority: document.getElementById('ft-priority').value,
                type: typeSelect.value === 'once' ? 'once' : 'periodic',
                frequency_unit: typeSelect.value,
                frequency_value: parseInt(document.getElementById('ft-value').value) || 0,
                next_run: new Date(document.getElementById('ft-start').value).toISOString(),
                notes: document.getElementById('ft-notes').value.trim() || null,
                completed: 0,
                deleted: false,
                created_at: new Date().toISOString()
            };

            const res = await window.DataManager.saveAndSync('reminders', task);

            if (res.success) {
                modalContainer.classList.add('hidden');
                await loadTasks();
                window.AppNotify?.playChime('success');
                window.AppNotify?.updateBadge();
                const msg = res.syncError ? '⚠️ Guardado local (sin sync)' : '✅ Alerta guardada';
                window.Sync?.showToast(msg, res.syncError ? 'info' : 'success');
            } else {
                btn.disabled = false;
                btn.innerHTML = '<i class="ph ph-check-circle"></i> GUARDAR ALERTA';
                errDiv.textContent = '⚠️ ' + (res.error || 'Error al guardar');
                errDiv.style.display = 'block';
            }
        });

        modalContainer.querySelector('.btn-close-modal').addEventListener('click', () => {
            modalContainer.classList.add('hidden');
        });
    };

    await loadTasks();

    // Realtime sync handler
    const syncHandler = () => {
        if (document.getElementById('tasks-list-container')) {
            loadTasks();
        } else {
            window.removeEventListener('sync-data-updated', syncHandler);
        }
    };
    window.addEventListener('sync-data-updated', syncHandler);
};
