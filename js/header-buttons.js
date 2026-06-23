// Header button handlers — Bell push test
document.getElementById('btn-header-bell')?.addEventListener('click', async () => {
    if (window.PushSubscribe && !window.PushSubscribe.isSubscribed()) {
        const subscribed = await window.PushSubscribe.subscribe();
        if (subscribed) {
            window.AppNotify?.playChime('success');
            window.Sync?.showToast('Push activado! Enviando test...', 'success');
        } else {
            window.Sync?.showToast('No se pudo activar push', 'error');
            return;
        }
    }
    try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('Notificacion de prueba - El Maravilloso', {
            body: 'Si ves esto, las push notifications funcionan en tu dispositivo!',
            icon: '/assets/icon-512.png',
            badge: '/assets/icon-512.png',
            tag: 'wm-test-' + Date.now(),
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 400]
        });
        window.Sync?.showToast('Notificacion de prueba enviada', 'success');
    } catch (e) {
        window.Sync?.showToast('Error: ' + e.message, 'error');
    }
});
