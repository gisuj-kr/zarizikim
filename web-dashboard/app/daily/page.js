'use client';

/**
 * 일별 상세 페이지
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAttendanceByDate, getAwayRecordsByDate } from '../../lib/supabase';

export default function DailyPage() {
    // 로컬 시간 기준 오늘 날짜
    const getLocalDateString = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState(getLocalDateString());
    const [attendance, setAttendance] = useState([]);
    const [awayRecords, setAwayRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    // 데이터 로드
    const loadData = async () => {
        setLoading(true);
        try {
            const [attendanceData, awayData] = await Promise.all([
                getAttendanceByDate(date),
                getAwayRecordsByDate(date),
            ]);
            setAttendance(attendanceData);
            setAwayRecords(awayData);
        } catch (error) {
            console.error('데이터 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
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

    // 사용자별 자리비움 시간 합계
    const getAwayMinutes = (userId) => {
        const userRecords = awayRecords.filter(r => r.user_id === userId && r.duration_minutes);
        return userRecords.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
    };

    // 근무 시간 계산
    // - check_out이 있으면 check_in ~ check_out
    // - check_out이 없고 work_duration_minutes가 있으면 해당 값 사용 (시스템 종료로 인한 자동 퇴근)
    // - 둘 다 없으면 check_in ~ 18:00 기준으로 계산
    const calculateWorkMinutes = (record) => {
        if (!record.check_in) return 0;

        // 퇴근 기록이 있으면 정상 계산
        if (record.check_out) {
            const start = new Date(record.check_in);
            const end = new Date(record.check_out);
            return Math.round((end - start) / 60000);
        }

        // 시스템 종료로 인한 자동 퇴근 (work_duration_minutes 기록됨)
        if (record.work_duration_minutes) {
            return record.work_duration_minutes;
        }

        // 둘 다 없으면 18시 기준으로 계산
        const start = new Date(record.check_in);
        const end = new Date(record.check_in);
        end.setHours(18, 0, 0, 0);

        // 출근 시간이 18시 이후면 0 반환
        if (start >= end) return 0;

        return Math.round((end - start) / 60000);
    };

    // 통계 계산
    const stats = {
        totalUsers: attendance.length,
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
                            <div className="stat-label">출근 인원</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{formatDuration(stats.avgWorkMinutes)}</div>
                            <div className="stat-label">평균 근무시간</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.avgCheckIn}</div>
                            <div className="stat-label">평균 출근</div>
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
                            {attendance.length === 0 ? (
                                <div className="empty-state">해당 날짜에 기록이 없습니다.</div>
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
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
                                        {attendance.map(record => {
                                            const awayMinutes = getAwayMinutes(record.user_id);
                                            const workMinutes = calculateWorkMinutes(record);
                                            const netWorkMinutes = workMinutes - awayMinutes;

                                            return (
                                                <tr key={record.id}>
                                                    <td><strong>{record.users?.name || '알 수 없음'}</strong></td>
                                                    <td>{formatTime(record.check_in)}</td>
                                                    <td>{record.check_out ? formatTime(record.check_out) : '-'}</td>
                                                    <td>{formatDuration(workMinutes)}</td>
                                                    <td style={{ color: awayMinutes > 60 ? 'var(--color-warning)' : 'inherit' }}>
                                                        {formatDuration(awayMinutes)}
                                                    </td>
                                                    <td style={{ color: 'var(--color-success)' }}>
                                                        {formatDuration(netWorkMinutes)}
                                                    </td>
                                                    <td>{record.memo || '-'}</td>
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
