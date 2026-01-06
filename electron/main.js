/**
 * Electron 메인 프로세스
 * - 시스템 트레이 아이콘 관리
 * - 자동 출근/자리비움 감지
 * - IPC 통신 처리
 */

const { app, BrowserWindow, ipcMain, powerMonitor, Notification } = require('electron');
const path = require('path');
const { createTray, updateTrayIcon } = require('./tray');

// 개발 모드 확인 (app.isPackaged가 가장 신뢰할 수 있는 방법)
const isDev = !app.isPackaged;

// 전역 상태
let mainWindow = null;
let isCheckedIn = false;
let isAway = false;
let awayStartTime = null;
let idleCheckInterval = null;

// 유휴 시간 임계값 (10분 = 600초)
const IDLE_THRESHOLD = 600;

/**
 * 메인 윈도우 생성
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        show: false, // ready-to-show 이벤트에서 표시
        frame: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, '../resources/icons/icon.png'),
    });

    // 개발 모드에서는 localhost, 프로덕션에서는 빌드된 파일 로드
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // 개발자 도구 열기
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // 윈도우 닫기 시 숨기기 (트레이로)
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // 윈도우 준비되면 표시 (처음 실행 시)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });
}

/**
 * 메인 윈도우 표시
 */
function showWindow() {
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
}

/**
 * 자동 출근 체크 조건 확인
 * - 오전 7시 이후
 * - 아직 출근 안 했으면
 */
function checkAutoCheckIn() {
    const now = new Date();
    const hour = now.getHours();

    if (hour >= 7 && !isCheckedIn) {
        // 렌더러에 자동 출근 요청
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('auto-check-in');
        }
    }
}

// 자리비움 제외 시간 설정 (기본값)
let lunchStartTime = '11:30';
let lunchEndTime = '13:00';
let workEndTime = '18:00';

/**
 * 현재 시간이 자리비움 체크 제외 시간인지 확인
 * - 점심시간 (기본: 11:30 ~ 13:00)
 * - 퇴근 후 (기본: 18:00 이후)
 */
function isExcludedTime() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 점심시간 파싱
    const [lunchStartH, lunchStartM] = lunchStartTime.split(':').map(Number);
    const [lunchEndH, lunchEndM] = lunchEndTime.split(':').map(Number);
    const lunchStart = lunchStartH * 60 + lunchStartM;
    const lunchEnd = lunchEndH * 60 + lunchEndM;

    // 퇴근시간 파싱
    const [workEndH, workEndM] = workEndTime.split(':').map(Number);
    const workEnd = workEndH * 60 + workEndM;

    // 점심시간 체크
    if (currentMinutes >= lunchStart && currentMinutes < lunchEnd) {
        return true;
    }

    // 퇴근 후 체크
    if (currentMinutes >= workEnd) {
        return true;
    }

    return false;
}

/**
 * 자동 자리비움 감지 시작
 */
function startIdleMonitoring() {
    // 1분마다 유휴 시간 체크
    idleCheckInterval = setInterval(() => {
        // 출근 상태일 때만 체크
        if (!isCheckedIn) return;

        // 점심시간 또는 퇴근 후에는 자리비움 체크 안 함
        if (isExcludedTime()) {
            // 이미 자리비움 상태였으면 종료 처리
            if (isAway) {
                const endTime = new Date();
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('auto-away-end', {
                        startTime: awayStartTime.toISOString(),
                        endTime: endTime.toISOString(),
                    });
                }
                isAway = false;
                awayStartTime = null;
                updateTrayIcon('working');
            }
            return;
        }

        const idleTime = powerMonitor.getSystemIdleTime();

        // 10분 이상 유휴 상태이고 아직 자리비움 아니면
        if (idleTime >= IDLE_THRESHOLD && !isAway) {
            isAway = true;
            // 10분 전 시간을 자리비움 시작 시간으로 기록
            awayStartTime = new Date(Date.now() - IDLE_THRESHOLD * 1000);

            // 렌더러에 자동 자리비움 시작 알림
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('auto-away-start', awayStartTime.toISOString());
            }

            // 트레이 아이콘 업데이트
            updateTrayIcon('away');
        }

        // 자리비움 중인데 활동이 감지되면 (유휴 시간이 짧아지면)
        if (isAway && idleTime < 60) {
            const endTime = new Date();

            // 렌더러에 자리비움 종료 알림
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('auto-away-end', {
                    startTime: awayStartTime.toISOString(),
                    endTime: endTime.toISOString(),
                });
            }

            isAway = false;
            awayStartTime = null;

            // 트레이 아이콘 업데이트
            updateTrayIcon('working');
        }
    }, 60000); // 1분마다
}

/**
 * 알림 표시
 */
function showNotification(title, body) {
    if (Notification.isSupported()) {
        new Notification({ title, body }).show();
    }
}

// 단일 인스턴스 잠금 (앱 중복 실행 방지)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // 이미 실행 중인 인스턴스가 있으면 즉시 종료
    app.quit();
} else {
    // 두 번째 인스턴스 시도 시, 기존 창을 포커스
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // 앱 준비 완료
    app.whenReady().then(() => {
        createWindow();
        createTray(mainWindow, app);

        // OS 시작 시 자동 출근 체크
        checkAutoCheckIn();

        // 유휴 상태 모니터링 시작
        startIdleMonitoring();

        // 잠자기 모드에서 깨어날 때
        powerMonitor.on('resume', () => {
            // 자동 출근 체크
            checkAutoCheckIn();

            // 자리비움 중이면 종료
            if (isAway) {
                const endTime = new Date();
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('auto-away-end', {
                        startTime: awayStartTime.toISOString(),
                        endTime: endTime.toISOString(),
                    });
                }
                isAway = false;
                awayStartTime = null;
                updateTrayIcon('working');
            }
        });

        // PC 종료/잠자기 시 자동 퇴근
        powerMonitor.on('suspend', () => {
            if (isCheckedIn) {
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('auto-check-out');
                }
            }
        });

        powerMonitor.on('shutdown', () => {
            if (isCheckedIn) {
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('auto-check-out');
                }
            }
        });

        // Windows 시작 시 자동 실행 설정
        if (!isDev) {
            app.setLoginItemSettings({
                openAtLogin: true,
                path: app.getPath('exe'),
            });
        }
    });
} // gotTheLock if문 닫기

// 모든 윈도우 닫혀도 앱 유지 (트레이 상주)
app.on('window-all-closed', () => {
    // macOS가 아니면 앱 종료하지 않음
});

// macOS에서 dock 아이콘 클릭 시
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    } else {
        showWindow();
    }
});

// 앱 종료 전
app.on('before-quit', () => {
    app.isQuitting = true;
    if (idleCheckInterval) {
        clearInterval(idleCheckInterval);
    }
});

// ===== IPC 핸들러 =====

// 출근 상태 업데이트
ipcMain.on('check-in-status', (event, status) => {
    isCheckedIn = status;
    updateTrayIcon(status ? 'working' : 'idle');
});

// 자리비움 상태 업데이트
ipcMain.on('away-status', (event, status) => {
    isAway = status;
    if (status) {
        awayStartTime = new Date();
        updateTrayIcon('away');
    } else {
        awayStartTime = null;
        updateTrayIcon('working');
    }
});

// 윈도우 표시 요청
ipcMain.on('show-window', () => {
    showWindow();
});

// 알림 표시 요청
ipcMain.on('show-notification', (event, { title, body }) => {
    showNotification(title, body);
});

// 앱 종료 요청
ipcMain.on('quit-app', () => {
    app.isQuitting = true;
    app.quit();
});

// 자리비움 제외 시간 설정 업데이트
ipcMain.on('update-away-exclude-times', (event, settings) => {
    if (settings.lunchStartTime) lunchStartTime = settings.lunchStartTime;
    if (settings.lunchEndTime) lunchEndTime = settings.lunchEndTime;
    if (settings.workEndTime) workEndTime = settings.workEndTime;
});

module.exports = { showWindow };

