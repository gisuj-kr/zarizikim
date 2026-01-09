/**
 * 시간 유틸리티
 */

/**
 * 시간을 HH:MM 형식으로 포맷
 * @param {Date|string} date - 날짜
 * @returns {string} 포맷된 시간
 */
export function formatTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 * @param {Date|string} date - 날짜
 * @returns {string} 포맷된 날짜
 */
export function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

/**
 * 날짜와 시간을 YYYY-MM-DD HH:MM 형식으로 포맷
 * @param {Date|string} date - 날짜
 * @returns {string} 포맷된 날짜/시간
 */
export function formatDateTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    return `${formatDate(d)} ${formatTime(d)}`;
}

/**
 * 분을 시간:분 형식으로 변환
 * @param {number} minutes - 분
 * @returns {string} 포맷된 시간
 */
export function formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0분';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
        return `${mins}분`;
    } else if (mins === 0) {
        return `${hours}시간`;
    } else {
        return `${hours}시간 ${mins}분`;
    }
}

/**
 * 두 시간 사이의 분 계산
 * @param {Date|string} start - 시작 시간
 * @param {Date|string} end - 종료 시간
 * @returns {number} 분
 */
export function calculateMinutesBetween(start, end) {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.round((endDate - startDate) / 60000);
}

/**
 * 오늘 날짜인지 확인
 * @param {Date|string} date - 날짜
 * @returns {boolean}
 */
export function isToday(date) {
    const d = new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
}

/**
 * 현재 시간이 특정 시간대인지 확인
 * @param {number} hour - 시간 (0-23)
 * @returns {boolean}
 */
export function isCurrentHour(hour) {
    return new Date().getHours() === hour;
}

/**
 * 한국 시간대로 현재 시간 조회
 * @returns {Date}
 */
export function getKoreanTime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

/**
 * 로컬 시간 기준으로 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 * (toISOString()은 UTC 기준이라 한국 시간 오전 9시 이전에는 어제 날짜로 인식됨)
 * @returns {string} YYYY-MM-DD 형식의 오늘 날짜
 */
export function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
