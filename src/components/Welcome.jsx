/**
 * Welcome 컴포넌트 - 최초 실행 시 로그인/등록 선택
 */
import React, { useState } from 'react';
import { useUserStore } from '../stores/userStore';
import './Welcome.css';

// 화면 모드
const MODE = {
    SELECT: 'select',    // 선택 화면
    LOGIN: 'login',      // 로그인 화면
    REGISTER: 'register' // 등록 화면
};

function Welcome() {
    const [mode, setMode] = useState(MODE.SELECT);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const { registerUser, loginUser, loading } = useUserStore();

    // 이메일 형식 검증
    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // 등록 처리
    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedName) {
            setError('이름을 입력해주세요.');
            return;
        }

        if (trimmedName.length < 2) {
            setError('이름은 2자 이상이어야 합니다.');
            return;
        }

        if (!trimmedEmail) {
            setError('이메일을 입력해주세요.');
            return;
        }

        if (!isValidEmail(trimmedEmail)) {
            setError('올바른 이메일 형식이 아닙니다.');
            return;
        }

        try {
            await registerUser(trimmedName, trimmedEmail);
        } catch (err) {
            setError(err.message || '등록에 실패했습니다. 다시 시도해주세요.');
        }
    };

    // 로그인 처리
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail) {
            setError('이메일을 입력해주세요.');
            return;
        }

        if (!isValidEmail(trimmedEmail)) {
            setError('올바른 이메일 형식이 아닙니다.');
            return;
        }

        try {
            await loginUser(trimmedEmail);
        } catch (err) {
            setError(err.message || '로그인에 실패했습니다. 다시 시도해주세요.');
        }
    };

    // 모드 변경 시 상태 초기화
    const changeMode = (newMode) => {
        setMode(newMode);
        setName('');
        setEmail('');
        setError('');
    };

    // 선택 화면
    if (mode === MODE.SELECT) {
        return (
            <div className="welcome">
                <div className="welcome-container">
                    <div className="welcome-header">
                        <div className="welcome-icon">👋</div>
                        <h1 className="welcome-title">근퇴기록</h1>
                        <p className="welcome-subtitle">출퇴근 및 자리비움 관리</p>
                    </div>

                    <div className="welcome-actions">
                        <button
                            className="btn btn-primary btn-lg welcome-btn"
                            onClick={() => changeMode(MODE.LOGIN)}
                        >
                            🔐 기존 사용자 로그인
                        </button>

                        <button
                            className="btn btn-secondary btn-lg welcome-btn"
                            onClick={() => changeMode(MODE.REGISTER)}
                        >
                            ✨ 새 사용자 등록
                        </button>
                    </div>

                    <p className="welcome-note">
                        처음 사용하시면 '새 사용자 등록'을,<br />
                        재설치하신 경우 '기존 사용자 로그인'을 선택해주세요.
                    </p>
                </div>
            </div>
        );
    }

    // 로그인 화면
    if (mode === MODE.LOGIN) {
        return (
            <div className="welcome">
                <div className="welcome-container">
                    <div className="welcome-header">
                        <div className="welcome-icon">🔐</div>
                        <h1 className="welcome-title">로그인</h1>
                        <p className="welcome-subtitle">등록된 이메일로 로그인하세요</p>
                    </div>

                    <form className="welcome-form" onSubmit={handleLogin}>
                        <div className="form-group">
                            <label htmlFor="email" className="form-label">
                                이메일
                            </label>
                            <input
                                id="email"
                                type="email"
                                className="input"
                                placeholder="example@company.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setError('');
                                }}
                                autoFocus
                                disabled={loading}
                            />
                            {error && <p className="form-error">{error}</p>}
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg welcome-btn"
                            disabled={loading || !email.trim()}
                        >
                            {loading ? '로그인 중...' : '로그인'}
                        </button>

                        <button
                            type="button"
                            className="btn btn-text welcome-btn-back"
                            onClick={() => changeMode(MODE.SELECT)}
                            disabled={loading}
                        >
                            ← 돌아가기
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 등록 화면
    return (
        <div className="welcome">
            <div className="welcome-container">
                <div className="welcome-header">
                    <div className="welcome-icon">✨</div>
                    <h1 className="welcome-title">새 사용자 등록</h1>
                    <p className="welcome-subtitle">이름과 이메일을 입력해주세요</p>
                </div>

                <form className="welcome-form" onSubmit={handleRegister}>
                    <div className="form-group">
                        <label htmlFor="name" className="form-label">
                            이름
                        </label>
                        <input
                            id="name"
                            type="text"
                            className="input"
                            placeholder="예: 홍길동"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setError('');
                            }}
                            autoFocus
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email" className="form-label">
                            이메일
                        </label>
                        <input
                            id="email"
                            type="email"
                            className="input"
                            placeholder="example@company.com"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setError('');
                            }}
                            disabled={loading}
                        />
                        {error && <p className="form-error">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg welcome-btn"
                        disabled={loading || !name.trim() || !email.trim()}
                    >
                        {loading ? '등록 중...' : '등록하기'}
                    </button>

                    <button
                        type="button"
                        className="btn btn-text welcome-btn-back"
                        onClick={() => changeMode(MODE.SELECT)}
                        disabled={loading}
                    >
                        ← 돌아가기
                    </button>
                </form>

                <p className="welcome-note">
                    이메일은 재설치 시 로그인에 사용됩니다.
                </p>
            </div>
        </div>
    );
}

export default Welcome;
