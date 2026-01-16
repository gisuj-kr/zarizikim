'use client';

/**
 * 일별 상세 페이지
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAttendanceByDate, getAwayRecordsByDate, getAllUsers } from '../../lib/supabase';

export default function DailyPage() {
    // 로컬 시간 기준 오늘 날짜
    const getLocalDateString = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState('');  // hydration 불일치 방지를 위해 초기값 비움
    const [users, setUsers] = useState([]);  // 전체 사용자 목록
    const [attendance, setAttendance] = useState([]);
    const [awayRecords, setAwayRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    // 데이터 로드
    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, attendanceData, awayData] = await Promise.all([
                getAllUsers(),
                getAttendanceByDate(date),
                getAwayRecordsByDate(date),
            ]);
            setUsers(usersData);
            setAttendance(attendanceData);
            setAwayRecords(awayData);
        } catch (error) {
            console.error('데이터 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // 초기 날짜 설정 (hydration 불일치 방지)
        if (!date) {
            setDate(getLocalDateString());
            return;
        }
        loadData();
    }, [date]);

    // 시간 포맷
    const formatTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleTimeString('ko-KR', {
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

    // 사용자별 출근 기록 가져오기
    const getUserAttendance = (userId) => {
        return attendance.find(a => a.user_id === userId);
    };

    // 사용자별 자리비움 시간 합계
    const getAwayMinutes = (userId) => {
        const userRecords = awayRecords.filter(r => r.user_id === userId && r.duration_minutes);
        return userRecords.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
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

    // 통계 계산
    const stats = {
        totalUsers: users.length,  // 전체 등록 사용자
        checkedIn: attendance.length,  // 출근 인원
        notCheckedIn: users.length - attendance.length,  // 미출근
        avgWorkMinutes: attendance.length > 0
            ? Math.round(attendance.reduce((sum, a) =>
                sum + calculateWorkMinutes(a), 0) / attendance.length)
            : 0,
        totalAwayMinutes: awayRecords.reduce((sum, r) => sum + (r.duration_minutes || 0), 0),
        avgCheckIn: attendance.length > 0 && attendance.some(a => a.check_in)
            ? new Date(attendance.filter(a => a.check_in).reduce((sum, a, _, arr) =>
                sum + new Date(a.check_in).getTime() / arr.length, 0))
                .toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '-',
    };

    return (
        <div className="container">
            {/* 헤더 */}
            <header className="header">
                <h1>📅 일별 상세</h1>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    max={getLocalDateString()}
                />
            </header>

            {/* 네비게이션 */}
            <nav className="nav">
                <Link href="/" className="nav-link">오늘 현황</Link>
                <Link href="/daily" className="nav-link active">일별 조회</Link>
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
                            <div className="stat-value">{stats.totalUsers}</div>
                            <div className="stat-label">전체 인원</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.checkedIn}</div>
                            <div className="stat-label">출근 인원</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>
                                {stats.notCheckedIn}
                            </div>
                            <div className="stat-label">미출근</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{formatDuration(stats.avgWorkMinutes)}</div>
                            <div className="stat-label">평균 근무시간</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
                                {formatDuration(stats.totalAwayMinutes)}
                            </div>
                            <div className="stat-label">총 자리비움</div>
                        </div>
                    </div>

                    {/* 출퇴근 기록 */}
                    <div className="card">
                        <h2 className="card-title">
                            {new Date(date).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                weekday: 'long'
                            })} 기록
                        </h2>
                        <div className="table-container">
                            {users.length === 0 ? (
                                <div className="empty-state">등록된 사용자가 없습니다.</div>
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
                                            <th>실근무</th>
                                            <th>메모</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(user => {
                                            const record = getUserAttendance(user.id);
                                            const hasAttendance = !!record;
                                            const awayMinutes = getAwayMinutes(user.id);
                                            const workMinutes = hasAttendance ? calculateWorkMinutes(record) : 0;
                                            const netWorkMinutes = workMinutes - awayMinutes;

                                            return (
                                                <tr key={user.id}>
                                                    <td>
                                                        <span className={`status-dot ${hasAttendance ? 'offline' : 'not-checked'}`}></span>
                                                        {hasAttendance ? '출근' : '미출근'}
                                                    </td>
                                                    <td><strong>{user.name || '알 수 없음'}</strong></td>
                                                    <td>{hasAttendance ? formatTime(record.check_in) : '-'}</td>
                                                    <td>{hasAttendance && record.check_out ? formatTime(record.check_out) : '-'}</td>
                                                    <td>{hasAttendance ? formatDuration(workMinutes) : '-'}</td>
                                                    <td style={{ color: awayMinutes > 60 ? 'var(--color-warning)' : 'inherit' }}>
                                                        {hasAttendance ? formatDuration(awayMinutes) : '-'}
                                                    </td>
                                                    <td style={{ color: 'var(--color-success)' }}>
                                                        {hasAttendance ? formatDuration(netWorkMinutes) : '-'}
                                                    </td>
                                                    <td>{record?.memo || '-'}</td>
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
