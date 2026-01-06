/**
 * 메인 앱 컴포넌트
 * - 라우팅 관리
 * - 전역 상태 초기화
 * - Electron IPC 이벤트 리스너 설정
 */
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './components/Welcome';
import MainView from './components/MainView';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { useUserStore } from './stores/userStore';
import { useAttendanceStore } from './stores/attendanceStore';
import { useAwayStore } from './stores/awayStore';

function App() {
    const { user, isInitialized, loadUser } = useUserStore();
    const { checkIn, checkOut, loadTodayAttendance } = useAttendanceStore();
    const { startAway, endAway } = useAwayStore();
    const [loading, setLoading] = useState(true);

    // 초기화
    useEffect(() => {
        const init = async () => {
            await loadUser();
            setLoading(false);
        };
        init();
    }, [loadUser]);

    // Electron IPC 이벤트 리스너 설정
    useEffect(() => {
        if (!window.electronAPI) return;

        // 자동 출근 이벤트
        window.electronAPI.onAutoCheckIn(async () => {
            console.log('자동 출근 체크');
            await checkIn(true); // isAuto = true
        });

        // 자동 퇴근 이벤트
        window.electronAPI.onAutoCheckOut(async () => {
            console.log('자동 퇴근 체크');
            await checkOut(true); // isAuto = true
        });

        // 자동 자리비움 시작 이벤트
        window.electronAPI.onAutoAwayStart(async (startTime) => {
            console.log('자동 자리비움 시작:', startTime);
            await startAway(new Date(startTime), true); // isAuto = true
        });

        // 자동 자리비움 종료 이벤트
        window.electronAPI.onAutoAwayEnd(async ({ startTime, endTime }) => {
            console.log('자동 자리비움 종료:', startTime, endTime);
            await endAway(new Date(endTime));
        });

        // 컴포넌트 언마운트 시 리스너 제거
        return () => {
            window.electronAPI.removeAllListeners();
        };
    }, [checkIn, checkOut, startAway, endAway]);

    // 로딩 중
    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>로딩 중...</p>
            </div>
        );
    }

    // 사용자 등록이 안 되어 있으면 Welcome 화면
    if (!isInitialized || !user) {
        return <Welcome />;
    }

    return (
        <Router>
            <div className="app">
                <Routes>
                    <Route path="/" element={<MainView />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
