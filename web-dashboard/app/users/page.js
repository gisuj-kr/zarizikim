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

    // 팝업 상태
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [showModal, setShowModal] = useState(false);

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

    // 점심시간 설정 (기본값: 11:30 ~ 13:00)
    const LUNCH_START_HOUR = 11;
    const LUNCH_START_MIN = 30;
    const LUNCH_END_HOUR = 13;
    const LUNCH_END_MIN = 0;

    // 점심시간(분) 계산 - 근무시간과 겹치는 부분만 계산
    const calculateLunchMinutes = (checkInTime, checkOutTime) => {
        const checkIn = new Date(checkInTime);
        const checkOut = new Date(checkOutTime);

        const lunchStart = new Date(checkIn);
        lunchStart.setHours(LUNCH_START_HOUR, LUNCH_START_MIN, 0, 0);

        const lunchEnd = new Date(checkIn);
        lunchEnd.setHours(LUNCH_END_HOUR, LUNCH_END_MIN, 0, 0);

        // 점심시간이 근무시간과 겹치는지 확인
        if (checkIn >= lunchEnd || checkOut <= lunchStart) {
            return 0;
        }

        // 겹치는 시간 계산
        const overlapStart = checkIn > lunchStart ? checkIn : lunchStart;
        const overlapEnd = checkOut < lunchEnd ? checkOut : lunchEnd;

        return Math.max(0, Math.round((overlapEnd - overlapStart) / 60000));
    };

    // 근무 시간 계산 (점심시간 차감 포함)
    // - 09:00 이전 출근 시 09:00부터 계산
    // - check_out이 있으면 check_in ~ check_out
    // - check_out이 없고 work_duration_minutes가 있으면 18시 기준 계산 (시스템 종료로 인한 자동 퇴근)
    // - 둘 다 없으면 18시 기준으로 계산
    const calculateWorkMinutes = (record) => {
        if (!record.check_in) return 0;

        let startTime = new Date(record.check_in);
        let endTime;

        // 09:00 이전 출근 시 09:00부터 계산
        const workStartTime = new Date(startTime);
        workStartTime.setHours(9, 0, 0, 0);
        if (startTime < workStartTime) {
            startTime = workStartTime;
        } else {
            // 09:00 이후 출근이라도 초/밀리초는 0으로 맞춤 (정확한 분 단위 계산)
            startTime.setSeconds(0, 0);
        }

        // 퇴근 기록이 있으면 정상 계산
        if (record.check_out) {
            endTime = new Date(record.check_out);
        }
        // 시스템 종료로 인한 자동 퇴근 또는 둘 다 없으면 18시 기준
        else {
            endTime = new Date(startTime);
            endTime.setHours(18, 0, 0, 0);
            if (startTime >= endTime) return 0;
        }

        // 총 근무 시간 계산
        let totalMinutes = Math.round((endTime - startTime) / 60000);

        // 점심시간 차감
        const lunchMinutes = calculateLunchMinutes(startTime, endTime);
        totalMinutes -= lunchMinutes;

        return Math.max(0, totalMinutes);
    };

    // 날짜별 자리비움 기록 가져오기
    const getAwayRecordsByDate = (date) => {
        return awayHistory.filter(r => {
            const recordDate = new Date(r.start_time).toISOString().split('T')[0];
            return recordDate === date;
        });
    };

    // 날짜별 자리비움 시간 합계
    const getAwayMinutesByDate = (date) => {
        const dateRecords = getAwayRecordsByDate(date);
        return dateRecords.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
    };

    // row 클릭 시 팝업 열기
    const handleRowClick = (record) => {
        const dayRecords = getAwayRecordsByDate(record.date);
        setSelectedRecord({
            ...record,
            awayRecords: dayRecords,
        });
        setShowModal(true);
    };

    // 팝업 닫기
    const closeModal = () => {
        setShowModal(false);
        setSelectedRecord(null);
    };

    // 통계 계산
    const calculateStats = () => {
        // check_in이 있는 모든 날을 출근일로 계산 (근무시간이 계산되는 모든 날)
        const workDays = history.filter(h => h.check_in).length;
        let totalWorkMinutes = 0;
        let totalAwayMinutes = 0;

        history.forEach(h => {
            const workMin = calculateWorkMinutes(h);
            if (workMin > 0) {
                totalWorkMinutes += workMin;
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
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            날짜를 클릭하면 자리비움 상세 내역을 볼 수 있습니다.
                        </p>
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
                                            const workMinutes = calculateWorkMinutes(record);
                                            const netWorkMinutes = workMinutes - awayMinutes;

                                            return (
                                                <tr
                                                    key={record.id}
                                                    onClick={() => handleRowClick(record)}
                                                    className="clickable-row"
                                                >
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

            {/* 자리비움 상세보기 팝업 */}
            {showModal && selectedRecord && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🪑 자리비움 상세 내역</h3>
                            <button className="modal-close" onClick={closeModal}>✕</button>
                        </div>
                        <div className="modal-content">
                            <div className="modal-user-info">
                                <strong>{selectedUser?.name}</strong>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                                    {formatDate(selectedRecord.date)} | {formatTime(selectedRecord.check_in)} ~ {selectedRecord.check_out ? formatTime(selectedRecord.check_out) : '근무중'}
                                </span>
                            </div>

                            {selectedRecord.awayRecords.length === 0 ? (
                                <div className="empty-state" style={{ padding: '2rem' }}>
                                    이 날 자리비움 기록이 없습니다.
                                </div>
                            ) : (
                                <>
                                    <div className="modal-summary">
                                        <span>총 자리비움: </span>
                                        <strong style={{ color: 'var(--color-warning)' }}>
                                            {formatDuration(getAwayMinutesByDate(selectedRecord.date))}
                                        </strong>
                                        <span style={{ marginLeft: '16px' }}>횟수: </span>
                                        <strong>{selectedRecord.awayRecords.length}회</strong>
                                    </div>
                                    <table className="table modal-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>시작 시간</th>
                                                <th>복귀 시간</th>
                                                <th>소요 시간</th>
                                                <th>구분</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedRecord.awayRecords.map((record, index) => (
                                                <tr key={record.id}>
                                                    <td>{index + 1}</td>
                                                    <td>{formatTime(record.start_time)}</td>
                                                    <td>
                                                        {record.end_time ? formatTime(record.end_time) : (
                                                            <span className="badge badge-warning">진행중</span>
                                                        )}
                                                    </td>
                                                    <td>{record.duration_minutes ? formatDuration(record.duration_minutes) : '-'}</td>
                                                    <td>
                                                        {record.is_auto_detected ? (
                                                            <span className="badge badge-secondary">자동</span>
                                                        ) : (
                                                            <span className="badge badge-primary">수동</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

