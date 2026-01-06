/**
 * 자리비움 API 서비스
 */
import { supabase } from './supabase';

/**
 * 자리비움 시작
 * @param {string} userId - 사용자 ID
 * @param {string} attendanceId - 출퇴근 기록 ID
 * @param {Date} startTime - 시작 시간
 * @param {boolean} isAuto - 자동 감지 여부
 * @returns {Promise<Object>} 자리비움 기록
 */
export async function startAway(userId, attendanceId, startTime, isAuto = false) {
    const { data, error } = await supabase
        .from('away_records')
        .insert({
            user_id: userId,
            attendance_id: attendanceId,
            start_time: startTime.toISOString(),
            is_auto: isAuto,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 자리비움 종료
 * @param {string} awayRecordId - 자리비움 기록 ID
 * @param {Date} endTime - 종료 시간
 * @returns {Promise<Object>} 업데이트된 자리비움 기록
 */
export async function endAway(awayRecordId, endTime) {
    // 먼저 시작 시간 조회
    const { data: record } = await supabase
        .from('away_records')
        .select('start_time')
        .eq('id', awayRecordId)
        .single();

    if (!record) {
        throw new Error('자리비움 기록을 찾을 수 없습니다.');
    }

    // 시간 계산
    const startTime = new Date(record.start_time);
    const duration = Math.round((endTime - startTime) / 60000); // 분 단위

    const { data, error } = await supabase
        .from('away_records')
        .update({
            end_time: endTime.toISOString(),
            duration_minutes: duration,
        })
        .eq('id', awayRecordId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 오늘 자리비움 기록 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Array>} 자리비움 기록 목록
 */
export async function getTodayAwayRecords(userId) {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('away_records')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', today)
        .lt('start_time', tomorrowStr)
        .order('start_time', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * 현재 진행 중인 자리비움 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object|null>} 진행 중인 자리비움 기록
 */
export async function getCurrentAway(userId) {
    const { data, error } = await supabase
        .from('away_records')
        .select('*')
        .eq('user_id', userId)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data || null;
}

/**
 * 특정 기간 자리비움 기록 조회
 * @param {string} userId - 사용자 ID
 * @param {Date} startDate - 시작 날짜
 * @param {Date} endDate - 종료 날짜
 * @returns {Promise<Array>} 자리비움 기록 목록
 */
export async function getAwayRecordsByDateRange(userId, startDate, endDate) {
    const { data, error } = await supabase
        .from('away_records')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * 총 자리비움 시간 계산 (분)
 * @param {Array} records - 자리비움 기록 목록
 * @returns {number} 총 시간 (분)
 */
export function calculateTotalAwayMinutes(records) {
    return records.reduce((total, record) => {
        return total + (record.duration_minutes || 0);
    }, 0);
}
