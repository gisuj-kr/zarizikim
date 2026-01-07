/**
 * MainView 컴포넌트 - 출퇴근 버튼 화면
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useAttendanceStore } from '../stores/attendanceStore';
import { useAwayStore } from '../stores/awayStore';
import { formatTime, formatDuration, calculateMinutesBetween } from '../utils/time';
import './MainView.css';

function MainView() {
    const { user } = useUserStore();
    const {
        todayAttendance,
        loading: attendanceLoading,
        checkIn,
        checkOut,
        cancelCheckOut,
        updateMemo,
        loadTodayAttendance
    } = useAttendanceStore();
    const {
        currentAway,
        todayRecords,
        totalMinutes: awayMinutes,
        loading: awayLoading,
        startAway,
        endAway,
        loadTodayRecords
    } = useAwayStore();

    const [memo, setMemo] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [workDuration, setWorkDuration] = useState(0);

    // check_out이 없을 때 기본 퇴근 시간 (18:00)을 반환
    const getDefaultEndTime = () => {
        const today = new Date();
        today.setHours(18, 0, 0, 0);
        return today;
    };

    // 데이터 로드
    useEffect(() => {
        loadTodayAttendance();
        loadTodayRecords();
    }, [loadTodayAttendance, loadTodayRecords]);

    // 메모 동기화
    useEffect(() => {
        if (todayAttendance?.memo) {
            setMemo(todayAttendance.memo);
        }
    }, [todayAttendance]);

    // 시간 업데이트 (1초마다)
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());

            // 근무 시간 계산
            if (todayAttendance?.check_in && !todayAttendance?.check_out) {
                const minutes = calculateMinutesBetween(todayAttendance.check_in, new Date());
                setWorkDuration(minutes);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [todayAttendance]);

    // 출근 상태
    const isCheckedIn = todayAttendance?.check_in && !todayAttendance?.check_out;
    const isCheckedOut = todayAttendance?.check_in && todayAttendance?.check_out;
    const loading = attendanceLoading || awayLoading;

    // 출근 처리
    const handleCheckIn = async () => {
        try {
            await checkIn(false, memo);
        } catch (error) {
            console.error('출근 실패:', error);
        }
    };

    // 퇴근 처리
    const handleCheckOut = async () => {
        // 자리비움 중이면 먼저 종료
        if (currentAway) {
            await endAway();
        }

        try {
            await checkOut();
        } catch (error) {
            console.error('퇴근 실패:', error);
        }
    };

    // 퇴근 철회 (다시 근무 시작)
    const handleCancelCheckOut = async () => {
        try {
            await cancelCheckOut();
        } catch (error) {
            console.error('퇴근 철회 실패:', error);
        }
    };

    // 수동 자리비움 토글
    const handleAwayToggle = async () => {
        try {
            if (currentAway) {
                await endAway();
            } else {
                await startAway(new Date(), false);
            }
        } catch (error) {
            console.error('자리비움 처리 실패:', error);
        }
    };

    // 메모 저장
    const handleMemoBlur = async () => {
        if (todayAttendance && memo !== todayAttendance.memo) {
            try {
                await updateMemo(memo);
            } catch (error) {
                console.error('메모 저장 실패:', error);
            }
        }
    };

    return (
        <div className="main-view">
            {/* 네비게이션 */}
            <nav className="nav">
                <Link to="/" className="nav-link active">홈</Link>
                <Link to="/dashboard" className="nav-link">대시보드</Link>
                <Link to="/settings" className="nav-link">설정</Link>
            </nav>

            {/* 메인 컨텐츠 */}
            <div className="main-content">
                {/* 사용자 인사 */}
                <div className="greeting">
                    <h1>안녕하세요, {user?.name}님!</h1>
                    <p className="current-time">
                        {currentTime.toLocaleDateString('ko-KR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </p>
                </div>

                {/* 상태 카드 */}
                <div className="status-cards">
                    {/* 출퇴근 상태 */}
                    <div className="card status-card">
                        <div className="status-header">
                            <span className={`status-indicator ${isCheckedIn ? 'active' : isCheckedOut ? 'done' : 'idle'}`}></span>
                            <span className="status-label">
                                {isCheckedIn ? '근무중' : isCheckedOut ? '퇴근함' : '미출근'}
                            </span>
                        </div>

                        {todayAttendance?.check_in && (
                            <div className="status-details">
                                <div className="status-item">
                                    <span className="status-item-label">출근</span>
                                    <span className="status-item-value">{formatTime(todayAttendance.check_in)}</span>
                                </div>
                                {todayAttendance.check_out && (
                                    <div className="status-item">
                                        <span className="status-item-label">퇴근</span>
                                        <span className="status-item-value">{formatTime(todayAttendance.check_out)}</span>
                                    </div>
                                )}
                                <div className="status-item">
                                    <span className="status-item-label">근무시간</span>
                                    <span className="status-item-value highlight">
                                        {formatDuration(
                                            isCheckedIn
                                                ? workDuration
                                                : todayAttendance.check_out
                                                    ? calculateMinutesBetween(todayAttendance.check_in, todayAttendance.check_out)
                                                    : todayAttendance.work_duration_minutes
                                                        ? todayAttendance.work_duration_minutes
                                                        : calculateMinutesBetween(todayAttendance.check_in, getDefaultEndTime())
                                        )}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 자리비움 상태 */}
                    <div className="card status-card">
                        <div className="status-header">
                            <span className={`status-indicator ${currentAway ? 'away' : 'idle'}`}></span>
                            <span className="status-label">
                                {currentAway ? '자리비움' : '자리'}
                            </span>
                        </div>

                        <div className="status-details">
                            <div className="status-item">
                                <span className="status-item-label">오늘 자리비움</span>
                                <span className="status-item-value">{todayRecords.length}회</span>
                            </div>
                            <div className="status-item">
                                <span className="status-item-label">총 시간</span>
                                <span className="status-item-value">{formatDuration(awayMinutes)}</span>
                            </div>
                            {currentAway && (
                                <div className="status-item">
                                    <span className="status-item-label">시작</span>
                                    <span className="status-item-value">{formatTime(currentAway.start_time)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 액션 버튼 */}
                <div className="action-buttons">
                    {!isCheckedIn && !isCheckedOut && (
                        <button
                            className="btn btn-success btn-lg action-btn"
                            onClick={handleCheckIn}
                            disabled={loading}
                        >
                            🏢 출근하기
                        </button>
                    )}

                    {isCheckedIn && (
                        <>
                            <button
                                className={`btn ${currentAway ? 'btn-warning' : 'btn-secondary'} btn-lg action-btn`}
                                onClick={handleAwayToggle}
                                disabled={loading}
                            >
                                {currentAway ? '🏃 복귀하기' : '🚶 자리비움'}
                            </button>

                            <button
                                className="btn btn-danger btn-lg action-btn"
                                onClick={handleCheckOut}
                                disabled={loading}
                            >
                                🏠 퇴근하기
                            </button>
                        </>
                    )}

                    {isCheckedOut && (
                        <>
                            <div className="checkout-message">
                                <p>오늘 하루도 수고하셨습니다! 👏</p>
                            </div>
                            <button
                                className="btn btn-primary btn-lg action-btn"
                                onClick={handleCancelCheckOut}
                                disabled={loading}
                            >
                                🏢 근무시작
                            </button>
                        </>
                    )}
                </div>

                {/* 메모 입력 */}
                <div className="card memo-card">
                    <label htmlFor="memo" className="memo-label">오늘의 메모</label>
                    <textarea
                        id="memo"
                        className="input memo-input"
                        placeholder="예: 재택근무, 외근 등"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        onBlur={handleMemoBlur}
                        rows={2}
                    />
                </div>
            </div>
        </div>
    );
}

export default MainView;
