-- ============================================
-- АЗС-Часы: начальная схема БД
-- ============================================

-- Справочник АЗС
CREATE TABLE IF NOT EXISTS stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_number TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  address TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'city' CHECK (category IN ('city', 'district')),
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  fuel_types TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Часы работы АЗС по дням
CREATE TABLE IF NOT EXISTS work_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_working BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,
  end_time TIME,
  hours_worked NUMERIC(4,1) GENERATED ALWAYS AS (
    CASE
      WHEN NOT is_working THEN 0
      WHEN start_time IS NULL OR end_time IS NULL THEN 0
      WHEN end_time > start_time THEN
        EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0
      ELSE
        EXTRACT(EPOCH FROM (INTERVAL '24 hours' - (start_time - end_time))) / 3600.0
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(station_id, date)
);

-- Индексы для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_work_hours_date ON work_hours(date);
CREATE INDEX IF NOT EXISTS idx_work_hours_station_date ON work_hours(station_id, date);
CREATE INDEX IF NOT EXISTS idx_stations_category ON stations(category);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_hours ENABLE ROW LEVEL SECURITY;

-- Публичное чтение справочника АЗС
CREATE POLICY "stations_select_public" ON stations
  FOR SELECT USING (true);

-- Запись в справочник — только авторизованные
CREATE POLICY "stations_insert_auth" ON stations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "stations_update_auth" ON stations
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "stations_delete_auth" ON stations
  FOR DELETE USING (auth.role() = 'authenticated');

-- Публичное чтение часов работы
CREATE POLICY "work_hours_select_public" ON work_hours
  FOR SELECT USING (true);

-- Запись часов работы — только авторизованные
CREATE POLICY "work_hours_insert_auth" ON work_hours
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "work_hours_update_auth" ON work_hours
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "work_hours_delete_auth" ON work_hours
  FOR DELETE USING (auth.role() = 'authenticated');
