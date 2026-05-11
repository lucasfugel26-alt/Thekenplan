-- ============================================================
-- THEKENPLAN – Dienstplanungs-Schema
-- In Supabase SQL Editor ausführen
-- ============================================================

-- 1. planning_periods
CREATE TABLE IF NOT EXISTS planning_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL,
  deadline DATE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','collecting','ai_proposal','editing','published')),
  plan_snapshot JSONB,
  proposed_assignments JSONB,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, year)
);
CREATE INDEX IF NOT EXISTS planning_periods_status_idx ON planning_periods(status);
ALTER TABLE planning_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_periods" ON planning_periods
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "staff_read_periods" ON planning_periods
  FOR SELECT TO authenticated USING (true);

-- 2. employee_availability
CREATE TABLE IF NOT EXISTS employee_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id UUID REFERENCES planning_periods(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  blocked_dates TEXT[] DEFAULT '{}',
  weekday_rules JSONB DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, employee_id)
);
CREATE INDEX IF NOT EXISTS ea_period_idx ON employee_availability(period_id);
CREATE INDEX IF NOT EXISTS ea_employee_idx ON employee_availability(employee_id);
ALTER TABLE employee_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_availability" ON employee_availability
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "staff_own_availability" ON employee_availability
  FOR ALL TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid()));

-- 3. shift_applications
CREATE TABLE IF NOT EXISTS shift_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id UUID REFERENCES planning_periods(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, employee_id, event_id)
);
CREATE INDEX IF NOT EXISTS sa_period_idx ON shift_applications(period_id);
ALTER TABLE shift_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_applications" ON shift_applications
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "staff_own_applications" ON shift_applications
  FOR ALL TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid()));

-- 4. planning_rules
CREATE TABLE IF NOT EXISTS planning_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL UNIQUE,
  max_shift_hours FLOAT,
  min_rest_hours FLOAT DEFAULT 11,
  max_weekly_hours FLOAT,
  max_monthly_hours FLOAT,
  target_monthly_hours FLOAT,
  break_rules JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE planning_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_rules" ON planning_rules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "staff_read_rules" ON planning_rules
  FOR SELECT TO authenticated USING (true);

-- 5. shift_swaps
CREATE TABLE IF NOT EXISTS shift_swaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  target_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  event_id_a TEXT,
  event_id_b TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','target_approved','admin_review','approved','rejected')),
  requester_note TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ss_requester_idx ON shift_swaps(requester_id);
CREATE INDEX IF NOT EXISTS ss_target_idx ON shift_swaps(target_id);
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_swaps" ON shift_swaps
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "staff_own_swaps" ON shift_swaps
  FOR ALL TO authenticated
  USING (
    requester_id IN (SELECT id FROM employees WHERE profile_id = auth.uid()) OR
    target_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    requester_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
  );
