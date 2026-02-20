-- MIGRACIÓN: Agregar campos de crédito a purchase_invoices
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS "creditDays" INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "dueDate" TEXT DEFAULT NULL;
