/**
 * Dashboard 컴포넌트 - 근무 시간 통계 대시보드
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useAttendanceStore } from '../stores/attendanceStore';
import { getAttendanceHistory } from '../services/attendance';
import { getAwayRecordsByDateRange, calculateTotalAwayMinutes } from '../services/away';
import { formatDate, formatTime, formatDuration, calculateMinutesBetween } from '../utils/time';
import { exportToCSV, exportToExcel } from '../utils/export';
import './Dashboard.css';

function Dashboard() {
    const { user } = useUserStore();
    const { loadHistory, history } = useAttendanceStore();
    const [period, setPeriod] = useState('week'); // week, month, all
    const [loading, setLoading] = useState(true);
    const [awayData, setAwayData] = useState({});

    // 기간별 일수 계산
    const getDays = () => {
        switch (period) {
            case 'week': return 7;
            case 'month': return 30;
            case 'all': return 365;
            default: return 7;
        }
    };

    // 데이터 로드
    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            setLoading(true);

            // 출퇴근 기록 로드
            await loadHistory(getDays());

            // 자리비움 데이터 로드
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - getDays());

            try {
                const awayRecords = await getAwayRecordsByDateRange(user.id, startDate, endDate);

                // 날짜별로 그룹화
                const grouped = {};
                awayRecords.forEach(record => {
                    const date = new Date(record.start_time).toISOString().split('T')[0];
                    if (!grouped[date]) {
                        grouped[date] = [];
                    }
                    grouped[date].push(record);
                });

                setAwayData(grouped);
            } catch (error) {
                console.error('자리비움 데이터 로드 실패:', error);
            }

            setLoading(false);
        };

        fetchData();
    }, [user, period, loadHistory]);

    // 통계 계산
    const calculateStats = () => {
        const workDays = history.filter(h => h.check_in && h.check_out).length;

        let totalWorkMinutes = 0;
        let totalAwayMinutes = 0;

        history.forEach(h => {
            if (h.check_in && h.check_out) {
                totalWorkMinutes += calculateMinutesBetween(h.check_in, h.check_out);
            }

            const dateStr = h.date;
            if (awayData[dateStr]) {
                totalAwayMinutes += calculateTotalAwayMinutes(awayData[dateStr]);
            }
        });

        const avgWorkMinutes = workDays > 0 ? Math.round(totalWorkMinutes / workDays) : 0;
        const avgAwayMinutes = workDays > 0 ? Math.round(totalAwayMinutes / workDays) : 0;

        return {
            workDays,
            totalWorkMinutes,
            totalAwayMinutes,
            avgWorkMinutes,
            avgAwayMinutes,
            netWorkMinutes: totalWorkMinutes - totalAwayMinutes,
        };
    };

    const stats = calculateStats();

    // 내보내기
    const handleExport = (format) => {
        const data = history.map(h => {
            const dateStr = h.date;
            const awayRecords = awayData[dateStr] || [];
            const awayMinutes = calculateTotalAwayMinutes(awayRecords);
            const workMinutes = h.check_in && h.check_out
                ? calculateMinutesBetween(h.check_in, h.check_out)
                : 0;

            return {
                날짜: h.date,
                출근시간: h.check_in ? formatTime(h.check_in) : '-',
                퇴근시간: h.check_out ? formatTime(h.check_out) : '-',
                근무시간: formatDuration(workMinutes),
                자리비움시간: formatDuration(awayMinutes),
                실근무시간: formatDuration(workMinutes - awayMinutes),
                메모: h.memo || '',
            };
        });

        if (format === 'csv') {
            exportToCSV(data, `출퇴근기록_${user?.name}_${new Date().toISOString().split('T')[0]}`);
        } else {
            exportToExcel(data, `출퇴근기록_${user?.name}_${new Date().toISOString().split('T')[0]}`);
        }
    };

    return (
        <div className="dashboard">
            {/* 네비게이션 */}
            <nav className="nav">
                <Link to="/" className="nav-link">홈</Link>
                <Link to="/dashboard" className="nav-link active">대시보드</Link>
                <Link to="/settings" className="nav-link">설정</Link>
            </nav>

            <div className="dashboard-content">
                {/* 헤더 */}
                <div className="dashboard-header">
                    <h1>근무 통계</h1>

                    <div className="dashboard-controls">
                        <div className="period-selector">
                            <button
                                className={`period-btn ${period === 'week' ? 'active' : ''}`}
                                onClick={() => setPeriod('week')}
                            >
                                1주일
                            </button>
                            <button
                                className={`period-btn ${period === 'month' ? 'active' : ''}`}
                                onClick={() => setPeriod('month')}
                            >
                                1개월
                            </button>
                            <button
                                className={`period-btn ${period === 'all' ? 'active' : ''}`}
                                onClick={() => setPeriod('all')}
                            >
                                전체
                            </button>
                        </div>

                        <div className="export-buttons">
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleExport('csv')}
                            >
                                CSV
                            </button>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleExport('excel')}
                            >
                                Excel
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-screen">
                        <div className="loading-spinner"></div>
                        <p>로딩 중...</p>
                    </div>
                ) : (
                    <>
                        {/* 요약 카드 */}
                        <div className="stats-cards">
                            <div className="card stats-card">
                                <div className="stats-value">{stats.workDays}일</div>
                                <div className="stats-label">출근일</div>
                            </div>
                            <div className="card stats-card">
                                <div className="stats-value">{formatDuration(stats.totalWorkMinutes)}</div>
                                <div className="stats-label">총 근무시간</div>
                            </div>
                            <div className="card stats-card">
                                <div className="stats-value">{formatDuration(stats.avgWorkMinutes)}</div>
                                <div className="stats-label">일평균 근무</div>
                            </div>
                            <div className="card stats-card away">
                                <div className="stats-value">{formatDuration(stats.totalAwayMinutes)}</div>
                                <div className="stats-label">총 자리비움</div>
                            </div>
                        </div>

                        {/* 기록 테이블 */}
                        <div className="card">
                            <h2 className="card-title">상세 기록</h2>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>날짜</th>
                                            <th>출근</th>
                                            <th>퇴근</th>
                                            <th>근무시간</th>
                                            <th>자리비움</th>
                                            <th>메모</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="text-center text-muted">
                                                    기록이 없습니다.
                                                </td>
                                            </tr>
                                        ) : (
                                            history.map(record => {
                                                const dateStr = record.date;
                                                const awayRecords = awayData[dateStr] || [];
                                                const awayMinutes = calculateTotalAwayMinutes(awayRecords);
                                                const workMinutes = record.check_in && record.check_out
                                                    ? calculateMinutesBetween(record.check_in, record.check_out)
                                                    : 0;

                                                return (
                                                    <tr key={record.id}>
                                                        <td>{formatDate(record.date)}</td>
                                                        <td>
                                                            {formatTime(record.check_in)}
                                                            {record.is_auto_check_in && (
                                                                <span className="badge badge-secondary">자동</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {record.check_out ? formatTime(record.check_out) : '-'}
                                                            {record.is_auto_check_out && (
                                                                <span className="badge badge-secondary">자동</span>
                                                            )}
                                                        </td>
                                                        <td>{formatDuration(workMinutes)}</td>
                                                        <td className={awayMinutes > 60 ? 'text-warning' : ''}>
                                                            {formatDuration(awayMinutes)}
                                                        </td>
                                                        <td className="memo-cell">{record.memo || '-'}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Dashboard;
