/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export', // 정적 빌드 (배포 용이)
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
