-- =====================================================
-- 자리지킴 (ZariZikim) 데이터베이스 스키마
-- Supabase에서 SQL Editor를 통해 실행하세요
-- =====================================================

-- 1. 사용자 테이블
-- 각 디바이스(PC)마다 고유한 사용자 생성
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,        -- 디바이스 고유 ID (UUID)
  name TEXT NOT NULL,                     -- 사용자 이름
  device_name TEXT,                       -- 디바이스 이름 (Windows PC, Mac 등)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 출퇴근 기록 테이블
-- 하루에 사용자당 하나의 레코드
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,                     -- 날짜 (YYYY-MM-DD)
  check_in TIMESTAMPTZ,                   -- 출근 시간
  check_out TIMESTAMPTZ,                  -- 퇴근 시간
  memo TEXT,                              -- 메모 (재택근무, 외근 등)
  is_auto_check_in BOOLEAN DEFAULT FALSE, -- 자동 출근 여부
  is_auto_check_out BOOLEAN DEFAULT FALSE,-- 자동 퇴근 여부
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)                   -- 사용자+날짜 조합은 유니크
);

-- 3. 자리비움 기록 테이블
-- 하루에 여러 번 자리비움 가능
CREATE TABLE IF NOT EXISTS away_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,        -- 자리비움 시작 시간
  end_time TIMESTAMPTZ,                   -- 자리비움 종료 시간 (NULL이면 진행중)
  duration_minutes INTEGER,               -- 자리비움 시간 (분)
  is_auto BOOLEAN DEFAULT TRUE,           -- 자동 감지 여부
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 휴식 기록 테이블 (점심시간 등 공식 휴식)
CREATE TABLE IF NOT EXISTS break_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  break_type TEXT DEFAULT 'lunch',        -- 휴식 유형 (lunch, break 등)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 오프라인 동기화 큐 (선택적)
-- 오프라인에서 발생한 이벤트를 저장했다가 동기화
CREATE TABLE IF NOT EXISTS offline_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                   -- 액션 유형 (check_in, check_out, away_start, away_end)
  payload JSONB NOT NULL,                 -- 액션 데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ                   -- 동기화 완료 시간 (NULL이면 미동기화)
);

-- =====================================================
-- 인덱스 생성 (성능 최적화)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_away_records_attendance ON away_records(attendance_id);
CREATE INDEX IF NOT EXISTS idx_away_records_user ON away_records(user_id);
CREATE INDEX IF NOT EXISTS idx_away_records_start_time ON away_records(start_time);
CREATE INDEX IF NOT EXISTS idx_break_records_attendance ON break_records(attendance_id);
CREATE INDEX IF NOT EXISTS idx_offline_queue_synced ON offline_queue(synced_at) WHERE synced_at IS NULL;

-- =====================================================
-- Row Level Security (RLS) 설정
-- 기본적으로 모든 접근 허용 (public anon key 사용)
-- =====================================================

-- RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE away_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_queue ENABLE ROW LEVEL SECURITY;

-- 모든 사용자에게 읽기/쓰기 허용 (공개 앱)
CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for away_records" ON away_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for break_records" ON break_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for offline_queue" ON offline_queue FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 완료!
-- 이제 앱에서 Supabase에 연결하여 사용할 수 있습니다.
-- =====================================================
