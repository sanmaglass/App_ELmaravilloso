// Reminders View
window.Views = window.Views || {};

window.Views.reminders = async (container) => {
    // 1. Initial State
    let reminders = [];

    // 2. Render UI
    const render = () => {
        container.innerHTML = `
            <div class="stack-on-mobile" style="justify-content:space-between; align-items:center; margin-bottom:24px;">
                <div>
                    <h1>Recordatorios</h1>
                    <p style="color:var(--text-muted);">Gestiona tus tareas y alertas automáticas</p>
                </div>
                <button class="btn btn-primary" id="btn-add-reminder">
                    <i class="ph ph-plus"></i> Nuevo Recordatorio
                </button>
            </div>

            <div class="responsive-grid-3">
                <div class="card" style="background: linear-gradient(135deg, var(--primary), #991b1b); color: white; border:none;">
                    <div style="font-size:0.9rem; opacity:0.9; margin-bottom:8px;">Pendientes Hoy</div>
                    <h2 id="pending-today-count" style="font-size:2.5rem; margin:0;">0</h2>
                </div>
                <div class="card" style="background: linear-gradient(135deg, var(--accent), #4338ca); color: white; border:none;">
                    <div style="font-size:0.9rem; opacity:0.9; margin-bottom:8px;">Próxima Alerta</div>
                    <div id="next-alert-text" style="font-size:1.1rem; font-weight:600; margin-top:10px;">--:--</div>
                </div>
                <div class="card" style="background: white; border: 1px solid var(--border);">
                    <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:8px;">Completados (Mes)</div>
                    <h2 id="completed-month-count" style="font-size:2.5rem; margin:0; color:var(--text-primary);">0</h2>
                </div>
            </div>

            <div class="card" style="margin-top:24px; padding:0; overflow:hidden;">
                <div style="padding:20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0;">Lista de Tareas</h3>
                    <div class="btn-group">
                        <button class="btn btn-secondary btn-sm active" data-filter="all">Todos</button>
                        <button class="btn btn-secondary btn-sm" data-filter="pending">Pendientes</button>
                    </div>
                </div>
                <div id="reminders-list" style="min-height:200px;">
                    <div class="loading-state" style="padding:40px;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;
    };

    render();

    // 3. Logic Functions
    const loadReminders = async () => {
        try {
            reminders = await window.db.reminders.where('deleted').equals(0).toArray();
            updateList();
            updateStats();
        } catch (e) {
            console.error('Error loading reminders:', e);
        }
    };

    const updateStats = () => {
        const now = new Date();
        const pendingToday = reminders.filter(r => !r.completed && new Date(r.next_run) <= new Date(now.setHours(23, 59, 59, 999))).length;
        document.getElementById('pending-today-count').textContent = pendingToday;

        const next = reminders
            .filter(r => !r.completed)
            .sort((a, b) => new Date(a.next_run) - new Date(b.next_run))[0];

        if (next) {
            const date = new Date(next.next_run);
            document.getElementById('next-alert-text').textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + date.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ')';
        } else {
            document.getElementById('next-alert-text').textContent = "Sin alertas";
        }

        const completedThisMonth = reminders.filter(r => r.completed).length; // Simplified for now
        document.getElementById('completed-month-count').textContent = completedThisMonth;
    };

    const updateList = (filter = 'all') => {
        const listContainer = document.getElementById('reminders-list');
        let filtered = reminders;
        if (filter === 'pending') filtered = reminders.filter(r => !r.completed);

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div style="padding:60px; text-align:center; color:var(--text-muted);">
                    <i class="ph ph-calendar-blank" style="font-size:3rem; margin-bottom:12px; opacity:0.3;"></i>
                    <p>No hay recordatorios configurados.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filtered.sort((a, b) => new Date(a.next_run) - new Date(b.next_run)).map(r => `
            <div class="list-item" style="padding:16px 20px; display:flex; align-items:center; gap:16px; border-bottom:1px solid var(--border); ${r.completed ? 'opacity:0.6;' : ''}">
                <button class="btn-check ${r.completed ? 'checked' : ''}" data-id="${r.id}" style="width:24px; height:24px; border-radius:50%; border:2px solid ${r.completed ? 'var(--success)' : 'var(--border)'}; background:${r.completed ? 'var(--success)' : 'transparent'}; cursor:pointer; flex-shrink:0;">
                    ${r.completed ? '<i class="ph ph-check" style="color:white; font-size:14px;"></i>' : ''}
                </button>
                <div style="flex-grow:1;">
                    <div style="font-weight:600; font-size:1.05rem; ${r.completed ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${r.title}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">
                        <i class="ph ph-clock"></i> ${getFrequencyLabel(r)} • Próxima: ${new Date(r.next_run).toLocaleString()}
                    </div>
                </div>
                <button class="btn btn-icon btn-delete-reminder" data-id="${r.id}" style="color:#ef4444;"><i class="ph ph-trash"></i></button>
            </div>
        `).join('');

        // Add events
        listContainer.querySelectorAll('.btn-check').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const reminder = reminders.find(r => r.id === id);
                await toggleComplete(reminder);
            });
        });

        listContainer.querySelectorAll('.btn-delete-reminder').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('¿Borrar recordatorio?')) {
                    const id = parseInt(btn.dataset.id);
                    await deleteReminder(id);
                }
            });
        });
    };

    const getFrequencyLabel = (r) => {
        if (r.type === 'once') return 'Una vez';
        if (r.frequency_unit === 'hours') return `Cada ${r.frequency_value} hora(s)`;
        if (r.frequency_unit === 'days') return `Cada ${r.frequency_value} día(s)`;
        return '';
    };

    const toggleComplete = async (reminder) => {
        const newState = !reminder.completed;
        await window.DataManager.saveAndSync('reminders', { ...reminder, completed: newState ? 1 : 0 });
        await loadReminders();
    };

    const deleteReminder = async (id) => {
        await window.DataManager.deleteAndSync('reminders', id);
        await loadReminders();
    };

    const showAddModal = () => {
        const now = new Date();
        const minTime = now.toISOString().slice(0, 16);

        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h2>Nuevo Recordatorio</h2>
                    <button class="btn-close-modal"><i class="ph ph-x"></i></button>
                </div>
                <div class="modal-body">
                    <form id="form-reminder">
                        <div class="form-group">
                            <label class="form-label">¿Qué debes hacer?</label>
                            <input type="text" id="rem-title" class="form-input" placeholder="Ej: Revisar inventario" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Frecuencia</label>
                            <select id="rem-type" class="form-input">
                                <option value="once">Una vez</option>
                                <option value="hours">Cada X Horas</option>
                                <option value="days">Cada X Días</option>
                            </select>
                        </div>
                        <div id="freq-value-container" class="form-group" style="display:none;">
                            <label class="form-label" id="freq-label">Valor</label>
                            <input type="number" id="rem-value" class="form-input" min="1" value="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Primera Alerta (Fecha y Hora)</label>
                            <input type="datetime-local" id="rem-start" class="form-input" value="${minTime}" min="${minTime}" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">
                            <i class="ph ph-floppy-disk"></i> Crear Recordatorio
                        </button>
                    </form>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = modalHtml;
        modalContainer.classList.remove('hidden');

        // Modal Logic
        const typeSelect = document.getElementById('rem-type');
        const freqContainer = document.getElementById('freq-value-container');
        const freqLabel = document.getElementById('freq-label');

        typeSelect.addEventListener('change', () => {
            if (typeSelect.value === 'once') {
                freqContainer.style.display = 'none';
            } else {
                freqContainer.style.display = 'block';
                freqLabel.textContent = typeSelect.value === 'hours' ? 'Horas' : 'Días';
            }
        });

        document.getElementById('form-reminder').addEventListener('submit', async (e) => {
            e.preventDefault();

            const newReminder = {
                title: document.getElementById('rem-title').value,
                type: typeSelect.value === 'once' ? 'once' : 'periodic',
                frequency_unit: typeSelect.value,
                frequency_value: parseInt(document.getElementById('rem-value').value) || 0,
                next_run: new Date(document.getElementById('rem-start').value).toISOString(),
                completed: 0,
                deleted: 0,
                created_at: new Date().toISOString()
            };

            const result = await window.DataManager.saveAndSync('reminders', newReminder);
            if (result.success) {
                modalContainer.classList.add('hidden');
                loadReminders();
                window.Sync.showToast('Recordatorio creado', 'success');
            }
        });

        modalContainer.querySelector('.btn-close-modal').addEventListener('click', () => {
            modalContainer.classList.add('hidden');
        });
    };

    // 4. Init
    document.getElementById('btn-add-reminder').addEventListener('click', showAddModal);

    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateList(btn.dataset.filter);
        });
    });

    await loadReminders();
};
