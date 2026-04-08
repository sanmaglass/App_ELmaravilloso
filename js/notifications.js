// ============================================================
// AppNotify — Sistema de Notificaciones de El Maravilloso
// Web Audio API chime + Browser Notifications + App Badge
// ============================================================
window.AppNotify = {
    _audioCtx: null,
    _granted: false,
    _lastFired: {}, // prevent duplicate fires: { taskId: timestamp }

    // ── Init ─────────────────────────────────────────────────
    async init() {
        this._granted = Notification.permission === 'granted';
        console.log('[AppNotify] Init. Permission:', Notification.permission);
        await this.updateBadge();
    },

    // ── Request notification permission ──────────────────────
    async requestPermission() {
        if (!('Notification' in window)) return false;
        const result = await Notification.requestPermission();
        this._granted = result === 'granted';
        return this._granted;
    },

    // ── Web Audio Chime — 3-note arpeggio ────────────────────
    // Unique signature sound for El Maravilloso
    playChime(variant = 'alert') {
        try {
            if (!this._audioCtx) {
                this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this._audioCtx;
            if (ctx.state === 'suspended') ctx.resume();

            // Chord sets: alert = major bright, urgent = minor dramatic
            const chords = {
                alert: [523.25, 659.25, 783.99],   // C5 E5 G5 — major
                urgent: [369.99, 440.00, 554.37],   // F#4 A4 C#5 — minor dramatic
                success: [659.25, 830.61, 1046.50],  // E5 G#5 C6 — major bright
            };
            const freqs = chords[variant] || chords.alert;

            freqs.forEach((freq, i) => {
                const now = ctx.currentTime + i * 0.20;

                // Main sine wave
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.value = freq;
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                gain1.gain.setValueAtTime(0, now);
                gain1.gain.linearRampToValueAtTime(0.30, now + 0.03);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.70);
                osc1.start(now); osc1.stop(now + 0.75);

                // Harmonic overtone (triangle) — adds warmth
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'triangle';
                osc2.frequency.value = freq * 2.01; // slight detune for richness
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                gain2.gain.setValueAtTime(0, now);
                gain2.gain.linearRampToValueAtTime(0.07, now + 0.05);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
                osc2.start(now); osc2.stop(now + 0.60);
            });
        } catch (e) {
            console.warn('[AppNotify] Audio error:', e.message);
        }
    },

    // ── Native browser notification ──────────────────────────
    showNotification(title, body, taskId) {
        if (!this._granted) return;
        try {
            const n = new Notification(title, {
                body,
                icon: './assets/icon-512.png',
                badge: './assets/icon-512.png',
                tag: `wm-reminder-${taskId}`,
                requireInteraction: true,
                silent: false,
                vibrate: [200, 100, 200, 100, 400],
            });
            n.onclick = () => { window.focus(); n.close(); };
        } catch (e) {
            console.warn('[AppNotify] Notification error:', e.message);
        }
    },

    // ── Approaching warning (15 min before) ─────────────────
    async fireApproaching(reminder, minsLeft) {
        const now = Date.now();
        const debounceKey = `soon_${reminder.id}`;
        if (this._lastFired[debounceKey] && (now - this._lastFired[debounceKey]) < 10 * 60 * 1000) return;
        this._lastFired[debounceKey] = now;

        this.playChime('alert');
        if (document.visibilityState !== 'visible') {
            this.showNotification(
                `⏰ En ${minsLeft} min: ${reminder.title}`,
                'Se acerca tu alerta — El Maravilloso',
                `soon_${reminder.id}`
            );
        }
        window.Sync?.showToast(`⏰ En ${minsLeft} min: ${reminder.title}`, 'info');
    },

    // ── App Badge (home screen counter) ──────────────────────
    async updateBadge() {
        try {
            const now = new Date();
            const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            // Badge only counts overdue + due today (not future tasks)
            const pending = await window.db.reminders
                .filter(r => !r.deleted && !r.completed && new Date(r.next_run) <= endOfToday)
                .count();

            // PWA Badge API (Android Chrome / iOS 16.4+)
            if ('setAppBadge' in navigator) {
                if (pending > 0) await navigator.setAppBadge(pending);
                else await navigator.clearAppBadge();
            }

            // Sidebar nav badge
            const badge = document.getElementById('tasks-nav-badge');
            if (badge) {
                badge.textContent = pending > 0 ? (pending > 99 ? '99+' : pending) : '';
                badge.style.display = pending > 0 ? 'inline-flex' : 'none';
            }
        } catch (e) { /* silently ignore */ }
    },

    // ── Main trigger (called by ReminderEngine) ───────────────
    async fire(reminder) {
        // Debounce: don't fire same task twice within 2 minutes
        const now = Date.now();
        if (this._lastFired[reminder.id] && (now - this._lastFired[reminder.id]) < 120000) return;
        this._lastFired[reminder.id] = now;

        const isUrgent = reminder.priority === 'high';
        const chime = isUrgent ? 'urgent' : 'alert';
        const emoji = isUrgent ? '🔴' : '⏰';
        const title = `${emoji} ${reminder.title}`;
        const body = isUrgent
            ? '⚠️ ALTA PRIORIDAD — El Maravilloso'
            : 'Recordatorio — El Maravilloso';

        // 1. Sound
        this.playChime(chime);

        // 2. Native notification (if in background)
        if (document.visibilityState !== 'visible') {
            this.showNotification(title, body, reminder.id);
        }

        // 3. In-app toast (always)
        window.Sync?.showToast(`${emoji} ${reminder.title}`, 'info');

        // 4. Update badge
        await this.updateBadge();
    },
};
