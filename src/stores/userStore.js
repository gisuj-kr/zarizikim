/**
 * 사용자 상태 관리 (Zustand)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as userService from '../services/user';

export const useUserStore = create(
    persist(
        (set, get) => ({
            // 상태
            user: null,
            isInitialized: false,
            loading: false,
            error: null,

            // 액션: 사용자 로드 (기기 ID로 조회)
            loadUser: async () => {
                try {
                    set({ loading: true, error: null });
                    const user = await userService.getCurrentUser();
                    set({
                        user,
                        isInitialized: !!user,
                        loading: false
                    });
                    return user;
                } catch (error) {
                    console.error('사용자 로드 실패:', error);
                    set({ error: error.message, loading: false });
                    return null;
                }
            },

            // 액션: 사용자 등록 (이름 + 이메일)
            registerUser: async (name, email) => {
                try {
                    set({ loading: true, error: null });
                    const user = await userService.registerUser(name, email);
                    set({
                        user,
                        isInitialized: true,
                        loading: false
                    });
                    return user;
                } catch (error) {
                    console.error('사용자 등록 실패:', error);
                    set({ error: error.message, loading: false });
                    throw error;
                }
            },

            // 액션: 이메일로 로그인
            loginUser: async (email) => {
                try {
                    set({ loading: true, error: null });
                    const user = await userService.loginByEmail(email);
                    set({
                        user,
                        isInitialized: true,
                        loading: false
                    });
                    return user;
                } catch (error) {
                    console.error('로그인 실패:', error);
                    set({ error: error.message, loading: false });
                    throw error;
                }
            },

            // 액션: 사용자 이름 변경
            updateName: async (name) => {
                const { user } = get();
                if (!user) return;

                try {
                    set({ loading: true, error: null });
                    const updatedUser = await userService.updateUserName(user.id, name);
                    set({ user: updatedUser, loading: false });
                    return updatedUser;
                } catch (error) {
                    console.error('이름 변경 실패:', error);
                    set({ error: error.message, loading: false });
                    throw error;
                }
            },

            // 액션: 초기화 상태 리셋
            reset: () => {
                set({
                    user: null,
                    isInitialized: false,
                    loading: false,
                    error: null
                });
            },
        }),
        {
            name: 'zarizikim-user',
            partialize: (state) => ({
                user: state.user,
                isInitialized: state.isInitialized,
            }),
        }
    )
);
