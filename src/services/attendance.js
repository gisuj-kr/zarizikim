/**
 * 출퇴근 API 서비스
 */
import { supabase } from './supabase';
import { getDeviceId } from '../utils/device';

/**
 * 출근 기록
 * @param {string} userId - 사용자 ID
 * @param {boolean} isAuto - 자동 출근 여부
 * @param {string} memo - 메모
 * @returns {Promise<Object>} 출퇴근 기록
 */
export async function checkIn(userId, isAuto = false, memo = '') {
    const today = new Date().toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];

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
