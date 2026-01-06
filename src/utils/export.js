/**
 * CSV/Excel 내보내기 유틸리티
 */
import * as XLSX from 'xlsx';

/**
 * 데이터를 CSV 파일로 내보내기
 * @param {Array<Object>} data - 내보낼 데이터
 * @param {string} filename - 파일명 (확장자 제외)
 */
export function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        console.warn('내보낼 데이터가 없습니다.');
        return;
    }

    // 헤더 추출
    const headers = Object.keys(data[0]);

    // CSV 문자열 생성
    const csvContent = [
        // BOM for UTF-8
        '\uFEFF',
        // 헤더
        headers.join(','),
        // 데이터
        ...data.map(row =>
            headers.map(header => {
                const value = row[header] || '';
                // 쉼표나 따옴표가 있으면 따옴표로 감싸기
                if (String(value).includes(',') || String(value).includes('"')) {
                    return `"${String(value).replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');

    // 다운로드
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * 데이터를 Excel 파일로 내보내기
 * @param {Array<Object>} data - 내보낼 데이터
 * @param {string} filename - 파일명 (확장자 제외)
 */
export function exportToExcel(data, filename) {
    if (!data || data.length === 0) {
        console.warn('내보낼 데이터가 없습니다.');
        return;
    }

    // 워크시트 생성
    const worksheet = XLSX.utils.json_to_sheet(data);

    // 워크북 생성
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '출퇴근기록');

    // 컬럼 너비 자동 조절
    const colWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(
            key.length,
            ...data.map(row => String(row[key] || '').length)
        ) + 2
    }));
    worksheet['!cols'] = colWidths;

    // 파일 저장
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * 파일 다운로드 헬퍼
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}
