'use client';

/**
 * 사용자별 상세 페이지
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllUsers, getUserAttendanceHistory, getUserAwayHistory } from '../../lib/supabase';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [history, setHistory] = useState([]);
    const [awayHistory, setAwayHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // 사용자 목록 로드
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const data = await getAllUsers();
                setUsers(data);
                if (data.length > 0) {
                    setSelectedUserId(data[0].id);
                }
            } catch (error) {
                console.error('사용자 로드 실패:', error);
            } finally {
                setLoading(false);
            }
        };
        loadUsers();
    }, []);

    // 선택된 사용자 히스토리 로드
    useEffect(() => {
        if (!selectedUserId) return;

        const loadHistory = async () => {
            setLoading(true);
            try {
                const [attendanceData, awayData] = await Promise.all([
                    getUserAttendanceHistory(selectedUserId, 30),
                    getUserAwayHistory(selectedUserId, 30),
                ]);
                setHistory(attendanceData);
                setAwayHistory(awayData);
            } catch (error) {
                console.error('히스토리 로드 실패:', error);
            } finally {
                setLoading(false);
            }
        };
        loadHistory();
    }, [selectedUserId]);

    // 시간 포맷
    const formatTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    // 날짜 포맷
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            weekday: 'short',
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
        if (!checkIn || !checkOut) return 0;
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        return Math.round((end - start) / 60000);
    };

    // 날짜별 자리비움 시간 합계
    const getAwayMinutesByDate = (date) => {
        const dateRecords = awayHistory.filter(r => {
            const recordDate = new Date(r.start_time).toISOString().split('T')[0];
            return recordDate === date && r.duration_minutes;
        });
        return dateRecords.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
    };

    // 통계 계산
    const calculateStats = () => {
        const workDays = history.filter(h => h.check_in && h.check_out).length;
        let totalWorkMinutes = 0;
        let totalAwayMinutes = 0;

        history.forEach(h => {
            if (h.check_in && h.check_out) {
                totalWorkMinutes += calculateWorkMinutes(h.check_in, h.check_out);
            }
            totalAwayMinutes += getAwayMinutesByDate(h.date);
        });

        return {
            workDays,
            totalWorkMinutes,
            totalAwayMinutes,
            avgWorkMinutes: workDays > 0 ? Math.round(totalWorkMinutes / workDays) : 0,
            netWorkMinutes: totalWorkMinutes - totalAwayMinutes,
        };
    };

    const stats = calculateStats();
    const selectedUser = users.find(u => u.id === selectedUserId);

    return (
        <div className="container">
            {/* 헤더 */}
            <header className="header">
                <h1>👤 사용자별 상세</h1>
                <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                >
                    {users.map(user => (
                        <option key={user.id} value={user.id}>
                            {user.name}
                        </option>
                    ))}
                </select>
            </header>

            {/* 네비게이션 */}
            <nav className="nav">
                <Link href="/" className="nav-link">오늘 현황</Link>
                <Link href="/daily" className="nav-link">일별 조회</Link>
                <Link href="/users" className="nav-link active">사용자별</Link>
            </nav>

            {loading ? (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>로딩 중...</p>
                </div>
            ) : selectedUser ? (
                <>
                    {/* 사용자 정보 */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <h2 className="card-title">{selectedUser.name}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {selectedUser.device_name} | 최근 30일 통계
                        </p>
                    </div>

                    {/* 통계 카드 */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{stats.workDays}일</div>
                            <div className="stat-label">출근일</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{formatDuration(stats.totalWorkMinutes)}</div>
                            <div className="stat-label">총 근무시간</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{formatDuration(stats.avgWorkMinutes)}</div>
                            <div className="stat-label">일평균 근무</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
                                {formatDuration(stats.totalAwayMinutes)}
                            </div>
                            <div className="stat-label">총 자리비움</div>
                        </div>
                    </div>

                    {/* 히스토리 테이블 */}
                    <div className="card">
                        <h2 className="card-title">최근 30일 기록</h2>
                        <div className="table-container">
                            {history.length === 0 ? (
                                <div className="empty-state">기록이 없습니다.</div>
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>날짜</th>
                                            <th>출근</th>
                                            <th>퇴근</th>
                                            <th>근무시간</th>
                                            <th>자리비움</th>
                                            <th>실근무</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map(record => {
                                            const awayMinutes = getAwayMinutesByDate(record.date);
                                            const workMinutes = calculateWorkMinutes(record.check_in, record.check_out);
                                            const netWorkMinutes = workMinutes - awayMinutes;

                                            return (
                                                <tr key={record.id}>
                                                    <td>{formatDate(record.date)}</td>
                                                    <td>{formatTime(record.check_in)}</td>
                                                    <td>{record.check_out ? formatTime(record.check_out) : '-'}</td>
                                                    <td>{formatDuration(workMinutes)}</td>
                                                    <td style={{ color: awayMinutes > 60 ? 'var(--color-warning)' : 'inherit' }}>
                                                        {formatDuration(awayMinutes)}
                                                    </td>
                                                    <td style={{ color: 'var(--color-success)' }}>
                                                        {formatDuration(netWorkMinutes)}
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
            ) : (
                <div className="empty-state">사용자를 선택해주세요.</div>
            )}
        </div>
    );
}
