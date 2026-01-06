'use client';

/**
 * 웹 대시보드 메인 페이지 - 오늘 출퇴근 현황
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTodayAttendance, getTodayAwayRecords } from '../lib/supabase';

export default function HomePage() {
    const [attendance, setAttendance] = useState([]);
    const [awayRecords, setAwayRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    // 데이터 로드
    const loadData = async () => {
        try {
            const [attendanceData, awayData] = await Promise.all([
                getTodayAttendance(),
                getTodayAwayRecords(),
            ]);
            setAttendance(attendanceData);
            setAwayRecords(awayData);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('데이터 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    // 초기 로드 및 1분마다 자동 새로고침
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 60000);
        return () => clearInterval(interval);
    }, []);

    // 사용자별 자리비움 시간 합계 계산
    const getAwayMinutes = (userId) => {
        const userRecords = awayRecords.filter(r => r.user_id === userId && r.duration_minutes);
        return userRecords.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
    };

    // 현재 자리비움 중인지 확인
    const isCurrentlyAway = (userId) => {
        return awayRecords.some(r => r.user_id === userId && !r.end_time);
    };

    // 시간 포맷
    const formatTime = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    // 분을 시간:분 형식으로 변환
    const formatDuration = (minutes) => {
        if (!minutes || minutes <= 0) return '0분';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours === 0) return `${mins}분`;
        if (mins === 0) return `${hours}시간`;
        return `${hours}시간 ${mins}분`;
    };

    // 근무 시간 계산
    const calculateWorkMinutes = (checkIn, checkOut) => {
        if (!checkIn) return 0;
        const start = new Date(checkIn);
        const end = checkOut ? new Date(checkOut) : new Date();
        return Math.round((end - start) / 60000);
    };

    // 통계 계산
    const stats = {
        total: attendance.length,
        working: attendance.filter(a => a.check_in && !a.check_out).length,
        away: attendance.filter(a => isCurrentlyAway(a.user_id)).length,
        left: attendance.filter(a => a.check_out).length,
    };

    const today = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
    });

    return (
        <div className="container">
            {/* 헤더 */}
            <header className="header">
                <div>
                    <h1>🏢 자리지킴 대시보드</h1>
                    <p className="header-date">{today}</p>
                </div>
                {lastUpdate && (
                    <span className="auto-refresh">
                        마지막 업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
                    </span>
                )}
            </header>

            {/* 네비게이션 */}
            <nav className="nav">
                <Link href="/" className="nav-link active">오늘 현황</Link>
                <Link href="/daily" className="nav-link">일별 조회</Link>
                <Link href="/users" className="nav-link">사용자별</Link>
            </nav>

            {loading ? (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>로딩 중...</p>
                </div>
            ) : (
                <>
                    {/* 통계 카드 */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{stats.total}</div>
                            <div className="stat-label">총 출근</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                                {stats.working}
                            </div>
                            <div className="stat-label">근무중</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
                                {stats.away}
                            </div>
                            <div className="stat-label">자리비움</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.left}</div>
                            <div className="stat-label">퇴근</div>
                        </div>
                    </div>

                    {/* 출퇴근 현황 테이블 */}
                    <div className="card">
                        <h2 className="card-title">오늘 출퇴근 현황</h2>
                        <div className="table-container">
                            {attendance.length === 0 ? (
                                <div className="empty-state">
                                    아직 출근한 사용자가 없습니다.
                                </div>
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>상태</th>
                                            <th>이름</th>
                                            <th>출근</th>
                                            <th>퇴근</th>
                                            <th>근무시간</th>
                                            <th>자리비움</th>
                                            <th>메모</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendance.map(record => {
                                            const isAway = isCurrentlyAway(record.user_id);
                                            const isWorking = record.check_in && !record.check_out;
                                            const awayMinutes = getAwayMinutes(record.user_id);
                                            const workMinutes = calculateWorkMinutes(record.check_in, record.check_out);

                                            return (
                                                <tr key={record.id}>
                                                    <td>
                                                        <span className={`status-dot ${isAway ? 'away' : isWorking ? 'working' : 'offline'
                                                            }`}></span>
                                                        {isAway ? '자리비움' : isWorking ? '근무중' : '퇴근'}
                                                    </td>
                                                    <td><strong>{record.users?.name || '알 수 없음'}</strong></td>
                                                    <td>
                                                        {formatTime(record.check_in)}
                                                        {record.is_auto_check_in && (
                                                            <span className="badge badge-secondary" style={{ marginLeft: '4px' }}>
                                                                자동
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {record.check_out ? formatTime(record.check_out) : '-'}
                                                        {record.is_auto_check_out && (
                                                            <span className="badge badge-secondary" style={{ marginLeft: '4px' }}>
                                                                자동
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>{formatDuration(workMinutes)}</td>
                                                    <td style={{ color: awayMinutes > 60 ? 'var(--color-warning)' : 'inherit' }}>
                                                        {formatDuration(awayMinutes)}
                                                    </td>
                                                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {record.memo || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
