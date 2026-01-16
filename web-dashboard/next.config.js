/** @type {import('next').NextConfig} */
const nextConfig = {
    // output: 'export', // PM2 서버 모드 사용 (API 라우트 필요)
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
