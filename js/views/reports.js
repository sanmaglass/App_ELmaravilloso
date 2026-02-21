// Reports View - Aliased to Unified Dashboard
window.Views = window.Views || {};

window.Views.reports = async (container) => {
    // Redirigir siempre al nuevo dashboard unificado
    if (window.Views.dashboard) {
        await window.Views.dashboard(container);
    } else {
        container.innerHTML = '<p>Cargando Dashboard Uniificado...</p>';
        // Re-intentar si dashboard.js no cargó aún
        setTimeout(() => window.Views.reports(container), 200);
    }
};
