// Marketing / Promotions View
window.Views = window.Views || {};

window.Views.marketing = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <div style="font-size:0.9rem; color:var(--primary); font-weight:bold; letter-spacing:1px; text-transform:uppercase;">El Maravilloso</div>
                <h1 style="margin-bottom:8px; color:var(--text-primary);">Promociones</h1>
            </div>
            <button class="btn btn-primary" id="btn-new-promo">
                <i class="ph ph-plus-circle"></i> Nueva Campaña
            </button>
        </div>

        <!-- Promo Grid -->
        <div id="promo-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap:24px;">
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
        const allPromos = await window.db.promotions.toArray();
        const promos = allPromos.filter(p => !p.deleted);
        const activePromos = promos.filter(p => !p.deleted); // Filter deleted
        // Clear old helpers to avoid duplicates
        delete window.insertFormat;

        if (activePromos.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:60px; background:white; border-radius:12px; border:2px dashed var(--border);">
                    <i class="ph ph-rocket-launch" style="font-size:3rem; color:var(--primary); margin-bottom:16px; opacity:0.5;"></i>
                    <h3 style="color:var(--text-primary);">Sin campañas activas</h3>
                    <p style="color:var(--text-muted);">¡Dale a 'Nueva Campaña' para atraer clientes!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = activePromos.reverse().map(p => `
            <div class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column; border-top: 4px solid var(--primary);">
                <div style="height:200px; background:#f1f5f9; position:relative; overflow:hidden;">
                    ${p.imageData
                ? `<img src="${p.imageData}" style="width:100%; height:100%; object-fit:cover;">`
                : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted);"><i class="ph ph-image" style="font-size:3rem;"></i></div>`
            }
                    <div style="position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.95); color:var(--primary); padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:800; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        ${p.isActive ? 'ACTIVA' : 'PAUSADA'}
                    </div>
                </div>
                <div style="padding:20px; flex:1; display:flex; flex-direction:column;">
                    <h3 style="margin-bottom:8px; color:var(--text-primary); font-size:1.1rem;">${p.title}</h3>
                    
                    <!-- Preview Mini -->
                    <div style="background:#e5ddd5; padding:10px; border-radius:8px; margin-bottom:16px; font-size:0.85rem; color:#111; max-height:80px; overflow:hidden; position:relative;">
                        ${formatWhatsAppText(p.text)}
                        <div style="position:absolute; bottom:0; left:0; width:100%; height:20px; background:linear-gradient(to top, #e5ddd5, transparent);"></div>
                    </div>
                    
                    <button class="btn btn-primary btn-launch-whatsapp" data-id="${p.id}" style="justify-content:center; background:#25D366; border:none; color:white; box-shadow:0 4px 10px rgba(37, 211, 102, 0.4); margin-bottom:8px; font-weight:bold;">
                        <i class="ph ph-whatsapp-logo" style="font-weight:bold; font-size:1.2rem;"></i> ENVIAR AHORA
                    </button>
                    
                    <button class="btn btn-delete-promo" data-id="${p.id}" style="width:100%; padding: 8px; font-size: 0.8rem; background: transparent; border: 1px solid var(--border); color:var(--text-muted);">
                        Eliminar
                    </button>
                </div>
            </div>
        `).join('');

        // Events
        document.querySelectorAll('.btn-launch-whatsapp').forEach(btn => btn.addEventListener('click', (e) => handleLaunchPromo(Number(e.currentTarget.dataset.id))));
        document.querySelectorAll('.btn-delete-promo').forEach(btn => btn.addEventListener('click', async (e) => {
            if (confirm('¿Eliminar campaña?')) {
                try {
                    const id = Number(e.currentTarget.dataset.id);

                    // Soft Delete: Mark as deleted in cloud first (if connected)
                    if (window.Sync.client) {
                        const { error } = await window.Sync.client
                            .from('promotions')
                            .update({ deleted: true })
                            .eq('id', id);
                        if (error) throw error;
                    }

                    // Then mark as deleted locally
                    await window.db.promotions.update(id, { deleted: true });
                    renderPromos();
                } catch (err) {
                    alert('Error al eliminar: ' + err.message);
                }
            }
        }));
    } catch (e) { console.error(e); }
}

// --- LOGIC ---
async function handleLaunchPromo(id) {
    const promo = await window.db.promotions.get(id);
    if (!promo) return;

    // 1. Copy Image Logic
    if (promo.imageData) {
        try {
            const response = await fetch(promo.imageData);
            const blob = await response.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            // alert('¡Imagen copiada! Pégala en el chat.');
        } catch (err) {
            console.error(err);
        }
    }

    // 2. Open WhatsApp Web Forced
    // Using web.whatsapp.com explicitly
    const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(promo.text)}`;
    window.open(url, '_blank');
}

// --- MODAL & PREVIEW ---
function showPromoModal() {
    const modalContainer = document.getElementById('modal-container');

    // Toolbar Logic
    window.insertFormat = (start, end) => {
        const textarea = document.getElementById('promo-text');
        if (!textarea) return;
        const s = textarea.selectionStart;
        const e = textarea.selectionEnd;
        const val = textarea.value;
        const before = val.substring(0, s);
        const selected = val.substring(s, e);
        const after = val.substring(e);

        textarea.value = before + start + selected + end + after;
        textarea.focus();
        textarea.selectionStart = s + start.length;
        textarea.selectionEnd = e + start.length;

        // Trigger live preview update
        textarea.dispatchEvent(new Event('input'));
    };

    modalContainer.innerHTML = `
        <div class="modal" style="max-width:960px;">
            <div class="modal-header">
                <h3 class="modal-title" style="color:var(--primary);">Crear Campaña Visual</h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            
            <div class="modal-body">
                <div style="display:grid; grid-template-columns: 1fr 340px; gap:32px;">
                    
                    <!-- LEFT: EDITOR -->
                    <div style="display:flex; flex-direction:column; gap:16px;">
                        <form id="promo-form" style="display:flex; flex-direction:column; gap:16px; height:100%;">
                            <div>
                                <label class="form-label">Título de Campaña</label>
                                <input type="text" name="title" id="title-input" class="form-input" placeholder="Ej. Oferta Lunes" required>
                            </div>
                            
                            <div>
                                <label class="form-label">Imágenes (Máximo 4)</label>
                                <div style="border:2px dashed var(--border); padding:20px; text-align:center; border-radius:8px; cursor:pointer; background:var(--bg-input); transition:0.2s;" id="drop-zone">
                                    <div id="upload-placeholder">
                                        <i class="ph ph-images" style="font-size:2rem; color:var(--text-muted); margin-bottom:8px;"></i>
                                        <div style="font-weight:600; color:var(--text-primary);">Crear Collage Automático</div>
                                        <div style="font-size:0.85rem; color:var(--text-secondary);">Sube hasta 4 fotos y las uniré en una sola</div>
                                    </div>
                                    <input type="file" id="promo-image-input" accept="image/*" multiple style="display:none;">
                                </div>
                            </div>

                            <div style="flex:1; display:flex; flex-direction:column;">
                                <label class="form-label">Mensaje</label>
                                <!-- TOOLBAR -->
                                <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap; background:var(--bg-input); padding:8px; border-radius:8px; border:1px solid var(--border);">
                                    <button type="button" class="btn-tool" onclick="insertFormat('*', '*')"><strong>B</strong></button>
                                    <button type="button" class="btn-tool" onclick="insertFormat('_', '_')"><em>I</em></button>
                                    <button type="button" class="btn-tool" onclick="insertFormat('~', '~')"><span style="text-decoration:line-through;">S</span></button>
                                    <div style="width:1px; background:#ccc; margin:0 4px;"></div>
                                    <button type="button" class="btn-tool" onclick="insertFormat('🔥 ', '')">🔥</button>
                                    <button type="button" class="btn-tool" onclick="insertFormat('💰 ', '')">💰</button>
                                    <button type="button" class="btn-tool" onclick="insertFormat('✅ ', '')">✅</button>
                                    <button type="button" class="btn-tool" onclick="insertFormat('� ', '')">�</button>
                                </div>
                                
                                <textarea id="promo-text" name="text" class="form-input" style="flex:1; min-height:120px; font-family:monospace;" placeholder="Escribe aquí..." required></textarea>
                            </div>
                        </form>
                    </div>

                    <!-- RIGHT: PREVIEW -->
                    <div style="background:#e5ddd5; border-radius:16px; padding:16px; box-shadow:0 10px 15px rgba(0,0,0,0.1); border:8px solid #333; display:flex; flex-direction:column;">
                        <div style="background:#075e54; margin:-16px -16px 16px -16px; padding:12px; border-radius:8px 8px 0 0; color:white; display:flex; align-items:center; gap:8px;">
                            <div style="width:30px; height:30px; background:white; border-radius:50%;"></div>
                            <div style="font-size:0.9rem; font-weight:600;">Tu Negocio</div>
                        </div>

                        <div style="background:white; border-radius:8px; padding:6px; box-shadow:0 1px 1px rgba(0,0,0,0.1);">
                            <img id="preview-img-chat" style="width:100%; border-radius:4px; display:none; margin-bottom:6px; background:#f0f0f0; min-height:100px; object-fit:cover;">
                            <div id="chat-text-preview" style="font-size:0.9rem; line-height:1.4; color:#111; white-space:pre-wrap;"></div>
                            <div style="text-align:right; font-size:0.7rem; color:#999; margin-top:4px;">Ahora <i class="ph ph-checks" style="color:#34b7f1;"></i></div>
                        </div>
                    </div>

                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-container').classList.add('hidden')">Cancelar</button>
                <button class="btn btn-primary" id="save-promo-btn">Guardar Campaña</button>
            </div>
        </div>
    `;

    // Inject Styles
    if (!document.getElementById('tool-styles')) {
        const style = document.createElement('style');
        style.id = 'tool-styles';
        style.innerHTML = `.btn-tool { padding: 6px 10px; background: white; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; transition:0.2s; } .btn-tool:hover { background:var(--primary); color:white; border-color:var(--primary); }`;
        document.head.appendChild(style);
    }

    modalContainer.classList.remove('hidden');

    // --- LOGIC ---

    // 1. Text Preview
    const textarea = document.getElementById('promo-text');
    const previewDiv = document.getElementById('chat-text-preview');
    textarea.addEventListener('input', () => {
        previewDiv.innerHTML = formatWhatsAppText(textarea.value);
    });

    // 2. Collage Logic
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('promo-image-input');
    const previewImg = document.getElementById('preview-img-chat');
    const placeholder = document.getElementById('upload-placeholder');
    let imageBase64 = null;

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        if (files.length > 4) { alert('Máximo 4 imágenes por ahora.'); return; }

        placeholder.innerHTML = 'Generando Collage... 🎨';

        try {
            imageBase64 = await createCollage(files);

            // Update UI
            previewImg.src = imageBase64;
            previewImg.style.display = 'block';
            placeholder.innerHTML = `<i class="ph ph-check-circle" style="font-size:2rem; color:var(--success);"></i><div style="color:var(--success); font-weight:bold;">Collage Listo (${files.length} fotos)</div>`;
            dropZone.style.borderColor = 'var(--success)';
            dropZone.style.background = '#f0fdf4';

        } catch (err) {
            console.error(err);
            alert('Error creando collage');
            placeholder.innerHTML = 'Error. Intenta de nuevo.';
        }
    });

    // 3. Save
    document.getElementById('save-promo-btn').addEventListener('click', async () => {
        const titleInput = document.getElementById('title-input');
        if (!titleInput.value || !textarea.value) { alert('Falta datos'); return; }

        const newPromo = {
            title: titleInput.value,
            text: textarea.value,
            imageData: imageBase64,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        try {
            newPromo.id = Date.now() + Math.floor(Math.random() * 1000);
            await window.db.promotions.add(newPromo);
            modalContainer.classList.add('hidden');
            renderPromos();
        } catch (e) { alert('Error: ' + e.message); }
    });
}

// --- COLLAGE GENERATOR HELPER ---
async function createCollage(files) {
    // Load all images
    const images = await Promise.all(files.map(file => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }));

    // Setup Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Target Size (Square-ish for WhatsApp)
    const size = 800;
    canvas.width = size;
    canvas.height = size;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const count = images.length;

    if (count === 1) {
        drawImageCover(ctx, images[0], 0, 0, size, size);
    }
    else if (count === 2) {
        // Vertical Split
        drawImageCover(ctx, images[0], 0, 0, size / 2, size);
        drawImageCover(ctx, images[1], size / 2, 0, size / 2, size);
        // Divider
        drawDivider(ctx, size / 2, 0, 2, size);
    }
    else if (count === 3) {
        // 1 Left Big, 2 Right Small
        drawImageCover(ctx, images[0], 0, 0, size / 2, size);
        drawImageCover(ctx, images[1], size / 2, 0, size / 2, size / 2);
        drawImageCover(ctx, images[2], size / 2, size / 2, size / 2, size / 2);

        drawDivider(ctx, size / 2, 0, 2, size); // V
        drawDivider(ctx, size / 2, size / 2, size / 2, 2, true); // H
    }
    else if (count === 4) {
        // 2x2 Grid
        drawImageCover(ctx, images[0], 0, 0, size / 2, size / 2);
        drawImageCover(ctx, images[1], size / 2, 0, size / 2, size / 2);
        drawImageCover(ctx, images[2], 0, size / 2, size / 2, size / 2);
        drawImageCover(ctx, images[3], size / 2, size / 2, size / 2, size / 2);

        drawDivider(ctx, size / 2, 0, 2, size); // V
        drawDivider(ctx, 0, size / 2, size, 2, true); // H
    }

    return canvas.toDataURL('image/jpeg', 0.85);
}

function drawImageCover(ctx, img, x, y, w, h) {
    // Aspect Ratio "Cover" fit
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;
    let sx, sy, sw, sh;

    if (imgRatio > targetRatio) {
        sh = img.height;
        sw = img.height * targetRatio;
        sy = 0;
        sx = (img.width - sw) / 2;
    } else {
        sw = img.width;
        sh = img.width / targetRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawDivider(ctx, x, y, w, h, isHorizontal = false) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
}

// Simple WhatsApp Markdown Parser
function formatWhatsAppText(text) {
    if (!text) return '<span style="color:#d1d5db;">Escribe tu mensaje...</span>';
    let formatted = text
        .replace(/\*(.*?)\*/g, '<b>$1</b>')   // Bold
        .replace(/_(.*?)_/g, '<i>$1</i>')     // Italic
        .replace(/~(.*?)~/g, '<strike>$1</strike>') // Strike
        .replace(/\n/g, '<br>');              // Newlines
    return formatted;
}
