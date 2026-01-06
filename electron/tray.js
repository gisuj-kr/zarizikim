/**
 * 시스템 트레이 관리
 * - 트레이 아이콘 생성 및 관리
 * - 우클릭 컨텍스트 메뉴
 */

const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;
let mainWindow = null;
let appRef = null;

// 상태별 아이콘 경로
const iconPaths = {
    idle: 'icon-idle.png',      // 미출근 (회색)
    working: 'icon-working.png', // 근무중 (녹색)
    away: 'icon-away.png',       // 자리비움 (노란색)
};

/**
 * 트레이 아이콘 생성
 */
function createTray(window, app) {
    mainWindow = window;
    appRef = app;

    // 기본 아이콘 (미출근 상태)
    const iconPath = path.join(__dirname, '../resources/icons', iconPaths.idle);

    // 아이콘이 없으면 기본 아이콘 사용
    let icon;
    try {
        icon = nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) {
            // 16x16 기본 아이콘 생성 (회색)
            icon = createDefaultIcon('#808080');
        }
    } catch (e) {
        icon = createDefaultIcon('#808080');
    }

    tray = new Tray(icon);
    tray.setToolTip('근퇴기록 - 출퇴근 체크');

    // 컨텍스트 메뉴 생성
    updateContextMenu();

    // 더블클릭으로 창 열기
    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

/**
 * 기본 아이콘 생성 (macOS와 Windows 호환)
 */
function createDefaultIcon(color) {
    // macOS는 22x22, Windows는 16x16 권장
    const isMac = process.platform === 'darwin';
    const size = isMac ? 22 : 16;
    const canvas = Buffer.alloc(size * size * 4);

    // 색상 파싱
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // 원형 아이콘 생성
    const center = size / 2;
    const radius = size / 2 - 2;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);

            if (dist <= radius) {
                canvas[idx] = r;     // R
                canvas[idx + 1] = g; // G
                canvas[idx + 2] = b; // B
                canvas[idx + 3] = 255; // A
            } else {
                canvas[idx] = 0;
                canvas[idx + 1] = 0;
                canvas[idx + 2] = 0;
                canvas[idx + 3] = 0;
            }
        }
    }

    const image = nativeImage.createFromBuffer(canvas, { width: size, height: size });

    // macOS에서는 @2x 해상도 지원을 위해 리사이즈
    if (isMac) {
        return image.resize({ width: 18, height: 18 });
    }
    return image;
}

/**
 * 컨텍스트 메뉴 업데이트
 */
function updateContextMenu() {
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '열기',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
        },
        { type: 'separator' },
        {
            label: '종료',
            click: () => {
                if (appRef) {
                    // isQuitting을 여기서 설정하지 않음 - before-quit에서 처리
                    appRef.quit();
                }
            },
        },
    ]);

    tray.setContextMenu(contextMenu);
}

/**
 * 트레이 아이콘 상태 업데이트
 */
function updateTrayIcon(status) {
    if (!tray) return;

    const colors = {
        idle: '#808080',    // 회색 - 미출근
        working: '#4CAF50', // 녹색 - 근무중
        away: '#FFC107',    // 노란색 - 자리비움
    };

    const tooltips = {
        idle: '근퇴기록 - 미출근',
        working: '근퇴기록 - 근무중',
        away: '근퇴기록 - 자리비움',
    };

    // 아이콘 파일이 있으면 사용, 없으면 기본 아이콘 생성
    const iconPath = path.join(__dirname, '../resources/icons', iconPaths[status] || iconPaths.idle);

    let icon;
    try {
        icon = nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) {
            icon = createDefaultIcon(colors[status] || colors.idle);
        }
    } catch (e) {
        icon = createDefaultIcon(colors[status] || colors.idle);
    }

    tray.setImage(icon);
    tray.setToolTip(tooltips[status] || tooltips.idle);
}

module.exports = { createTray, updateTrayIcon };
