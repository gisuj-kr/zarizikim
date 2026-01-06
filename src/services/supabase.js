/**
 * Supabase 클라이언트 초기화
 */
import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 Supabase 설정 로드
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false, // 데스크톱 앱에서는 세션 저장 불필요
    },
});

export default supabase;
