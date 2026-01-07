/**
 * Supabase 클라이언트 초기화
 */
import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 Supabase 설정 로드
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 환경 변수 검증
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase 환경 변수가 설정되지 않았습니다.');
    console.error('VITE_SUPABASE_URL:', supabaseUrl ? '설정됨' : '미설정');
    console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '설정됨' : '미설정');
}

// Supabase 클라이언트 생성 (환경 변수가 없으면 더미 URL 사용)
export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false, // 데스크톱 앱에서는 세션 저장 불필요
        },
    })
    : null;

// Supabase 연결 상태 확인
export const isSupabaseConnected = () => supabase !== null;

export default supabase;
