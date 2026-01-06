/**
 * 웹 대시보드용 Supabase 클라이언트
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 오늘 전체 사용자 출퇴근 현황 조회
 */
export async function getTodayAttendance() {
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
 * 오늘 자리비움 기록 조회
 */
export async function getTodayAwayRecords() {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('away_records')
        .select('*')
        .gte('start_time', today)
        .lt('start_time', tomorrowStr);

    if (error) throw error;
    return data || [];
}

/**
 * 특정 날짜 출퇴근 현황 조회
 */
export async function getAttendanceByDate(date) {
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
        .eq('date', date)
        .order('check_in', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * 특정 날짜 자리비움 기록 조회
 */
export async function getAwayRecordsByDate(date) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('away_records')
        .select('*')
        .gte('start_time', date)
        .lt('start_time', nextDateStr);

    if (error) throw error;
    return data || [];
}

/**
 * 전체 사용자 목록 조회
 */
export async function getAllUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * 특정 사용자의 출퇴근 히스토리 조회
 */
export async function getUserAttendanceHistory(userId, days = 30) {
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
 * 특정 사용자의 자리비움 히스토리 조회
 */
export async function getUserAwayHistory(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
        .from('away_records')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: false });

    if (error) throw error;
    return data || [];
}
