/**
 * 사용자 API 서비스
 */
import { supabase } from './supabase';
import { getDeviceId, getDeviceName } from '../utils/device';

/**
 * 사용자 등록 (이름 + 이메일)
 * @param {string} name - 사용자 이름
 * @param {string} email - 사용자 이메일
 * @returns {Promise<Object>} 사용자 정보
 */
export async function registerUser(name, email) {
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();

    // 이메일 중복 확인
    const { data: existingByEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (existingByEmail) {
        throw new Error('이미 등록된 이메일입니다. 로그인을 이용해주세요.');
    }

    // 기존 기기 사용자 확인 (기기 변경 시)
    const { data: existingByDevice } = await supabase
        .from('users')
        .select('*')
        .eq('device_id', deviceId)
        .single();

    if (existingByDevice) {
        // 기존 기기 사용자의 정보 업데이트
        const { data, error } = await supabase
            .from('users')
            .update({ name, email, device_name: deviceName })
            .eq('id', existingByDevice.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // 새 사용자 등록
    const { data, error } = await supabase
        .from('users')
        .insert({
            device_id: deviceId,
            name,
            email,
            device_name: deviceName,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 현재 기기의 사용자 조회
 * @returns {Promise<Object|null>} 사용자 정보
 */
export async function getCurrentUser() {
    const deviceId = getDeviceId();

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('device_id', deviceId)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data || null;
}

/**
 * 이메일로 로그인 (기존 사용자의 기기 정보 업데이트)
 * @param {string} email - 사용자 이메일
 * @returns {Promise<Object>} 사용자 정보
 */
export async function loginByEmail(email) {
    // 이메일로 사용자 조회
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !user) {
        throw new Error('등록되지 않은 이메일입니다.');
    }

    // 현재 기기 정보로 업데이트
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();

    const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ device_id: deviceId, device_name: deviceName })
        .eq('id', user.id)
        .select()
        .single();

    if (updateError) throw updateError;
    return updatedUser;
}

/**
 * 사용자 이름 업데이트
 * @param {string} userId - 사용자 ID
 * @param {string} name - 새 이름
 * @returns {Promise<Object>} 업데이트된 사용자 정보
 */
export async function updateUserName(userId, name) {
    const { data, error } = await supabase
        .from('users')
        .update({ name })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 전체 사용자 목록 조회
 * @returns {Promise<Array>} 사용자 목록
 */
export async function getAllUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
}
