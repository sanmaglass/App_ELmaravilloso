// Script para analizar estructura de eleventa_sales
(async () => {
    const data = await window.db.eleventa_sales.toArray();
    const sample = data.find(d => d.items && d.items.length > 0);
    console.log('=== ESTRUCTURA DE ELEVENTA_SALES ===');
    console.log('Registro completo:', JSON.stringify(sample, null, 2));
    if (sample && sample.items) {
        console.log('=== ESTRUCTURA DE ITEMS ===');
        console.log('Primer item:', JSON.stringify(sample.items[0], null, 2));
    }
})();
