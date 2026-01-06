/**
 * 출퇴근 상태 관리 (Zustand)
 */
import { create } from 'zustand';
import * as attendanceService from '../services/attendance';
import { useUserStore } from './userStore';
import { calculateMinutesBetween } from '../utils/time';

export const useAttendanceStore = create((set, get) => ({
    // 상태
    todayAttendance: null,
    history: [],
    loading: false,
    error: null,

    // 계산된 값
    get isCheckedIn() {
        const { todayAttendance } = get();
        return todayAttendance?.check_in && !todayAttendance?.check_out;
    },

    get workDuration() {
        const { todayAttendance } = get();
        if (!todayAttendance?.check_in) return 0;

        const endTime = todayAttendance.check_out || new Date();
        return calculateMinutesBetween(todayAttendance.check_in, endTime);
    },

    // 액션: 오늘 출퇴근 기록 로드
    loadTodayAttendance: async () => {
        const user = useUserStore.getState().user;
        if (!user) return;

        try {
            set({ loading: true, error: null });
            const attendance = await attendanceService.getTodayAttendance(user.id);
            set({ todayAttendance: attendance, loading: false });

            // Electron에 상태 알림
            if (window.electronAPI && attendance?.check_in && !attendance?.check_out) {
                window.electronAPI.updateCheckInStatus(true);
            }

            return attendance;
        } catch (error) {
            console.error('출퇴근 기록 로드 실패:', error);
            set({ error: error.message, loading: false });
            return null;
        }
    },

    // 액션: 출근
    checkIn: async (isAuto = false, memo = '') => {
        const user = useUserStore.getState().user;
        if (!user) return;

        try {
            set({ loading: true, error: null });
            const attendance = await attendanceService.checkIn(user.id, isAuto, memo);
            set({ todayAttendance: attendance, loading: false });

            // Electron에 상태 알림
            if (window.electronAPI) {
                window.electronAPI.updateCheckInStatus(true);
                if (isAuto) {
                    window.electronAPI.showNotification(
                        '자동 출근 완료',
                        `${new Date().toLocaleTimeString('ko-KR')}에 자동으로 출근 처리되었습니다.`
                    );
                }
            }

            return attendance;
        } catch (error) {
            console.error('출근 실패:', error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    // 액션: 퇴근
    checkOut: async (isAuto = false) => {
        const user = useUserStore.getState().user;
        if (!user) return;

        try {
            set({ loading: true, error: null });
            const attendance = await attendanceService.checkOut(user.id, isAuto);
            set({ todayAttendance: attendance, loading: false });

            // Electron에 상태 알림
            if (window.electronAPI) {
                window.electronAPI.updateCheckInStatus(false);
                if (isAuto) {
                    window.electronAPI.showNotification(
                        '자동 퇴근 완료',
                        `${new Date().toLocaleTimeString('ko-KR')}에 자동으로 퇴근 처리되었습니다.`
                    );
                }
            }

            return attendance;
        } catch (error) {
            console.error('퇴근 실패:', error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    // 액션: 메모 업데이트
    updateMemo: async (memo) => {
        const { todayAttendance } = get();
        if (!todayAttendance) return;

        try {
            set({ loading: true, error: null });
            const attendance = await attendanceService.updateMemo(todayAttendance.id, memo);
            set({ todayAttendance: attendance, loading: false });
            return attendance;
        } catch (error) {
            console.error('메모 업데이트 실패:', error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    // 액션: 히스토리 로드
    loadHistory: async (days = 30) => {
        const user = useUserStore.getState().user;
        if (!user) return;

        try {
            set({ loading: true, error: null });
            const history = await attendanceService.getAttendanceHistory(user.id, days);
            set({ history, loading: false });
            return history;
        } catch (error) {
            console.error('히스토리 로드 실패:', error);
            set({ error: error.message, loading: false });
            return [];
        }
    },

    // 액션: 상태 초기화
    reset: () => {
        set({
            todayAttendance: null,
            history: [],
            loading: false,
            error: null
        });
    },
}));
