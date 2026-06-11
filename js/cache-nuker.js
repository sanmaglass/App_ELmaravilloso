// Cache Nuker — corre UNA vez por usuario al cambiar NUKE_VERSION.
// Desregistra SWs, borra Cache Storage e IndexedDB, luego recarga.
(function cacheNuker() {
    var NUKE_VERSION = 'v1062';
    var FLAG = 'wm_cache_nuked_' + NUKE_VERSION;
    if (localStorage.getItem(FLAG)) return;

    console.log('Cache Nuker: limpiando estado viejo para', NUKE_VERSION);

    var tasks = [];

    if ('serviceWorker' in navigator) {
        tasks.push(
            navigator.serviceWorker.getRegistrations().then(function(regs) {
                return Promise.all(regs.map(function(r) { return r.unregister(); }));
            }).catch(function(){})
        );
    }

    if (typeof caches !== 'undefined') {
        tasks.push(
            caches.keys().then(function(keys) {
                return Promise.all(keys.map(function(k) { return caches.delete(k); }));
            }).catch(function(){})
        );
    }

    if (typeof indexedDB !== 'undefined') {
        tasks.push(new Promise(function(resolve) {
            try {
                var req = indexedDB.deleteDatabase('ElMaravillosoApp');
                req.onsuccess = req.onerror = req.onblocked = function() { resolve(); };
            } catch (e) { resolve(); }
        }));
    }

    Promise.all(tasks).then(function() {
        localStorage.setItem(FLAG, Date.now().toString());
        console.log('Cache Nuker: listo, recargando con codigo fresco...');
        location.reload();
    });
})();
