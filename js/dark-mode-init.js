// Dark mode init — debe correr antes del render para evitar flash blanco.
(function () {
    if (localStorage.getItem('wm_dark_mode') === 'true') {
        document.documentElement.style.backgroundColor = '#0d1117';
        document.addEventListener('DOMContentLoaded', function () {
            document.body.classList.add('dark-mode');
            document.documentElement.style.backgroundColor = '';
        }, { once: true });
    }
})();
