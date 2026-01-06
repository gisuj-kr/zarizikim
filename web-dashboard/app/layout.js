/**
 * 웹 대시보드 루트 레이아웃
 */
import './globals.css';

export const metadata = {
    title: '자리지킴 대시보드',
    description: '출퇴근 및 자리비움 현황 조회',
};

export default function RootLayout({ children }) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    );
}
