// Cache Nuker — corre UNA vez por usuario al cambiar NUKE_VERSION.
// Fuerza al dispositivo a cargar el código nuevo SIN cerrar la sesión ni
// borrar los datos locales: desregistra el Service Worker y borra solo las
// cachés de código viejo, luego recarga. La sesión (token) y el IndexedDB
// (caja, ventas, reportes pendientes de subir) quedan INTACTOS — el usuario
// sigue adentro y no pierde nada. Solo se cierra sesión si la cierra él mismo.
(function cacheNuker() {
    var NUKE_VERSION = 'v1106';
    var FLAG = 'wm_cache_nuked_' + NUKE_VERSION;
    if (localStorage.getItem(FLAG)) return;

    console.log('Cache Nuker: actualizando a', NUKE_VERSION, '(conserva sesión y datos)');

    var tasks = [];

    // Desregistrar SWs viejos para que se reinstale el nuevo
    if ('serviceWorker' in navigator) {
        tasks.push(
            navigator.serviceWorker.getRegistrations().then(function(regs) {
                return Promise.all(regs.map(function(r) { return r.unregister(); }));
            }).catch(function(){})
        );
    }

    // Borrar SOLO las cachés del Service Worker (archivos de código viejos).
    // NO se toca IndexedDB ni el token de sesión.
    if (typeof caches !== 'undefined') {
        tasks.push(
            caches.keys().then(function(keys) {
                return Promise.all(keys.map(function(k) { return caches.delete(k); }));
            }).catch(function(){})
        );
    }

    Promise.all(tasks).then(function() {
        localStorage.setItem(FLAG, Date.now().toString());
        console.log('Cache Nuker: listo, recargando con código fresco...');
        location.reload();
    });
})();
