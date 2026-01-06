/**
 * 디바이스 유틸리티
 * - 고유 디바이스 ID 생성 및 관리
 * - 디바이스 이름 조회
 */
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'zarizikim_device_id';

/**
 * 고유 디바이스 ID 조회 (없으면 생성)
 * @returns {string} 디바이스 ID
 */
export function getDeviceId() {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
        deviceId = uuidv4();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
}

/**
 * 디바이스 이름 조회
 * @returns {string} 디바이스 이름
 */
export function getDeviceName() {
    // 브라우저 환경에서는 userAgent에서 추출
    const ua = navigator.userAgent;

    if (ua.includes('Windows')) {
        return 'Windows PC';
    } else if (ua.includes('Macintosh')) {
        return 'Mac';
    } else if (ua.includes('Linux')) {
        return 'Linux PC';
    }

    return 'Unknown Device';
}
