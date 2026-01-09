/** @type {import('next').NextConfig} */
const nextConfig = {
    // output: 'export', // 서버 모드로 변경 (API 라우트 사용)
    trailingSlash: true,
    images: {
        unoptimized: true,
    },
    // 환경 변수
    env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
};

module.exports = nextConfig;
