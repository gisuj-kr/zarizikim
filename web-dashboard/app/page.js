'use client';

/**
 * 웹 대시보드 메인 페이지 - 오늘 출퇴근 현황
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTodayAttendance, getTodayAwayRecords, deleteAwayRecord, updateAwayRecord, getAllUsers } from '../lib/supabase';

export default function HomePage() {
    const [users, setUsers] = useState([]);  // 전체 사용자 목록
    const [attendance, setAttendance] = useState([]);
    const [awayRecords, setAwayRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [today, setToday] = useState('');  // hydration 불일치 방지를 위해 클라이언트에서 설정

    // 팝업 상태
    const [selectedUser, setSelectedUser] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // 미처리 출근 정리 상태
    const [cleanupLoading, setCleanupLoading] = useState(false);

    // 데이터 로드
    const loadData = async () => {
        try {
            const [usersData, attendanceData, awayData] = await Promise.all([
                getAllUsers(),
                getTodayAttendance(),
                getTodayAwayRecords(),
            ]);
            setUsers(usersData);
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
        // 클라이언트에서만 날짜 설정 (hydration 불일치 방지)
        setToday(new Date().toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
        }));
        loadData();
        const interval = setInterval(loadData, 60000);
        return () => clearInterval(interval);
    }, []);

    // 미처리 출근 기록 수동 정리
    const handleCleanupAttendance = async () => {
        if (!confirm('모든 미처리 출근 기록을 정리하시겠습니까?\n(전날 이전 기록이 18시 기준 근무시간으로 자동 처리됩니다)')) {
            return;
        }

        setCleanupLoading(true);
        try {
            const response = await fetch('/api/cron/cleanup-attendance');
            const result = await response.json();

            if (response.ok) {
                alert(`처리 완료!\n${result.message}`);
                // 데이터 새로고침
                await loadData();
            } else {
                alert(`오류 발생: ${result.error}`);
            }
        } catch (error) {
            console.error('미처리 출근 정리 오류:', error);
            alert('오류가 발생했습니다.');
        } finally {
            setCleanupLoading(false);
        }
    };

    // 사용자별 출근 기록 가져오기
    const getUserAttendance = (userId) => {
        return attendance.find(a => a.user_id === userId);
    };

    // 사용자별 자리비움 시간 합계 계산
    const getAwayMinutes = (userId) => {
        const userRecords = awayRecords.filter(r => r.user_id === userId && r.duration_minutes);
        return userRecords.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
    };

    // 사용자별 자리비움 기록 가져오기 (시간순 정렬)
    const getUserAwayRecords = (userId) => {
        return awayRecords
            .filter(r => r.user_id === userId)
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
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
    // - 둘 다 없으면 현재 시간까지 (오늘 현황용)
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
        // 시스템 종료로 인한 자동 퇴근 (work_duration_minutes 기록됨) - 18시 기준
        else if (record.is_auto_check_out || record.work_duration_minutes) {
            endTime = new Date(startTime);
            endTime.setHours(18, 0, 0, 0);
            if (startTime >= endTime) return 0;
        }
        // 근무 중이면 현재 시간까지
        else {
            endTime = new Date();
        }

        // 총 근무 시간 계산
        let totalMinutes = Math.round((endTime - startTime) / 60000);

        // 점심시간 차감
        const lunchMinutes = calculateLunchMinutes(startTime, endTime);
        totalMinutes -= lunchMinutes;

        return Math.max(0, totalMinutes);
    };

    // 사용자 클릭 시 팝업 열기
    const handleUserClick = (user, attendanceRecord) => {
        setSelectedUser({
            user_id: user.id,
            users: user,
            check_in: attendanceRecord?.check_in,
            check_out: attendanceRecord?.check_out,
            awayRecords: getUserAwayRecords(user.id),
        });
        setShowModal(true);
        setEditingRecord(null);
    };

    // 팝업 닫기
    const closeModal = () => {
        setShowModal(false);
        setSelectedUser(null);
        setEditingRecord(null);
    };

    // 수정 중인 자리비움 기록
    const [editingRecord, setEditingRecord] = useState(null);

    // 자리비움 기록 삭제
    const handleDeleteAwayRecord = async (recordId) => {
        if (!confirm('이 자리비움 기록을 삭제하시겠습니까?')) return;

        try {
            await deleteAwayRecord(recordId);
            // 데이터 새로고침
            await loadData();
            // selectedUser의 awayRecords 업데이트
            if (selectedUser) {
                setSelectedUser({
                    ...selectedUser,
                    awayRecords: selectedUser.awayRecords.filter(r => r.id !== recordId),
                });
            }
        } catch (error) {
            console.error('삭제 실패:', error);
            alert('삭제에 실패했습니다.');
        }
    };

    // 자리비움 기록 수정 시작
    const handleEditStart = (record) => {
        setEditingRecord({
            ...record,
            editStartTime: formatTimeForInput(record.start_time),
            editEndTime: record.end_time ? formatTimeForInput(record.end_time) : '',
        });
    };

    // 시간 input용 포맷 (HH:MM)
    const formatTimeForInput = (dateStr) => {
        const date = new Date(dateStr);
        return date.toTimeString().slice(0, 5);
    };

    // 자리비움 기록 수정 저장
    const handleEditSave = async () => {
        if (!editingRecord) return;

        try {
            // 날짜 부분 유지하면서 시간만 변경
            const originalDate = new Date(editingRecord.start_time).toISOString().split('T')[0];
            const newStartTime = new Date(`${originalDate}T${editingRecord.editStartTime}:00`);
            const newEndTime = editingRecord.editEndTime
                ? new Date(`${originalDate}T${editingRecord.editEndTime}:00`)
                : null;

            await updateAwayRecord(
                editingRecord.id,
                newStartTime.toISOString(),
                newEndTime ? newEndTime.toISOString() : null
            );

            // 데이터 새로고침
            await loadData();
            setEditingRecord(null);

            // selectedUser의 awayRecords 업데이트
            if (selectedUser) {
                const updatedRecords = selectedUser.awayRecords.map(r => {
                    if (r.id === editingRecord.id) {
                        const durationMinutes = newEndTime
                            ? Math.round((newEndTime - newStartTime) / 60000)
                            : null;
                        return {
                            ...r,
                            start_time: newStartTime.toISOString(),
                            end_time: newEndTime ? newEndTime.toISOString() : null,
                            duration_minutes: durationMinutes,
                        };
                    }
                    return r;
                });
                setSelectedUser({
                    ...selectedUser,
                    awayRecords: updatedRecords,
                });
            }
        } catch (error) {
            console.error('수정 실패:', error);
            alert('수정에 실패했습니다.');
        }
    };

    // 수정 취소
    const handleEditCancel = () => {
        setEditingRecord(null);
    };

    // 통계 계산
    const stats = {
        total: users.length,  // 전체 등록 사용자
        checked_in: attendance.length,  // 금일 출근
        not_checked_in: users.length - attendance.length,  // 미출근
        // 근무중: check_in 있고, check_out 없고, work_duration_minutes도 없으면 근무중
        working: attendance.filter(a => a.check_in && !a.check_out && !a.work_duration_minutes).length,
        away: attendance.filter(a => isCurrentlyAway(a.user_id)).length,
        // 퇴근: check_out 있거나, work_duration_minutes 있으면 퇴근
        left: attendance.filter(a => a.check_out || a.work_duration_minutes).length,
    };

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
                <div className="nav-links">
                    <Link href="/" className="nav-link active">오늘 현황</Link>
                    <Link href="/daily" className="nav-link">일별 조회</Link>
                    <Link href="/users" className="nav-link">사용자별</Link>
                </div>
                <button
                    className="btn btn-warning"
                    onClick={handleCleanupAttendance}
                    disabled={cleanupLoading}
                    title="전날 이전 미처리 출근 기록을 18시 기준으로 자동 처리합니다"
                >
                    {cleanupLoading ? '처리 중...' : '🔧 미처리 출근 정리'}
                </button>
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
                            <div className="stat-label">전체 인원</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>
                                {stats.not_checked_in}
                            </div>
                            <div className="stat-label">미출근</div>
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
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            사용자를 클릭하면 자리비움 상세 내역을 볼 수 있습니다.
                        </p>
                        <div className="table-container">
                            {users.length === 0 ? (
                                <div className="empty-state">
                                    등록된 사용자가 없습니다.
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
                                        {users.map(user => {
                                            const record = getUserAttendance(user.id);
                                            const hasAttendance = !!record;
                                            const isAway = hasAttendance && isCurrentlyAway(user.id);
                                            // 근무중: 출근 기록이 있고, check_out 없고, work_duration_minutes도 없어야 함
                                            const isWorking = hasAttendance && record.check_in && !record.check_out && !record.work_duration_minutes;
                                            const isLeft = hasAttendance && (record.check_out || record.work_duration_minutes);
                                            const awayMinutes = getAwayMinutes(user.id);
                                            const workMinutes = hasAttendance ? calculateWorkMinutes(record) : 0;

                                            // 상태 결정: 미출근 > 자리비움 > 근무중 > 퇴근
                                            let statusClass = '';
                                            let statusText = '';
                                            if (!hasAttendance) {
                                                statusClass = 'not-checked';
                                                statusText = '미출근';
                                            } else if (isAway) {
                                                statusClass = 'away';
                                                statusText = '자리비움';
                                            } else if (isWorking) {
                                                statusClass = 'working';
                                                statusText = '근무중';
                                            } else {
                                                statusClass = 'offline';
                                                statusText = '퇴근';
                                            }

                                            return (
                                                <tr
                                                    key={user.id}
                                                    onClick={() => handleUserClick(user, record)}
                                                    style={{ cursor: 'pointer' }}
                                                    className="clickable-row"
                                                >
                                                    <td>
                                                        <span className={`status-dot ${statusClass}`}></span>
                                                        {statusText}
                                                    </td>
                                                    <td><strong>{user.name || '알 수 없음'}</strong></td>
                                                    <td>
                                                        {hasAttendance ? formatTime(record.check_in) : '-'}
                                                        {record?.is_auto_check_in && (
                                                            <span className="badge badge-secondary" style={{ marginLeft: '4px' }}>
                                                                자동
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {hasAttendance && record.check_out ? formatTime(record.check_out) : '-'}
                                                        {record?.is_auto_check_out && (
                                                            <span className="badge badge-secondary" style={{ marginLeft: '4px' }}>
                                                                자동
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>{hasAttendance ? formatDuration(workMinutes) : '-'}</td>
                                                    <td style={{ color: awayMinutes > 60 ? 'var(--color-warning)' : 'inherit' }}>
                                                        {hasAttendance ? formatDuration(awayMinutes) : '-'}
                                                    </td>
                                                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {record?.memo || '-'}
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

            {/* 자리비움 상세보기 팝업 */}
            {showModal && selectedUser && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🪑 자리비움 상세 내역</h3>
                            <button className="modal-close" onClick={closeModal}>✕</button>
                        </div>
                        <div className="modal-content">
                            <div className="modal-user-info">
                                <strong>{selectedUser.users?.name || '알 수 없음'}</strong>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                                    {formatTime(selectedUser.check_in)} ~ {selectedUser.check_out ? formatTime(selectedUser.check_out) : '근무중'}
                                </span>
                            </div>

                            {selectedUser.awayRecords.length === 0 ? (
                                <div className="empty-state" style={{ padding: '2rem' }}>
                                    오늘 자리비움 기록이 없습니다.
                                </div>
                            ) : (
                                <>
                                    <div className="modal-summary">
                                        <span>총 자리비움: </span>
                                        <strong style={{ color: 'var(--color-warning)' }}>
                                            {formatDuration(getAwayMinutes(selectedUser.user_id))}
                                        </strong>
                                        <span style={{ marginLeft: '16px' }}>횟수: </span>
                                        <strong>{selectedUser.awayRecords.length}회</strong>
                                    </div>
                                    <table className="table modal-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>시작 시간</th>
                                                <th>복귀 시간</th>
                                                <th>소요 시간</th>
                                                <th>구분</th>
                                                <th>관리</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedUser.awayRecords.map((record, index) => (
                                                <tr key={record.id}>
                                                    <td>{index + 1}</td>
                                                    <td>
                                                        {editingRecord?.id === record.id ? (
                                                            <input
                                                                type="time"
                                                                value={editingRecord.editStartTime}
                                                                onChange={(e) => setEditingRecord({
                                                                    ...editingRecord,
                                                                    editStartTime: e.target.value
                                                                })}
                                                                className="input time-input-small"
                                                            />
                                                        ) : (
                                                            formatTime(record.start_time)
                                                        )}
                                                    </td>
                                                    <td>
                                                        {editingRecord?.id === record.id ? (
                                                            <input
                                                                type="time"
                                                                value={editingRecord.editEndTime}
                                                                onChange={(e) => setEditingRecord({
                                                                    ...editingRecord,
                                                                    editEndTime: e.target.value
                                                                })}
                                                                className="input time-input-small"
                                                            />
                                                        ) : (
                                                            record.end_time ? formatTime(record.end_time) : (
                                                                <span className="badge badge-warning">진행중</span>
                                                            )
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
                                                    <td>
                                                        {editingRecord?.id === record.id ? (
                                                            <div className="action-buttons">
                                                                <button
                                                                    className="btn btn-sm btn-success"
                                                                    onClick={handleEditSave}
                                                                    title="저장"
                                                                >
                                                                    ✓
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-secondary"
                                                                    onClick={handleEditCancel}
                                                                    title="취소"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="action-buttons">
                                                                <button
                                                                    className="btn btn-sm btn-secondary"
                                                                    onClick={() => handleEditStart(record)}
                                                                    title="수정"
                                                                >
                                                                    ✎
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-danger"
                                                                    onClick={() => handleDeleteAwayRecord(record.id)}
                                                                    title="삭제"
                                                                >
                                                                    🗑
                                                                </button>
                                                            </div>
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

