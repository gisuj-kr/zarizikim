-- =====================================================
-- 근퇴기록 앱 스키마 업데이트
-- attendance 테이블에 work_duration_minutes 컬럼 추가
-- 시스템 종료 시 퇴근 시간 없이 근무시간만 기록하는 기능을 위함
-- =====================================================

-- attendance 테이블에 work_duration_minutes 컬럼 추가
-- 시스템 종료/잠자기로 인한 자동 퇴근 시 퇴근 시간 없이 근무시간만 기록
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS work_duration_minutes INTEGER;

-- 코멘트 추가
COMMENT ON COLUMN attendance.work_duration_minutes IS '시스템 종료 시 퇴근 시간 없이 기록되는 총 근무시간 (분)';
