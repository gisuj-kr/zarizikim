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
    const { checkIn, checkOut, loadTodayAttendance, updateWorkDurationOnly, todayAttendance } = useAttendanceStore();
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

        // 자동 퇴근 이벤트 (수동 퇴근 버튼 / 트레이 종료)
        window.electronAPI.onAutoCheckOut(async () => {
            console.log('자동 퇴근 체크');
            try {
                await checkOut(true); // isAuto = true
                // 퇴근 완료 후 메인 프로세스에 알림 (종료 대기 해제)
                window.electronAPI.notifyCheckOutComplete();
                console.log('퇴근 완료 알림 전송');
            } catch (error) {
                console.error('퇴근 처리 실패:', error);
                // 실패해도 완료 알림 전송 (앱이 무한 대기하지 않도록)
                window.electronAPI.notifyCheckOutComplete();
            }
        });

        // 시스템 종료/잠자기 시 근무시간만 업데이트 (18시 이후)
        window.electronAPI.onAutoUpdateWorkDuration(async () => {
            console.log('시스템 종료 - 근무시간 업데이트');
            // 출근 시간부터 현재까지 근무시간 계산
            const attendance = useAttendanceStore.getState().todayAttendance;
            if (attendance?.check_in) {
                const checkInTime = new Date(attendance.check_in);
                const now = new Date();
                const workMinutes = Math.round((now - checkInTime) / 60000);
                await updateWorkDurationOnly(workMinutes);
            }
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
    }, [checkIn, checkOut, startAway, endAway, updateWorkDurationOnly]);

    // 렌더러 초기화 완료 후 메인 프로세스에 상태 알림
    useEffect(() => {
        if (loading || !window.electronAPI) return;

        const notifyReady = async () => {
            // 오늘 출퇴근 기록 로드
            const attendance = await loadTodayAttendance();

            // 출근 상태 확인 (check_in 있고 check_out 없고 work_duration_minutes 없으면 근무중)
            const isAlreadyCheckedIn = attendance?.check_in &&
                !attendance?.check_out &&
                !attendance?.work_duration_minutes;

            // 메인 프로세스에 렌더러 준비 완료 알림
            window.electronAPI.notifyRendererReady(
                isAlreadyCheckedIn,
                attendance?.check_in || null
            );
        };

        notifyReady();
    }, [loading, loadTodayAttendance]);

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
