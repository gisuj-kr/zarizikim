/**
 * Electron Preload 스크립트
 * - contextBridge를 통한 안전한 IPC 통신
 * - 렌더러 프로세스에 노출할 API 정의
 */

const { contextBridge, ipcRenderer } = require('electron');

// 렌더러 프로세스에 노출할 API
contextBridge.exposeInMainWorld('electronAPI', {
    // ===== 이벤트 수신 (메인 → 렌더러) =====

    /**
     * 자동 출근 이벤트 수신
     */
    onAutoCheckIn: (callback) => {
        ipcRenderer.on('auto-check-in', () => callback());
    },

    /**
     * 자동 퇴근 이벤트 수신
     */
    onAutoCheckOut: (callback) => {
        ipcRenderer.on('auto-check-out', () => callback());
    },

    /**
     * 자동 자리비움 시작 이벤트 수신
     */
    onAutoAwayStart: (callback) => {
        ipcRenderer.on('auto-away-start', (event, startTime) => callback(startTime));
    },

    /**
     * 자동 자리비움 종료 이벤트 수신
     */
    onAutoAwayEnd: (callback) => {
        ipcRenderer.on('auto-away-end', (event, data) => callback(data));
    },

    // ===== 이벤트 송신 (렌더러 → 메인) =====

    /**
     * 출근 상태 업데이트
     */
    updateCheckInStatus: (status) => {
        ipcRenderer.send('check-in-status', status);
    },

    /**
     * 자리비움 상태 업데이트
     */
    updateAwayStatus: (status) => {
        ipcRenderer.send('away-status', status);
    },

    /**
     * 윈도우 표시 요청
     */
    showWindow: () => {
        ipcRenderer.send('show-window');
    },

    /**
     * 알림 표시 요청
     */
    showNotification: (title, body) => {
        ipcRenderer.send('show-notification', { title, body });
    },

    /**
     * 앱 종료 요청
     */
    quitApp: () => {
        ipcRenderer.send('quit-app');
    },

    /**
     * 자리비움 제외 시간 설정 업데이트
     */
    updateAwayExcludeTimes: (settings) => {
        ipcRenderer.send('update-away-exclude-times', settings);
    },

    // ===== 리스너 제거 =====

    /**
     * 모든 리스너 제거
     */
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('auto-check-in');
        ipcRenderer.removeAllListeners('auto-check-out');
        ipcRenderer.removeAllListeners('auto-away-start');
        ipcRenderer.removeAllListeners('auto-away-end');
    },
});

// 플랫폼 정보 노출
contextBridge.exposeInMainWorld('platform', {
    isWindows: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
});
