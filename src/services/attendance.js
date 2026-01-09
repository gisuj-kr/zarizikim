/**
 * 출퇴근 API 서비스
 */
import { supabase } from './supabase';
import { getDeviceId } from '../utils/device';
import { getLocalDateString } from '../utils/time';

/**
 * 출근 기록
 * @param {string} userId - 사용자 ID
 * @param {boolean} isAuto - 자동 출근 여부
 * @param {string} memo - 메모
 * @returns {Promise<Object>} 출퇴근 기록
 */
export async function checkIn(userId, isAuto = false, memo = '') {
    const today = getLocalDateString();
    const now = new Date().toISOString();

    // 오늘 출퇴근 기록이 있는지 확인
    const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

    if (existing) {
        // 이미 출근 기록이 있으면 업데이트하지 않음
        if (existing.check_in) {
            return existing;
        }

        // 출근 시간만 업데이트
        const { data, error } = await supabase
            .from('attendance')
            .update({
                check_in: now,
                is_auto_check_in: isAuto,
                memo: memo || existing.memo,
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // 새 출퇴근 기록 생성
    const { data, error } = await supabase
        .from('attendance')
        .insert({
            user_id: userId,
            date: today,
            check_in: now,
            is_auto_check_in: isAuto,
            memo,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 퇴근 기록
 * @param {string} userId - 사용자 ID
 * @param {boolean} isAuto - 자동 퇴근 여부
 * @returns {Promise<Object>} 출퇴근 기록
 */
export async function checkOut(userId, isAuto = false) {
    const today = getLocalDateString();
    const now = new Date().toISOString();

    // 오늘 출퇴근 기록 조회
    const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

    if (!existing) {
        throw new Error('오늘 출근 기록이 없습니다.');
    }

    // 퇴근 시간 업데이트
    const { data, error } = await supabase
        .from('attendance')
        .update({
            check_out: now,
            is_auto_check_out: isAuto,
        })
        .eq('id', existing.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 오늘 출퇴근 기록 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object|null>} 출퇴근 기록
 */
export async function getTodayAttendance(userId) {
    const today = getLocalDateString();

    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

    if (error && error.code !== 'PGRST116') {
        // PGRST116: 결과 없음 (정상)
        throw error;
    }

    return data || null;
}

/**
 * 출퇴근 기록 히스토리 조회
 * @param {string} userId - 사용자 ID
 * @param {number} days - 조회할 일수 (기본 30일)
 * @returns {Promise<Array>} 출퇴근 기록 목록
 */
export async function getAttendanceHistory(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * 메모 업데이트
 * @param {string} attendanceId - 출퇴근 기록 ID
 * @param {string} memo - 메모
 * @returns {Promise<Object>} 업데이트된 기록
 */
export async function updateMemo(attendanceId, memo) {
    const { data, error } = await supabase
        .from('attendance')
        .update({ memo })
        .eq('id', attendanceId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 전체 사용자 오늘 출퇴근 현황 조회 (웹 대시보드용)
 * @returns {Promise<Array>} 사용자별 출퇴근 현황
 */
export async function getAllTodayAttendance() {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('attendance')
        .select(`
      *,
      users (
        id,
        name,
        device_name
      )
    `)
        .eq('date', today)
        .order('check_in', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * 시스템 종료/잠자기로 인한 자동 퇴근 시 근무시간만 업데이트 (퇴근 시간 기록 안함)
 * - 18시 이후 시스템 종료 시에만 사용
 * @param {string} userId - 사용자 ID
 * @param {number} workMinutes - 총 근무 시간 (분)
 * @returns {Promise<Object>} 업데이트된 기록
 */
export async function updateWorkDurationWithoutCheckout(userId, workMinutes) {
    const today = new Date().toISOString().split('T')[0];

    // 오늘 출퇴근 기록 조회
    const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

    if (!existing) {
        throw new Error('오늘 출근 기록이 없습니다.');
    }

    // 근무시간만 업데이트 (check_out은 null로 유지, is_auto_check_out을 true로 설정)
    const { data, error } = await supabase
        .from('attendance')
        .update({
            work_duration_minutes: workMinutes,
            is_auto_check_out: true,
        })
        .eq('id', existing.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 퇴근 철회 - 퇴근 상태에서 다시 근무 상태로 변경
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} 업데이트된 기록
 */
export async function cancelCheckOut(userId) {
    const today = getLocalDateString();

    // 오늘 출퇴근 기록 조회
    const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

    if (!existing) {
        throw new Error('오늘 출근 기록이 없습니다.');
    }

    if (!existing.check_out && !existing.work_duration_minutes) {
        throw new Error('아직 퇴근 처리가 되지 않았습니다.');
    }

    // check_out을 null로, work_duration_minutes도 null로 초기화
    const { data, error } = await supabase
        .from('attendance')
        .update({
            check_out: null,
            is_auto_check_out: false,
            work_duration_minutes: null,
        })
        .eq('id', existing.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 미처리된 과거 출근 기록 확인 및 자동 처리
 * - 어제 이전에 출근했지만 퇴근/근무시간 기록이 없는 경우 자동 처리
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object|null>} 처리된 기록 또는 null
 */
export async function handleUnprocessedAttendance(userId) {
    const today = new Date().toISOString().split('T')[0];

    // 어제 이전에 출근했지만 check_out과 work_duration_minutes가 모두 없는 기록 조회
    const { data: unprocessed, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .lt('date', today) // 오늘 이전
        .is('check_out', null)
        .is('work_duration_minutes', null)
        .order('date', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('미처리 출근 기록 조회 오류:', error);
        return null;
    }

    if (!unprocessed) {
        // 미처리 기록 없음
        return null;
    }

    console.log('미처리 출근 기록 발견:', unprocessed);

    // 근무 시간 계산 (출근 시간부터 해당 날짜 18시까지)
    const checkInTime = new Date(unprocessed.check_in);
    const assumedEndTime = new Date(unprocessed.date + 'T18:00:00');

    // 만약 출근 시간이 18시 이후면, 출근 시간 + 1시간으로 계산
    if (checkInTime.getHours() >= 18) {
        assumedEndTime.setTime(checkInTime.getTime() + 60 * 60 * 1000); // 1시간
    }

    const workMinutes = Math.round((assumedEndTime - checkInTime) / 60000);

    // 근무시간만 기록 (퇴근 시간은 기록하지 않음)
    const { data: updated, error: updateError } = await supabase
        .from('attendance')
        .update({
            work_duration_minutes: Math.max(0, workMinutes),
            is_auto_check_out: true,
        })
        .eq('id', unprocessed.id)
        .select()
        .single();

    if (updateError) {
        console.error('미처리 출근 기록 업데이트 오류:', updateError);
        return null;
    }

    console.log('미처리 출근 기록 자동 처리 완료:', updated);
    return updated;
}

