// Marketing / Promotions View
window.Views = window.Views || {};

window.Views.marketing = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <div style="font-size:0.9rem; color:var(--primary); font-weight:bold; letter-spacing:1px; text-transform:uppercase;">El Maravilloso</div>
                <h1 style="margin-bottom:8px; color:var(--text-primary);">Marketing y Automatización</h1>
                <p style="color:var(--text-muted); font-size:0.9rem;">Programa tus campañas para Instagram, TikTok y WhatsApp.</p>
            </div>
            <button class="btn btn-primary" id="btn-new-promo" style="box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">
                <i class="ph ph-rocket-launch"></i> Nueva Campaña
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
        // Obtenemos campañas antiguas (legacy) y nuevas (social_posts)
        let legacyPromos = [];
        try { legacyPromos = await window.db.promotions.toArray(); } catch (e) { }

        let socialPosts = [];
        try { socialPosts = await window.db.social_posts.toArray(); } catch (e) { }

        const allPromos = [...legacyPromos.map(p => ({ ...p, _type: 'legacy' })), ...socialPosts.map(p => ({ ...p, _type: 'social' }))]
            .filter(p => !p.deleted)
            .sort((a, b) => {
                const dateA = a.scheduled_for || a.createdAt || Date.now();
                const dateB = b.scheduled_for || b.createdAt || Date.now();
                return new Date(dateB) - new Date(dateA); // Descendente
            });

        delete window.insertFormat; // Limpiar helpers

        if (allPromos.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:60px; background:var(--bg-card); border-radius:16px; border:2px dashed var(--border); box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                    <i class="ph ph-robot" style="font-size:4rem; color:var(--primary); margin-bottom:16px; opacity:0.8;"></i>
                    <h3 style="color:var(--text-primary); margin-bottom:8px;">Sin campañas activas</h3>
                    <p style="color:var(--text-muted);">¡Crea tu primera campaña automatizada para redes sociales!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = allPromos.map(p => {
            const isVideo = p.media_type === 'video';
            const imageUrl = p.media_url || p.imageData;

            // Etiquetas de estado
            let statusBadge = '';
            let statusColor = '';
            const status = p.status || (p.isActive ? 'published' : 'draft');

            if (status === 'published') { statusBadge = 'PUBLICADO'; statusColor = 'var(--success)'; }
            else if (status === 'pending') { statusBadge = 'PROGRAMADO⏳'; statusColor = '#f59e0b'; }
            else if (status === 'failed') { statusBadge = 'ERROR❌'; statusColor = '#ef4444'; }
            else { statusBadge = 'BORRADOR'; statusColor = '#6b7280'; }

            // Iconos de redes
            const nets = p.networks || [];
            const netIcons = nets.map(n => {
                if (n === 'instagram') return '<i class="ph ph-instagram-logo" style="color:#e1306c;"></i>';
                if (n === 'tiktok') return '<i class="ph ph-tiktok-logo" style="color:#000;"></i>';
                if (n === 'whatsapp') return '<i class="ph ph-whatsapp-logo" style="color:#25D366;"></i>';
                return '';
            }).join(' ');

            return `
            <div class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column; border-top: 4px solid ${statusColor}; position:relative;">
                <div style="position:absolute; top:12px; right:12px; z-index:10; background:rgba(255,255,255,0.95); color:${statusColor}; padding:6px 12px; border-radius:20px; font-size:0.75rem; font-weight:800; box-shadow:0 2px 10px rgba(0,0,0,0.15);">
                    ${statusBadge}
                </div>

                <div style="height:220px; background:#111; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                    ${imageUrl
                    ? (isVideo
                        ? `<video src="${imageUrl}" controls style="width:100%; height:100%; object-fit:cover; opacity:0.9;"></video>`
                        : `<img src="${imageUrl}" style="width:100%; height:100%; object-fit:cover;">`)
                    : `<div style="color:var(--text-muted);"><i class="ph ph-image" style="font-size:3rem;"></i></div>`
                }
                    ${netIcons ? `<div style="position:absolute; bottom:12px; left:12px; background:rgba(255,255,255,0.9); padding:4px 8px; border-radius:8px; font-size:1.1rem; display:flex; gap:6px; box-shadow:0 2px 8px rgba(0,0,0,0.2);">${netIcons}</div>` : ''}
                </div>

                <div style="padding:20px; flex:1; display:flex; flex-direction:column; background:var(--bg-card);">
                    <h3 style="margin-bottom:8px; color:var(--text-primary); font-size:1.1rem; font-weight:700;">${p.title}</h3>
                    ${p.scheduled_for ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px; display:flex; align-items:center; gap:4px;"><i class="ph ph-calendar"></i> ${window.Utils.formatDate(p.scheduled_for.split('T')[0])} ${p.scheduled_for.split('T')[1].substring(0, 5)}</div>` : ''}
                    
                    <!-- Preview Mini -->
                    <div style="background:var(--bg-input); padding:10px; border-radius:8px; margin-bottom:16px; font-size:0.85rem; color:var(--text-secondary); max-height:80px; overflow:hidden; position:relative;">
                        ${formatWhatsAppText(p.text)}
                        <div style="position:absolute; bottom:0; left:0; width:100%; height:20px; background:linear-gradient(to top, var(--bg-input), transparent);"></div>
                    </div>
                    
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-primary btn-launch-whatsapp" data-id="${p.id}" data-type="${p._type}" style="flex:1; justify-content:center; background:#25D366; border:none; color:white; font-size:0.85rem; padding:8px;">
                            <i class="ph ph-whatsapp-logo" style="font-size:1.1rem;"></i> Enviar Manual
                        </button>
                        <button class="btn btn-delete-promo" data-id="${p.id}" data-type="${p._type}" style="padding: 8px 12px; font-size: 0.9rem; background: transparent; border: 1px solid var(--border); color:var(--text-muted);">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        // Events
        document.querySelectorAll('.btn-launch-whatsapp').forEach(btn => btn.addEventListener('click', (e) => handleLaunchPromo(e.currentTarget.dataset.id, e.currentTarget.dataset.type)));
        document.querySelectorAll('.btn-delete-promo').forEach(btn => btn.addEventListener('click', async (e) => {
            if (confirm('¿Eliminar campaña definitivamente?')) {
                try {
                    const id = Number(e.currentTarget.dataset.id);
                    const type = e.currentTarget.dataset.type;
                    const table = type === 'legacy' ? 'promotions' : 'social_posts';

                    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
                    await window.DataManager.deleteAndSync(table, id);
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
async function handleLaunchPromo(id, type) {
    const table = type === 'legacy' ? 'promotions' : 'social_posts';
    const promo = await window.db[table].get(Number(id));
    if (!promo) return;

    // Solo copiar imagen si es foto base64 (el video no se puede copiar al portapapeles directo de la url facil)
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

// --- MODAL & PREVIEW ---
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

    // Fechas límites para el datetime-local
    const now = new Date();
    // Sumamos 5 minutos por seguridad
    now.setMinutes(now.getMinutes() + 5);
    const minDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

    modalContainer.innerHTML = `
        <div class="modal" style="max-width:1100px; width:95%;">
            <div class="modal-header">
                <h3 class="modal-title" style="color:var(--primary); display:flex; align-items:center; gap:8px;">
                    <i class="ph ph-robot"></i> Programador de Redes Sociales
                </h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            
            <div class="modal-body" style="padding:24px;">
                <div style="display:grid; grid-template-columns: 1fr 380px; gap:40px;">
                    
                    <!-- LEFT: EDITOR -->
                    <div style="display:flex; flex-direction:column; gap:24px;">
                        
                        <div style="display:flex; gap:16px;">
                            <div style="flex:1;">
                                <label class="form-label">Nombre Interno de Campaña</label>
                                <input type="text" id="title-input" class="form-input" placeholder="Ej. Cyber Monday 2026" required>
                            </div>
                        </div>

                        <!-- ARCHIVO MULTIMEDIA -->
                        <div style="background:var(--bg-card); padding:20px; border-radius:12px; border:1px solid var(--border);">
                            <label class="form-label" style="display:flex; justify-content:space-between;">
                                <span>Contenido Visual (Requerido para IG/TikTok)</span>
                                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">MP4, JPG, PNG (Max 50MB)</span>
                            </label>
                            
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:12px;">
                                <button type="button" class="btn btn-secondary" id="btn-upload-video" style="justify-content:center; padding:12px;">
                                    <i class="ph ph-video-camera" style="font-size:1.2rem;"></i> Subir Video (TikTok/IG)
                                </button>
                                <button type="button" class="btn btn-secondary" id="btn-upload-images" style="justify-content:center; padding:12px;">
                                    <i class="ph ph-images" style="font-size:1.2rem;"></i> Crear Collage Fotos
                                </button>
                            </div>
                            
                            <input type="file" id="promo-video-input" accept="video/mp4,video/quicktime" style="display:none;">
                            <input type="file" id="promo-image-input" accept="image/*" multiple style="display:none;">
                            
                            <div id="media-status" style="font-size:0.85rem; color:var(--text-secondary); text-align:center; padding:8px; background:var(--bg-input); border-radius:8px; border:1px dashed var(--border);">
                                Ningún archivo seleccionado.
                            </div>
                        </div>

                        <!-- MENSAJE -->
                        <div style="display:flex; flex-direction:column; flex:1;">
                            <label class="form-label">Texto / Descripción / Hashtags</label>
                            <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap; background:var(--bg-input); padding:6px; border-radius:8px; border:1px solid var(--border);">
                                <button type="button" class="btn-tool" onclick="insertFormat('*', '*')"><strong>B</strong></button>
                                <button type="button" class="btn-tool" onclick="insertFormat('_', '_')"><em>I</em></button>
                                <div style="width:1px; background:var(--border); margin:0 4px;"></div>
                                <button type="button" class="btn-tool" onclick="insertFormat('🔥 ', '')">🔥</button>
                                <button type="button" class="btn-tool" onclick="insertFormat('🚀 ', '')">🚀</button>
                                <button type="button" class="btn-tool" onclick="insertFormat('👉 ', '')">👉</button>
                                <button type="button" class="btn-tool" onclick="insertFormat('\\n\\n#Oferta #ElMaravilloso', '')">#️⃣ Hashtags</button>
                            </div>
                            <textarea id="promo-text" class="form-input" style="flex:1; min-height:140px;" placeholder="Escribe tu descripción épica aquí..."></textarea>
                        </div>
                    </div>

                    <!-- RIGHT: CONFIG & PREVIEW -->
                    <div style="display:flex; flex-direction:column; gap:24px;">
                        
                        <!-- PROGRAMACION PANEL -->
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                            <h4 style="margin-bottom:16px; color:#0f172a; display:flex; align-items:center; gap:8px;">
                                <i class="ph ph-clock-user" style="color:var(--primary); font-size:1.2rem;"></i> Cuándo y Dónde
                            </h4>
                            
                            <label class="form-label" style="font-size:0.85rem; color:#475569;">Redes a Publicar (Vía Make.com)</label>
                            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;" class="checkbox-label">
                                    <input type="checkbox" value="instagram" class="network-cb" checked style="width:18px; height:18px; accent-color:#e1306c;">
                                    <span style="font-weight:600; color:#333;"><i class="ph ph-instagram-logo" style="color:#e1306c;"></i> Instagram (Post/Reel)</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;" class="checkbox-label">
                                    <input type="checkbox" value="tiktok" class="network-cb" checked style="width:18px; height:18px; accent-color:#000;">
                                    <span style="font-weight:600; color:#333;"><i class="ph ph-tiktok-logo" style="color:#000;"></i> TikTok</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;" class="checkbox-label">
                                    <input type="checkbox" value="whatsapp" class="network-cb" style="width:18px; height:18px; accent-color:#25d366;">
                                    <span style="font-weight:600; color:#333;"><i class="ph ph-whatsapp-logo" style="color:#25d366;"></i> WhatsApp (Solo Info)</span>
                                </label>
                            </div>

                            <label class="form-label" style="font-size:0.85rem; color:#475569;">Fecha y Hora de Publicación</label>
                            <input type="datetime-local" id="schedule-date" class="form-input" style="border-color:#cbd5e1; background:white;" min="${minDate}" required>
                            <p style="font-size:0.75rem; color:#64748b; margin-top:8px;">
                                El robot ejecutará la tarea en esta fecha exacta. Debes asegurarte que Make.com esté encendido.
                            </p>
                        </div>

                        <!-- LIVE PREVIEW CUTE -->
                        <div style="background:white; border-radius:16px; padding:16px; box-shadow:0 10px 25px rgba(0,0,0,0.08); border:1px solid var(--border); display:flex; flex-direction:column; flex:1;">
                            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid var(--border);">
                                <div style="width:36px; height:36px; background:var(--primary); border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold;">M</div>
                                <div>
                                    <div style="font-weight:bold; font-size:0.9rem;">El Maravilloso</div>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">Vista Previa</div>
                                </div>
                            </div>

                            <div style="flex:1; display:flex; flex-direction:column; background:#fafafa; border-radius:8px; overflow:hidden;">
                                <div id="preview-media-container" style="width:100%; height:200px; background:#e2e8f0; display:flex; align-items:center; justify-content:center;">
                                    <i class="ph ph-image" style="font-size:3rem; color:#cbd5e1;"></i>
                                </div>
                                <div id="chat-text-preview" style="padding:12px; font-size:0.85rem; line-height:1.5; color:#333; overflow-y:auto; max-height:150px;">
                                    Tu descripción aparecerá aquí...
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
            <div class="modal-footer" style="padding:20px 24px; background:var(--bg-card); display:flex; justify-content:space-between; align-items:center;">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-container').classList.add('hidden')">Cancelar</button>
                <button class="btn btn-primary" id="save-promo-btn" style="padding:12px 24px; font-size:1.1rem; border-radius:8px; box-shadow:0 4px 15px rgba(239, 68, 68, 0.4);">
                    <i class="ph ph-paper-plane-tilt"></i> Programar Automatización
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

    // --- LOGIC ---
    const textarea = document.getElementById('promo-text');
    const previewDiv = document.getElementById('chat-text-preview');
    const mediaContainer = document.getElementById('preview-media-container');
    const statusDiv = document.getElementById('media-status');

    let selectedFile = null;     // To hold the actual JS File object
    let mediaType = null;        // 'image' or 'video'
    let mediaPreviewUrl = null;  // Base64 or ObjectURL for local preview

    // Text Live Update
    textarea.addEventListener('input', () => {
        previewDiv.innerHTML = formatWhatsAppText(textarea.value);
    });

    // Subir Video
    document.getElementById('btn-upload-video').addEventListener('click', () => {
        document.getElementById('promo-video-input').click();
    });

    document.getElementById('promo-video-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
            alert('El video supera los 50MB permitidos.');
            return;
        }

        selectedFile = file;
        mediaType = 'video';
        mediaPreviewUrl = URL.createObjectURL(file);

        statusDiv.innerHTML = `<span style="color:var(--primary); font-weight:bold;"><i class="ph ph-video-camera"></i> Video Cargado:</span> ${file.name}`;
        mediaContainer.innerHTML = `<video src="${mediaPreviewUrl}" controls style="width:100%; height:100%; object-fit:cover;"></video>`;
    });

    // Subir Imágenes (Collage)
    document.getElementById('btn-upload-images').addEventListener('click', () => {
        document.getElementById('promo-image-input').click();
    });

    document.getElementById('promo-image-input').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        if (files.length > 4) { alert('Máximo 4 imágenes por ahora.'); return; }

        statusDiv.innerHTML = 'Generando Collage Automátio... 🎨';

        try {
            const base64 = await createCollage(files);

            // Convert Base64 back to Blob/File to upload to Storage
            const fetchRes = await fetch(base64);
            const blob = await fetchRes.blob();
            const file = new File([blob], "collage.jpg", { type: "image/jpeg" });

            selectedFile = file;
            mediaType = 'image';
            mediaPreviewUrl = base64;

            statusDiv.innerHTML = `<span style="color:var(--success); font-weight:bold;"><i class="ph ph-images"></i> Collage Generado Exitosamente</span>`;
            mediaContainer.innerHTML = `<img src="${mediaPreviewUrl}" style="width:100%; height:100%; object-fit:cover;">`;

        } catch (err) {
            console.error(err);
            statusDiv.innerHTML = '<span style="color:red;">Error creando collage</span>';
        }
    });

    // Guardar & Programar
    document.getElementById('save-promo-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const title = document.getElementById('title-input').value.trim();
        const text = textarea.value.trim();
        const scheduledDate = document.getElementById('schedule-date').value;

        // Validaciones
        if (!title || !text || !scheduledDate) {
            alert('Por favor, completa el título, mensaje y selecciona una fecha de publicación.');
            return;
        }
        if (!selectedFile) {
            alert('Debes adjuntar al menos un video o crear un collage de fotos.');
            return;
        }

        const networks = Array.from(document.querySelectorAll('.network-cb:checked')).map(cb => cb.value);
        if (networks.length === 0) {
            alert('Selecciona al menos una red social.');
            return;
        }

        try {
            // UI Blocking
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Subiendo Archivo a la Nube...';
            btn.disabled = true;

            // 1. Upload to Supabase Storage
            let publicUrl = null;
            if (window.Sync?.client) {
                publicUrl = await window.Sync.uploadMedia(selectedFile, 'marketing_media');
            } else {
                throw new Error("No hay conexión a la nube activa. Conéctate para programar publicaciones.");
            }

            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando Tarea...';

            // 2. Save Record in DB (social_posts)
            const postData = {
                title: title,
                text: text,
                media_url: publicUrl,
                media_type: mediaType,
                networks: networks,
                scheduled_for: new Date(scheduledDate).toISOString(),
                status: 'pending',
                deleted: false,
                created_at: new Date().toISOString()
            };

            const result = await window.DataManager.saveAndSync('social_posts', postData);
            if (!result.success) throw new Error(result.syncError || result.error);

            // Finish
            modalContainer.classList.add('hidden');
            renderPromos();
            alert('¡Publicación programada exitosamente en la Nube!');

        } catch (err) {
            alert('Error al programar: ' + err.message);
            btn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Intentar de nuevo';
            btn.disabled = false;
        }
    });
}

// --- COLLAGE GENERATOR HELPER ---
async function createCollage(files) {
    const images = await Promise.all(files.map(file => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 1080; // IG friendly size
    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const count = images.length;
    if (count === 1) drawImageCover(ctx, images[0], 0, 0, size, size);
    else if (count === 2) {
        drawImageCover(ctx, images[0], 0, 0, size / 2, size);
        drawImageCover(ctx, images[1], size / 2, 0, size / 2, size);
        ctx.fillStyle = '#fff'; ctx.fillRect(size / 2 - 2, 0, 4, size);
    }
    else if (count === 3) {
        drawImageCover(ctx, images[0], 0, 0, size / 2, size);
        drawImageCover(ctx, images[1], size / 2, 0, size / 2, size / 2);
        drawImageCover(ctx, images[2], size / 2, size / 2, size / 2, size / 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(size / 2 - 2, 0, 4, size);
        ctx.fillRect(size / 2, size / 2 - 2, size / 2, 4);
    }
    else if (count === 4) {
        drawImageCover(ctx, images[0], 0, 0, size / 2, size / 2);
        drawImageCover(ctx, images[1], size / 2, 0, size / 2, size / 2);
        drawImageCover(ctx, images[2], 0, size / 2, size / 2, size / 2);
        drawImageCover(ctx, images[3], size / 2, size / 2, size / 2, size / 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(size / 2 - 2, 0, 4, size);
        ctx.fillRect(0, size / 2 - 2, size, 4);
    }

    return canvas.toDataURL('image/jpeg', 0.90);
}

function drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;
    let sx, sy, sw, sh;
    if (imgRatio > targetRatio) {
        sh = img.height; sw = img.height * targetRatio; sy = 0; sx = (img.width - sw) / 2;
    } else {
        sw = img.width; sh = img.width / targetRatio; sx = 0; sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function formatWhatsAppText(text) {
    if (!text) return '<span style="color:#d1d5db;">Escribe tu mensaje...</span>';
    return text.replace(/\*(.*?)\*/g, '<b>$1</b>')
        .replace(/_(.*?)_/g, '<i>$1</i>')
        .replace(/\n/g, '<br>');
}
