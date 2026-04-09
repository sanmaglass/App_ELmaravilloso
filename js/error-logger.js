/**
 * CENTRALIZED ERROR LOGGING SYSTEM
 * Maneja errores de Supabase sin contaminar console
 * Loguea en BD local para debugging
 */

window.ErrorLogger = {
    // Errores transitorio sy que pueden reintentarse
    TRANSIENT_ERRORS: new Set([
        'PGRST301',  // JWT inválido (sesión expirada)
        'PGRST', // Connection/rate limit
        'ETIMEDOUT', // Network timeout
        'ECONNREFUSED', // Connection refused
        'network',
        'timeout',
        'fetch failed'
    ]),

    // Tabla de errores en BD local
    DB_INITIALIZED: false,

    /**
     * Log de error centralizado
     * @param {string} context - Dónde ocurrió (ej: 'sync.init', 'sync.pull.suppliers')
     * @param {Error|string} error - El error
     * @param {object} metadata - Info adicional {tableName, retries, userId, etc}
     * @param {boolean} isTransient - Si se puede reintentar
     */
    log: async function (context, error, metadata = {}, isTransient = null) {
        const now = new Date();
        const errorMessage = error?.message || String(error);
        const errorCode = error?.code || 'UNKNOWN';

        // Auto-detectar si es transitorio
        if (isTransient === null) {
            isTransient = this._isTransientError(errorMessage, errorCode);
        }

        const logEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: now.toISOString(),
            context,
            errorMessage,
            errorCode,
            isTransient,
            severity: isTransient ? 'warning' : 'error',
            metadata: {
                ...metadata,
                userAgent: navigator.userAgent.substr(0, 100),
                appVersion: window.APP_VERSION || 'unknown'
            }
        };

        try {
            // Guardar en BD local para debugging
            if (!this.DB_INITIALIZED) {
                await this._initErrorDB();
            }
            if (window.db && window.db.error_logs) {
                await window.db.error_logs.add(logEntry);
            }
        } catch (dbErr) {
            // Si falla el logging en BD, al menos lo intentamos
            console.warn('[ErrorLogger] Could not persist to DB:', dbErr.message);
        }

        // Loguear en console SOLO si es error crítico
        if (!isTransient) {
            console.error(`[${context}] ${errorMessage}`, { code: errorCode, metadata });
        } else {
            console.debug(`[${context}] Transient error (will retry): ${errorMessage}`);
        }

        return logEntry;
    },

    /**
     * Detectar si un error es transitorio
     */
    _isTransientError: function (message, code) {
        message = (message || '').toLowerCase();
        code = (code || '').toString();

        for (const transientCode of this.TRANSIENT_ERRORS) {
            if (message.includes(transientCode.toLowerCase()) || code.includes(transientCode)) {
                return true;
            }
        }

        // Network errors are transient
        if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
            return true;
        }

        return false;
    },

    /**
     * Crear tabla de errores en Dexie si no existe
     */
    _initErrorDB: async function () {
        try {
            // Agregar versión si no existe
            const currentVersion = window.db.verno || 0;
            if (!window.db.tables.find(t => t.name === 'error_logs')) {
                window.db.version(currentVersion + 1).stores({
                    error_logs: 'id, timestamp, context, isTransient'
                });
            }
            this.DB_INITIALIZED = true;
        } catch (e) {
            console.warn('[ErrorLogger] Could not init DB:', e.message);
        }
    },

    /**
     * Obtener últimos N errores para debugging
     */
    getRecentErrors: async function (limit = 50, context = null) {
        try {
            if (!window.db || !window.db.error_logs) return [];
            let query = window.db.error_logs;
            if (context) {
                query = query.where('context').equals(context);
            }
            return await query.reverse().limit(limit).toArray();
        } catch (e) {
            console.warn('[ErrorLogger] Could not fetch errors:', e.message);
            return [];
        }
    },

    /**
     * Limpiar errores antiguos (> 7 días)
     */
    cleanOldErrors: async function () {
        try {
            if (!window.db || !window.db.error_logs) return;
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const oldErrors = await window.db.error_logs
                .where('timestamp')
                .below(sevenDaysAgo)
                .toArray();
            if (oldErrors.length > 0) {
                await window.db.error_logs.bulkDelete(oldErrors.map(e => e.id));
                console.log(`[ErrorLogger] Cleaned ${oldErrors.length} old error logs`);
            }
        } catch (e) {
            console.warn('[ErrorLogger] Could not clean old errors:', e.message);
        }
    },

    /**
     * Exportar errores para debugging (descargable)
     */
    exportErrorLog: async function () {
        try {
            const errors = await this.getRecentErrors(1000);
            const csv = [
                ['Timestamp', 'Context', 'Error', 'Code', 'Transient', 'Severity', 'Details'].join(','),
                ...errors.map(e => [
                    e.timestamp,
                    e.context,
                    `"${e.errorMessage.replace(/"/g, '""')}"`,
                    e.errorCode,
                    e.isTransient,
                    e.severity,
                    `"${JSON.stringify(e.metadata).replace(/"/g, '""')}"`
                ].join(','))
            ].join('\n');

            // Trigger download
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `error-log-${new Date().toISOString()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return { success: true, count: errors.length };
        } catch (e) {
            console.error('[ErrorLogger] Export failed:', e.message);
            return { success: false, error: e.message };
        }
    },

    /**
     * Mostrar resumen en consola (para debugging)
     */
    printSummary: async function () {
        try {
            const errors = await this.getRecentErrors(100);
            const critical = errors.filter(e => !e.isTransient).length;
            const transient = errors.filter(e => e.isTransient).length;
            const byContext = {};

            errors.forEach(e => {
                if (!byContext[e.context]) byContext[e.context] = 0;
                byContext[e.context]++;
            });

            console.table({
                'Total Errors': errors.length,
                'Critical': critical,
                'Transient (Retried)': transient,
                'By Context': JSON.stringify(byContext)
            });
        } catch (e) {
            console.warn('[ErrorLogger] Summary failed:', e.message);
        }
    }
};

// Limpiar errores antiguos cada 24 horas
setInterval(() => {
    window.ErrorLogger?.cleanOldErrors();
}, 24 * 60 * 60 * 1000);
