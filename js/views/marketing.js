// Marketing / Promotions View
window.Views = window.Views || {};

window.Views.marketing = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <div style="font-size:0.9rem; color:var(--primary); font-weight:bold; letter-spacing:1px; text-transform:uppercase;">El Maravilloso</div>
                <h1 style="margin-bottom:8px; color:var(--text-primary);">Marketing y Promociones</h1>
                <p style="color:var(--text-muted); font-size:0.9rem;">Crea y gestiona tus campañas de WhatsApp.</p>
            </div>
            <button class="btn btn-primary" id="btn-new-promo" style="box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">
                <i class="ph ph-megaphone"></i> Nueva Campaña
            </button>
        </div>

        <!-- Promo Grid -->
        <div id="promo-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:24px;">
            <div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">Cargando campañas...</div>
        </div>
    `;

    renderPromos();
    document.getElementById('btn-new-promo').addEventListener('click', showPromoModal);
};

// --- RENDER LOGIC ---
async function renderPromos() {
    const grid = document.getElementById('promo-grid');
    if (!grid) return;

    try {
        const promos = (await window.db.promotions.toArray()).filter(p => !p.deleted);

        delete window.insertFormat; // Limpiar helpers

        if (promos.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:60px; background:var(--bg-card); border-radius:16px; border:2px dashed var(--border);">
                    <i class="ph ph-megaphone" style="font-size:4rem; color:var(--primary); margin-bottom:16px; opacity:0.8;"></i>
                    <h3 style="color:var(--text-primary); margin-bottom:8px;">Sin campañas activas</h3>
                    <p style="color:var(--text-muted);">¡Crea tu primera campaña para WhatsApp!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = promos.map(p => `
            <div class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column; border-top: 4px solid ${p.isActive ? 'var(--success)' : 'var(--border)'};">
                ${p.imageData
                ? `<div style="height:200px; overflow:hidden;"><img src="${p.imageData}" style="width:100%; height:100%; object-fit:cover;"></div>`
                : `<div style="height:100px; background:var(--bg-input); display:flex; align-items:center; justify-content:center; color:var(--text-muted);"><i class="ph ph-image" style="font-size:2.5rem;"></i></div>`
            }
                <div style="padding:20px; flex:1; display:flex; flex-direction:column; background:var(--bg-card);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h3 style="color:var(--text-primary); font-size:1rem; font-weight:700; margin:0;">${p.title}</h3>
                        <span style="font-size:0.75rem; font-weight:700; padding:3px 8px; border-radius:20px; background:${p.isActive ? 'rgba(16,185,129,0.1)' : 'var(--bg-input)'}; color:${p.isActive ? 'var(--success)' : 'var(--text-muted)'};">${p.isActive ? 'ACTIVA' : 'INACTIVA'}</span>
                    </div>
                    <div style="background:var(--bg-input); padding:10px; border-radius:8px; margin-bottom:16px; font-size:0.85rem; color:var(--text-secondary); max-height:80px; overflow:hidden; position:relative;">
                        ${formatWhatsAppText(p.text)}
                        <div style="position:absolute; bottom:0; left:0; width:100%; height:20px; background:linear-gradient(to top, var(--bg-input), transparent);"></div>
                    </div>
                    <div style="display:flex; gap:8px; margin-top:auto;">
                        <button class="btn btn-primary btn-launch-whatsapp" data-id="${p.id}" style="flex:1; justify-content:center; background:#25D366; border:none; color:white; font-size:0.85rem; padding:8px;">
                            <i class="ph ph-whatsapp-logo" style="font-size:1.1rem;"></i> Enviar por WhatsApp
                        </button>
                        <button class="btn btn-delete-promo" data-id="${p.id}" style="padding: 8px 12px; font-size: 0.9rem; background: transparent; border: 1px solid var(--border); color:var(--text-muted);">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Events
        document.querySelectorAll('.btn-launch-whatsapp').forEach(btn => btn.addEventListener('click', (e) => handleLaunchPromo(e.currentTarget.dataset.id)));
        document.querySelectorAll('.btn-delete-promo').forEach(btn => btn.addEventListener('click', async (e) => {
            if (confirm('¿Eliminar campaña definitivamente?')) {
                try {
                    const id = Number(e.currentTarget.dataset.id);
                    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
                    await window.DataManager.deleteAndSync('promotions', id);
                    renderPromos();
                } catch (err) {
                    alert('Error al eliminar: ' + err.message);
                }
            }
        }));
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<div style="color:red; grid-column:1/-1;">Error cargando promociones.</div>';
    }
}

// --- LOGIC ---
async function handleLaunchPromo(id) {
    const promo = await window.db.promotions.get(Number(id));
    if (!promo) return;

    if (promo.imageData && !promo.imageData.startsWith('http')) {
        try {
            const response = await fetch(promo.imageData);
            const blob = await response.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        } catch (err) {
            console.error('Error copiando imagen:', err);
        }
    }

    const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(promo.text)}`;
    window.open(url, '_blank');
}

// --- MODAL ---
function showPromoModal() {
    const modalContainer = document.getElementById('modal-container');

    window.insertFormat = (start, end) => {
        const textarea = document.getElementById('promo-text');
        if (!textarea) return;
        const s = textarea.selectionStart;
        const e = textarea.selectionEnd;
        const val = textarea.value;
        textarea.value = val.substring(0, s) + start + val.substring(s, e) + end + val.substring(e);
        textarea.focus();
        textarea.selectionStart = s + start.length;
        textarea.selectionEnd = e + start.length;
        textarea.dispatchEvent(new Event('input'));
    };

    modalContainer.innerHTML = `
        <div class="modal" style="max-width:700px; width:95%;">
            <div class="modal-header">
                <h3 class="modal-title" style="color:var(--primary); display:flex; align-items:center; gap:8px;">
                    <i class="ph ph-megaphone"></i> Nueva Campaña
                </h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            <div class="modal-body" style="padding:24px; display:flex; flex-direction:column; gap:20px;">
                <div>
                    <label class="form-label">Nombre de la Campaña</label>
                    <input type="text" id="title-input" class="form-input" placeholder="Ej. Oferta de Verano" required>
                </div>

                <div>
                    <label class="form-label">Imagen (Opcional)</label>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <input type="file" id="promo-image-input" accept="image/*" style="display:none;">
                        <button type="button" class="btn btn-secondary" id="btn-upload-image" style="flex-shrink:0;">
                            <i class="ph ph-image"></i> Seleccionar Imagen
                        </button>
                        <span id="image-status" style="font-size:0.85rem; color:var(--text-muted);">Sin imagen</span>
                    </div>
                    <div id="image-preview" style="margin-top:12px; display:none;">
                        <img id="preview-img" style="max-width:100%; max-height:200px; border-radius:8px; object-fit:cover;">
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; flex:1;">
                    <label class="form-label">Texto / Mensaje / Hashtags</label>
                    <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap; background:var(--bg-input); padding:6px; border-radius:8px; border:1px solid var(--border);">
                        <button type="button" class="btn-tool" onclick="insertFormat('*', '*')"><strong>B</strong></button>
                        <button type="button" class="btn-tool" onclick="insertFormat('_', '_')"><em>I</em></button>
                        <div style="width:1px; background:var(--border); margin:0 4px;"></div>
                        <button type="button" class="btn-tool" onclick="insertFormat('🔥 ', '')">🔥</button>
                        <button type="button" class="btn-tool" onclick="insertFormat('🚀 ', '')">🚀</button>
                        <button type="button" class="btn-tool" onclick="insertFormat('👉 ', '')">👉</button>
                        <button type="button" class="btn-tool" onclick="insertFormat('\\n\\n#Oferta #ElMaravilloso', '')">#️⃣ Hashtags</button>
                    </div>
                    <textarea id="promo-text" class="form-input" style="min-height:160px;" placeholder="Escribe tu mensaje aquí..."></textarea>
                </div>

                <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                    <input type="checkbox" id="promo-active" checked style="width:18px; height:18px; accent-color:var(--primary);">
                    <span style="font-weight:600;">Campaña Activa</span>
                </label>
            </div>
            <div class="modal-footer" style="padding:20px 24px; background:var(--bg-card); display:flex; justify-content:space-between; align-items:center;">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-container').classList.add('hidden')">Cancelar</button>
                <button class="btn btn-primary" id="save-promo-btn">
                    <i class="ph ph-floppy-disk"></i> Guardar Campaña
                </button>
            </div>
        </div>
    `;

    if (!document.getElementById('tool-styles')) {
        const style = document.createElement('style');
        style.id = 'tool-styles';
        style.innerHTML = `.btn-tool { padding: 4px 8px; background: transparent; border: 1px solid transparent; border-radius: 4px; cursor: pointer; transition:0.2s; font-size:0.9rem; } .btn-tool:hover { background:var(--bg-card); border-color:var(--border); }`;
        document.head.appendChild(style);
    }

    modalContainer.classList.remove('hidden');

    // Image upload
    let imageData = null;
    document.getElementById('btn-upload-image').addEventListener('click', () => document.getElementById('promo-image-input').click());
    document.getElementById('promo-image-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            imageData = ev.target.result;
            document.getElementById('image-status').textContent = file.name;
            document.getElementById('preview-img').src = imageData;
            document.getElementById('image-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    // Save
    document.getElementById('save-promo-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const title = document.getElementById('title-input').value.trim();
        const text = document.getElementById('promo-text').value.trim();
        const isActive = document.getElementById('promo-active').checked;

        if (!title || !text) {
            alert('Por favor, completa el título y el mensaje.');
            return;
        }

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';

            const postData = {
                title,
                text,
                imageData: imageData || null,
                isActive,
                deleted: false,
                createdAt: new Date().toISOString()
            };

            const result = await window.DataManager.saveAndSync('promotions', postData);
            if (!result.success) throw new Error(result.error);

            modalContainer.classList.add('hidden');
            renderPromos();
        } catch (err) {
            alert('Error al guardar: ' + err.message);
            btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar Campaña';
            btn.disabled = false;
        }
    });
}

function formatWhatsAppText(text) {
    if (!text) return '<span style="color:#d1d5db;">Escribe tu mensaje...</span>';
    return text.replace(/\*(.*?)\*/g, '<b>$1</b>')
        .replace(/_(.*?)_/g, '<i>$1</i>')
        .replace(/\n/g, '<br>');
}
