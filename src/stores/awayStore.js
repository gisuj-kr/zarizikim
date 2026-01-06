/**
 * 자리비움 상태 관리 (Zustand)
 */
import { create } from 'zustand';
import * as awayService from '../services/away';
import { useUserStore } from './userStore';
import { useAttendanceStore } from './attendanceStore';
import { calculateTotalAwayMinutes } from '../services/away';

export const useAwayStore = create((set, get) => ({
    // 상태
    currentAway: null,      // 현재 진행 중인 자리비움
    todayRecords: [],       // 오늘 자리비움 기록
    totalMinutes: 0,        // 오늘 총 자리비움 시간
    loading: false,
    error: null,

    // 계산된 값
    get isAway() {
        return !!get().currentAway;
    },

    // 액션: 오늘 자리비움 기록 로드
    loadTodayRecords: async () => {
        const user = useUserStore.getState().user;
        if (!user) return;

        try {
            set({ loading: true, error: null });

            // 오늘 기록 조회
            const records = await awayService.getTodayAwayRecords(user.id);

            // 진행 중인 자리비움 확인
            const currentAway = records.find(r => !r.end_time) || null;

            // 총 시간 계산 (완료된 것만)
            const completedRecords = records.filter(r => r.end_time);
            const totalMinutes = calculateTotalAwayMinutes(completedRecords);

            set({
                todayRecords: records,
                currentAway,
                totalMinutes,
                loading: false
            });

            return records;
        } catch (error) {
            console.error('자리비움 기록 로드 실패:', error);
            set({ error: error.message, loading: false });
            return [];
        }
    },

    // 액션: 자리비움 시작
    startAway: async (startTime = new Date(), isAuto = false) => {
        const user = useUserStore.getState().user;
        const attendance = useAttendanceStore.getState().todayAttendance;

        if (!user || !attendance) {
            console.error('사용자 또는 출근 기록이 없습니다.');
            return null;
        }

        // 이미 자리비움 중이면 무시
        if (get().currentAway) {
            console.log('이미 자리비움 중입니다.');
            return get().currentAway;
        }

        try {
            set({ loading: true, error: null });

            const awayRecord = await awayService.startAway(
                user.id,
                attendance.id,
                startTime,
                isAuto
            );

            set(state => ({
                currentAway: awayRecord,
                todayRecords: [...state.todayRecords, awayRecord],
                loading: false,
            }));

            // Electron에 상태 알림
            if (window.electronAPI) {
                window.electronAPI.updateAwayStatus(true);
            }

            return awayRecord;
        } catch (error) {
            console.error('자리비움 시작 실패:', error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    // 액션: 자리비움 종료
    endAway: async (endTime = new Date()) => {
        const { currentAway } = get();

        if (!currentAway) {
            console.log('진행 중인 자리비움이 없습니다.');
            return null;
        }

        try {
            set({ loading: true, error: null });

            const updatedRecord = await awayService.endAway(currentAway.id, endTime);

            set(state => {
                // 기록 업데이트
                const updatedRecords = state.todayRecords.map(r =>
                    r.id === updatedRecord.id ? updatedRecord : r
                );

                // 총 시간 재계산
                const completedRecords = updatedRecords.filter(r => r.end_time);
                const totalMinutes = calculateTotalAwayMinutes(completedRecords);

                return {
                    currentAway: null,
                    todayRecords: updatedRecords,
                    totalMinutes,
                    loading: false,
                };
            });

            // Electron에 상태 알림
            if (window.electronAPI) {
                window.electronAPI.updateAwayStatus(false);
                window.electronAPI.showNotification(
                    '자리비움 종료',
                    `자리비움 시간: ${updatedRecord.duration_minutes}분`
                );
            }

            return updatedRecord;
        } catch (error) {
            console.error('자리비움 종료 실패:', error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    // 액션: 상태 초기화
    reset: () => {
        set({
            currentAway: null,
            todayRecords: [],
            totalMinutes: 0,
            loading: false,
            error: null
        });
    },
}));
