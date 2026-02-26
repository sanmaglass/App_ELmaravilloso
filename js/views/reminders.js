// Tasks View (Unified Task Center)
window.Views = window.Views || {};

window.Views.reminders = async (container) => {
    // 1. Initial State
    let tasks = [];
    let currentFilter = 'all';

    // 2. Render UI Basic Structure
    const renderBase = () => {
        container.innerHTML = `
            <div class="stack-on-mobile" style="justify-content:space-between; align-items:center; margin-bottom:24px;">
                <div>
                    <h1>Mis Tareas</h1>
                    <p style="color:var(--text-muted);">Gestiona tus actividades y alertas de negocio</p>
                </div>
                <button class="btn btn-primary" id="btn-add-alert">
                    <i class="ph ph-bell-plus"></i> Nueva Alerta
                </button>
            </div>

            <!-- Quick Entry Bar -->
            <div class="card" style="padding: 12px; margin-bottom: 24px; background: rgba(255,255,255,0.5);">
                <div style="display:flex; gap:12px; align-items:center;">
                    <div style="width:40px; height:40px; border-radius:12px; background:var(--bg-glass); display:flex; align-items:center; justify-content:center; color:var(--primary);">
                        <i class="ph ph-plus-circle" style="font-size:1.5rem;"></i>
                    </div>
                    <input type="text" id="quick-task-input" placeholder="Ej: Pagar luz +3d (Enter)" 
                        style="flex-grow:1; border:none; background:transparent; font-size:1.1rem; outline:none; font-family:var(--font-main);">
                </div>
            </div>

            <div class="responsive-grid-3" style="margin-bottom:24px;">
                <div class="card" style="background: linear-gradient(135deg, var(--primary), #991b1b); color: white; border:none; padding:16px;">
                    <div style="font-size:0.85rem; opacity:0.9; margin-bottom:4px;">Para Hoy</div>
                    <h2 id="pending-today-count" style="font-size:2rem; margin:0;">0</h2>
                </div>
                <div class="card" style="background: linear-gradient(135deg, var(--accent), #4338ca); color: white; border:none; padding:16px;">
                    <div style="font-size:0.85rem; opacity:0.9; margin-bottom:4px;">Sig. Alerta</div>
                    <div id="next-alert-text" style="font-size:1rem; font-weight:600; margin-top:4px;">--:--</div>
                </div>
                <div class="card" style="background: white; border: 1px solid var(--border); padding:16px;">
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Completadas</div>
                    <h2 id="completed-count" style="font-size:2rem; margin:0; color:var(--text-primary);">0</h2>
                </div>
            </div>

            <div class="card" style="padding:0; overflow:hidden; border:none; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
                    <h3 style="margin:0; font-size:1.1rem;">Lista de Tareas</h3>
                    <div class="btn-group">
                        <button class="btn btn-secondary btn-sm active" data-filter="all">Todas</button>
                        <button class="btn btn-secondary btn-sm" data-filter="pending">Pendientes</button>
                    </div>
                </div>
                <div id="tasks-list-container" style="min-height:300px; background:white;">
                    <div class="loading-state" style="padding:40px;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;

        // Quick Input Event
        const input = document.getElementById('quick-task-input');
        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                await saveTask(input.value.trim());
                input.value = '';
            }
        });

        document.getElementById('btn-add-alert').addEventListener('click', showAddModal);

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

    // 3. Logic Functions
    const loadTasks = async () => {
        try {
            tasks = await window.db.reminders.where('deleted').equals(0).toArray();
            updateListView();
            updateStats();
        } catch (e) {
            console.error('Error loading tasks:', e);
        }
    };

    const updateStats = () => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const pendingToday = tasks.filter(r => !r.completed && new Date(r.next_run) <= endOfToday).length;
        document.getElementById('pending-today-count').textContent = pendingToday;

        const next = tasks
            .filter(r => !r.completed)
            .sort((a, b) => new Date(a.next_run) - new Date(b.next_run))[0];

        if (next) {
            const date = new Date(next.next_run);
            document.getElementById('next-alert-text').textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + date.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ')';
        } else {
            document.getElementById('next-alert-text').textContent = "Sin alertas";
        }

        const completedCount = tasks.filter(r => r.completed).length;
        document.getElementById('completed-count').textContent = completedCount;
    };

    const updateListView = () => {
        const listContainer = document.getElementById('tasks-list-container');
        let filtered = tasks;
        if (currentFilter === 'pending') filtered = tasks.filter(r => !r.completed);

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div style="padding:80px 20px; text-align:center; color:var(--text-muted);">
                    <i class="ph ph-list-checks" style="font-size:4rem; margin-bottom:12px; opacity:0.1;"></i>
                    <p style="font-size:1.1rem;">No hay tareas pendientes.</p>
                    <button class="btn btn-secondary btn-sm" style="margin-top:15px;" onclick="document.getElementById('quick-task-input').focus()">Crear una ahora</button>
                </div>
            `;
            return;
        }

        // Sort by next_run
        filtered.sort((a, b) => new Date(a.next_run) - new Date(b.next_run));

        // Grouping
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const endOfTomorrow = new Date(endOfToday);
        endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

        const groups = {
            today: { label: 'Hoy', icon: 'ph-calendar-star', items: [] },
            tomorrow: { label: 'Mañana', icon: 'ph-calendar-plus', items: [] },
            upcoming: { label: 'Próximamente', icon: 'ph-calendar-blank', items: [] },
            done: { label: 'Completadas', icon: 'ph-check-circle', items: [] }
        };

        filtered.forEach(t => {
            if (t.completed) {
                groups.done.items.push(t);
                return;
            }
            const date = new Date(t.next_run);
            if (date <= endOfToday) groups.today.items.push(t);
            else if (date <= endOfTomorrow) groups.tomorrow.items.push(t);
            else groups.upcoming.items.push(t);
        });

        let html = '';
        for (const [key, group] of Object.entries(groups)) {
            if (group.items.length > 0) {
                html += `
                    <div class="group-header" style="padding:12px 20px; background:#f1f5f9; font-size:0.85rem; font-weight:700; color:var(--text-muted); display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--border);">
                        <i class="ph ${group.icon}"></i> ${group.label.toUpperCase()}
                    </div>
                    ${group.items.map(t => renderTaskItem(t)).join('')}
                `;
            }
        }

        listContainer.innerHTML = html;

        // Add Events
        listContainer.querySelectorAll('.btn-check').forEach(btn => {
            btn.addEventListener('click', () => toggleComplete(parseInt(btn.dataset.id)));
        });

        listContainer.querySelectorAll('.btn-delete-task').forEach(btn => {
            btn.addEventListener('click', () => deleteTask(parseInt(btn.dataset.id)));
        });
    };

    const renderTaskItem = (t) => {
        const date = new Date(t.next_run);
        const isRecurring = t.type === 'periodic';
        return `
            <div class="list-item" style="padding:14px 20px; display:flex; align-items:center; gap:16px; border-bottom:1px solid rgba(0,0,0,0.03); ${t.completed ? 'opacity:0.6;' : ''}">
                <button class="btn-check ${t.completed ? 'checked' : ''}" data-id="${t.id}" 
                    style="width:26px; height:26px; border-radius:8px; border:2px solid ${t.completed ? 'var(--success)' : '#cbd5e1'}; background:${t.completed ? 'var(--success)' : 'white'}; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:0.2s;">
                    ${t.completed ? '<i class="ph ph-check" style="color:white; font-size:14px; font-weight:800;"></i>' : ''}
                </button>
                <div style="flex-grow:1;">
                    <div style="font-weight:600; font-size:1rem; ${t.completed ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${t.title}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px; display:flex; align-items:center; gap:6px;">
                        <i class="ph ${isRecurring ? 'ph-arrows-clockwise' : 'ph-clock'}"></i> 
                        ${isRecurring ? getFrequencyLabel(t) + ' • ' : ''} 
                        ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </div>
                </div>
                <button class="btn btn-icon btn-delete-task" data-id="${t.id}" style="color:#f87171; border:none; background:transparent;"><i class="ph ph-trash"></i></button>
            </div>
        `;
    };

    const getFrequencyLabel = (r) => {
        if (r.frequency_unit === 'hours') return `Cada ${r.frequency_value}h`;
        if (r.frequency_unit === 'days') return `Cada ${r.frequency_value}d`;
        return '';
    };

    const saveTask = async (rawTitle) => {
        let title = rawTitle;
        let nextRun = new Date();
        let type = 'once';
        let freqUnit = 'days';
        let freqVal = 0;

        // Smart Parsing: "Tarea +3d" or "Tarea +5h"
        const dayMatch = title.match(/\+(\d+)d/i);
        const hourMatch = title.match(/\+(\d+)h/i);

        if (dayMatch) {
            const days = parseInt(dayMatch[1]);
            nextRun.setDate(nextRun.getDate() + days);
            title = title.replace(dayMatch[0], '').trim();
        } else if (hourMatch) {
            const hours = parseInt(hourMatch[1]);
            nextRun.setHours(nextRun.getHours() + hours);
            title = title.replace(hourMatch[0], '').trim();
        }

        const newTask = {
            title,
            type,
            frequency_unit: freqUnit,
            frequency_value: freqVal,
            next_run: nextRun.toISOString(),
            completed: 0,
            deleted: 0,
            created_at: new Date().toISOString()
        };
        await window.DataManager.saveAndSync('reminders', newTask);
        await loadTasks();
    };

    const toggleComplete = async (id) => {
        const t = tasks.find(x => x.id === id);
        if (!t) return;
        await window.DataManager.saveAndSync('reminders', { ...t, completed: t.completed ? 0 : 1 });
        await loadTasks();
    };

    const deleteTask = async (id) => {
        if (confirm('¿Eliminar tarea?')) {
            await window.DataManager.deleteAndSync('reminders', id);
            await loadTasks();
        }
    };

    const showAddModal = () => {
        const now = new Date();
        const minTime = now.toISOString().slice(0, 16);

        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h2>Nueva Alerta / Tarea Programada</h2>
                    <button class="btn-close-modal"><i class="ph ph-x"></i></button>
                </div>
                <div class="modal-body">
                    <form id="form-full-task">
                        <div class="form-group">
                            <label class="form-label">Descripción</label>
                            <input type="text" id="ft-title" class="form-input" placeholder="Ej: Pago de proveedores" required>
                        </div>
                        <div class="responsive-grid-2">
                            <div class="form-group">
                                <label class="form-label">Frecuencia</label>
                                <select id="ft-type" class="form-input">
                                    <option value="once">Una vez</option>
                                    <option value="hours">Repetir c/ Horas</option>
                                    <option value="days">Repetir c/ Días</option>
                                </select>
                            </div>
                            <div id="ft-val-container" class="form-group" style="display:none;">
                                <label class="form-label" id="ft-val-label">Valor</label>
                                <input type="number" id="ft-value" class="form-input" min="1" value="1">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Vencimiento / Primera Alerta</label>
                            <input type="datetime-local" id="ft-start" class="form-input" value="${minTime}" min="${minTime}" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:20px; height:50px; font-weight:700;">
                            <i class="ph ph-check-circle"></i> GUARDAR PROGRAMACIÓN
                        </button>
                    </form>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = modalHtml;
        modalContainer.classList.remove('hidden');

        const typeSelect = document.getElementById('ft-type');
        const valContainer = document.getElementById('ft-val-container');
        const valLabel = document.getElementById('ft-val-label');

        typeSelect.addEventListener('change', () => {
            if (typeSelect.value === 'once') {
                valContainer.style.display = 'none';
            } else {
                valContainer.style.display = 'block';
                valLabel.textContent = typeSelect.value === 'hours' ? 'Cada X Horas' : 'Cada X Días';
            }
        });

        document.getElementById('form-full-task').addEventListener('submit', async (e) => {
            e.preventDefault();
            const task = {
                title: document.getElementById('ft-title').value,
                type: typeSelect.value === 'once' ? 'once' : 'periodic',
                frequency_unit: typeSelect.value,
                frequency_value: parseInt(document.getElementById('ft-value').value) || 0,
                next_run: new Date(document.getElementById('ft-start').value).toISOString(),
                completed: 0,
                deleted: 0,
                created_at: new Date().toISOString()
            };
            const res = await window.DataManager.saveAndSync('reminders', task);
            if (res.success) {
                modalContainer.classList.add('hidden');
                loadTasks();
                window.Sync.showToast('Tarea guardada', 'success');
            }
        });

        modalContainer.querySelector('.btn-close-modal').addEventListener('click', () => {
            modalContainer.classList.add('hidden');
        });
    };

    // 4. Init
    await loadTasks();
};

