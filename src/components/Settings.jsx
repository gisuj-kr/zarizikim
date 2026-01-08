/**
 * Settings 컴포넌트 - 설정 화면
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import './Settings.css';

function Settings() {
    const { user, updateName, loading } = useUserStore();
    const [name, setName] = useState('');
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    // 설정 상태
    const [settings, setSettings] = useState({
        autoCheckIn: true,
        autoCheckOut: true,
        lunchNotification: true,
        lunchTime: '12:00',
        leaveNotification: true,
        leaveTime: '18:00',
        overtimeNotification: true,
        overtimeThreshold: 21, // 시간
        idleThreshold: 10, // 분
        // 자리비움 제외 시간 설정
        lunchStartTime: '11:30',
        lunchEndTime: '13:00',
        workEndTime: '18:00',
    });

    // 앱 버전 상태
    const [appVersion, setAppVersion] = useState('1.0.0');

    // 초기 데이터 로드
    useEffect(() => {
        if (user) {
            setName(user.name);
        }

        // Electron에서 앱 버전 가져오기
        if (window.electronAPI && window.electronAPI.getAppVersion) {
            window.electronAPI.getAppVersion().then((version) => {
                setAppVersion(version);
            });
        }

        // 로컬 스토리지에서 설정 로드
        const savedSettings = localStorage.getItem('zarizikim_settings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            setSettings(parsed);

            // Electron에 자리비움 제외 시간 설정 전달
            if (window.electronAPI) {
                window.electronAPI.updateAwayExcludeTimes({
                    lunchStartTime: parsed.lunchStartTime || '11:30',
                    lunchEndTime: parsed.lunchEndTime || '13:00',
                    workEndTime: parsed.workEndTime || '18:00',
                });
            }
        }
    }, [user]);

    // 이름 저장
    const handleSaveName = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            setError('이름을 입력해주세요.');
            return;
        }

        if (trimmedName === user?.name) {
            return;
        }

        try {
            await updateName(trimmedName);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError('이름 변경에 실패했습니다.');
        }
    };

    // 설정 변경
    const handleSettingChange = (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        localStorage.setItem('zarizikim_settings', JSON.stringify(newSettings));

        // 자리비움 제외 시간 관련 설정이면 Electron에 전달
        if (['lunchStartTime', 'lunchEndTime', 'workEndTime'].includes(key)) {
            if (window.electronAPI) {
                window.electronAPI.updateAwayExcludeTimes({
                    lunchStartTime: newSettings.lunchStartTime,
                    lunchEndTime: newSettings.lunchEndTime,
                    workEndTime: newSettings.workEndTime,
                });
            }
        }
    };

    return (
        <div className="settings">
            {/* 네비게이션 */}
            <nav className="nav">
                <Link to="/" className="nav-link">홈</Link>
                <Link to="/dashboard" className="nav-link">대시보드</Link>
                <Link to="/settings" className="nav-link active">설정</Link>
            </nav>

            <div className="settings-content">
                <h1>설정</h1>

                {/* 사용자 정보 */}
                <div className="card settings-section">
                    <h2 className="settings-section-title">사용자 정보</h2>

                    <div className="form-group">
                        <label className="form-label">이름</label>
                        <div className="input-group">
                            <input
                                type="text"
                                className="input"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    setError('');
                                }}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveName}
                                disabled={loading || name.trim() === user?.name}
                            >
                                {loading ? '저장 중...' : '저장'}
                            </button>
                        </div>
                        {error && <p className="form-error">{error}</p>}
                        {saved && <p className="form-success">저장되었습니다.</p>}
                    </div>

                    <div className="form-group">
                        <label className="form-label">디바이스</label>
                        <p className="form-value">{user?.device_name || 'Unknown'}</p>
                    </div>
                </div>

                {/* 자동화 설정 */}
                <div className="card settings-section">
                    <h2 className="settings-section-title">자동화</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">자동 출근 체크</span>
                            <span className="setting-desc">
                                PC 시작 또는 잠자기 해제 시 7시 이후면 자동 출근
                            </span>
                        </div>
                        <label className="toggle">
                            <input
                                type="checkbox"
                                checked={settings.autoCheckIn}
                                onChange={(e) => handleSettingChange('autoCheckIn', e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">자동 퇴근 체크</span>
                            <span className="setting-desc">
                                PC 종료 또는 잠자기 모드 진입 시 자동 퇴근
                            </span>
                        </div>
                        <label className="toggle">
                            <input
                                type="checkbox"
                                checked={settings.autoCheckOut}
                                onChange={(e) => handleSettingChange('autoCheckOut', e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">자리비움 감지 시간</span>
                            <span className="setting-desc">
                                PC 미사용 시 자동으로 자리비움으로 기록됩니다
                            </span>
                        </div>
                        <span className="setting-fixed-value">10분</span>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">점심시간 (자리비움 제외)</span>
                            <span className="setting-desc">
                                이 시간대에는 자리비움을 체크하지 않습니다
                            </span>
                        </div>
                        <div className="setting-controls">
                            <input
                                type="time"
                                className="input time-input"
                                value={settings.lunchStartTime}
                                onChange={(e) => handleSettingChange('lunchStartTime', e.target.value)}
                            />
                            <span style={{ color: 'var(--text-muted)' }}>~</span>
                            <input
                                type="time"
                                className="input time-input"
                                value={settings.lunchEndTime}
                                onChange={(e) => handleSettingChange('lunchEndTime', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">업무 종료 시간</span>
                            <span className="setting-desc">
                                이 시간 이후에는 자리비움을 체크하지 않습니다
                            </span>
                        </div>
                        <input
                            type="time"
                            className="input time-input"
                            value={settings.workEndTime}
                            onChange={(e) => handleSettingChange('workEndTime', e.target.value)}
                        />
                    </div>
                </div>

                {/* 알림 설정 */}
                <div className="card settings-section">
                    <h2 className="settings-section-title">알림</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">점심시간 알림</span>
                            <span className="setting-desc">설정한 시간에 점심시간 알림</span>
                        </div>
                        <div className="setting-controls">
                            <input
                                type="time"
                                className="input time-input"
                                value={settings.lunchTime}
                                onChange={(e) => handleSettingChange('lunchTime', e.target.value)}
                                disabled={!settings.lunchNotification}
                            />
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={settings.lunchNotification}
                                    onChange={(e) => handleSettingChange('lunchNotification', e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">퇴근시간 알림</span>
                            <span className="setting-desc">설정한 시간에 퇴근시간 알림</span>
                        </div>
                        <div className="setting-controls">
                            <input
                                type="time"
                                className="input time-input"
                                value={settings.leaveTime}
                                onChange={(e) => handleSettingChange('leaveTime', e.target.value)}
                                disabled={!settings.leaveNotification}
                            />
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={settings.leaveNotification}
                                    onChange={(e) => handleSettingChange('leaveNotification', e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">야근 경고 알림</span>
                            <span className="setting-desc">설정한 시간 이후 야근 경고</span>
                        </div>
                        <div className="setting-controls">
                            <select
                                className="input select-input"
                                value={settings.overtimeThreshold}
                                onChange={(e) => handleSettingChange('overtimeThreshold', Number(e.target.value))}
                                disabled={!settings.overtimeNotification}
                            >
                                <option value={20}>20시</option>
                                <option value={21}>21시</option>
                                <option value={22}>22시</option>
                                <option value={23}>23시</option>
                            </select>
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={settings.overtimeNotification}
                                    onChange={(e) => handleSettingChange('overtimeNotification', e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* 앱 정보 */}
                <div className="card settings-section">
                    <h2 className="settings-section-title">앱 정보</h2>
                    <p className="app-info">근퇴기록 v{appVersion}</p>
                    <p className="app-desc">출퇴근 및 자리비움 관리 애플리케이션</p>
                </div>
            </div>
        </div>
    );
}

export default Settings;
