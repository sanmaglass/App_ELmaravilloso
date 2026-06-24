-- 030_cash_register_created_at
-- El cliente (DataManager.saveAndSync) agrega created_at a los registros nuevos,
-- pero cash_register no tenía esa columna → el push del outbox fallaba con error
-- de esquema y los cuadres/fondos/gastos de la cajera nunca llegaban a la nube.
-- Agregar la columna destraba los items ya atascados en el outbox de cada dispositivo.
-- Aplicada en prod vía MCP el 2026-06-23.
alter table public.cash_register add column if not exists created_at timestamptz default now();
