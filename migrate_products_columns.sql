-- MIGRATION: Add missing columns to products table
-- Run this in Supabase SQL Editor

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS units NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "isNeto" BOOLEAN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS margin NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "createdAt" TEXT;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;
