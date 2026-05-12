-- ============================================================
-- THEKENPLAN – Availability v2 Migration
-- In Supabase SQL Editor ausführen
-- ============================================================

-- 1. Neue Spalten für tagesgenaue Zeitregeln und Wunschtermine
ALTER TABLE employee_availability
  ADD COLUMN IF NOT EXISTS date_rules   JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wished_dates TEXT[] DEFAULT '{}';

-- date_rules Format: {"2024-06-16": {"available_from": "18:00"}}
-- wished_dates Format: ["2024-06-20", "2024-06-27"]
