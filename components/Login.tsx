import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { supabase } from '../src/lib/supabase';

interface LoginProps {
  onLogin: (user: any) => void;
  onPasswordSet?: () => void;
  t: (key: string) => string;
  forcePasswordUpdate?: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, onPasswordSet, t, forcePasswordUpdate }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot' | 'update-password'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    requestAnimationFrame(() => setReady(true));
    if (forcePasswordUpdate ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('type=invite') ||
      window.location.hash.includes('type=signup') ||
      (!window.location.hash.includes('error=access_denied&error_code=403') && window.location.hash.includes('access_token='))) {
      if (forcePasswordUpdate || window.location.hash.includes('type=')) {
        setAuthMode('update-password');
      }
    }
  }, [forcePasswordUpdate]);

  useEffect(() => {
    if (phase === 'error') {
      const timer = setTimeout(() => setPhase('idle'), 3500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const fail = (msg: string) => { setError(msg); setPhase('error'); setLoading(false); };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setPhase('loading'); setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (username) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('profiles').update({ username }).eq('id', user.id);
      }
      await supabase.auth.signOut();
      alert('Contraseña guardada exitosamente. Por favor, inicia sesión con tu nueva contraseña.');
      if (onPasswordSet) onPasswordSet();
      setAuthMode('signin'); setPassword(''); setUsername(''); setEmail(''); setPhase('idle');
    } catch (err: any) { fail(err.message); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'update-password') return handleUpdatePassword(e);
    setLoading(true); setPhase('loading'); setError(null); setSuccess(null);
    try {
      if (authMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.includes('@') ? email : `${username}@healthaxis.com`, password
        });
        if (error) throw error;
        if (data.user) { setPhase('success'); setTimeout(() => onLogin(data.user), 1600); }
      } else if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: email.split('@')[0] } } });
        if (error) throw error;
        alert('Verification email sent!');
        setAuthMode('signin'); setPhase('idle');
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setSuccess('Recovery link sent to your email.');
        setPhase('idle');
        setTimeout(() => { setAuthMode('signin'); setSuccess(null); }, 4000);
      }
    } catch (err: any) { fail(err.message); }
    finally { if (phase !== 'success') setLoading(false); }
  };

  const modeConfig: Record<string, { title: string; subtitle: string }> = {
    'signin': { title: 'Welcome back', subtitle: 'Sign in to continue to your workspace' },
    'forgot': { title: 'Reset password', subtitle: 'Enter your email and we\'ll send a recovery link' },
    'update-password': { title: 'Set new password', subtitle: 'Choose a strong password for your account' },
    'signup': { title: 'Create account', subtitle: 'Get started with Norvexis Core' },
  };

  const { title, subtitle } = modeConfig[authMode];

  return (
    <div className="nv-login-root">
      {/* Background */}
      <div className="nv-bg" />
      <div className="nv-bg-glow" />

      {/* Success overlay */}
      {phase === 'success' && (
        <div className="nv-success-overlay">
          <div className="nv-success-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" className="nv-check-path" />
            </svg>
          </div>
          <p className="nv-success-text">Signing you in…</p>
        </div>
      )}

      {/* Main content */}
      <div className={`nv-container ${ready ? 'nv-in' : ''}`}>

        {/* Logo */}
        <div className="nv-logo-wrap">
          <img src="/logo.png" alt="Norvexis Core" className="nv-logo" />
        </div>

        {/* Brand */}
        <h1 className="nv-brand">
          Norvexis <span>Core</span>
        </h1>

        {/* Card */}
        <div className={`nv-card ${phase === 'error' ? 'nv-shake' : ''}`}>
          <div className="nv-card-inner">
            {/* Header */}
            <div className="nv-header">
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </div>

            {/* Error */}
            {error && (
              <div className="nv-alert nv-alert-error">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Success message */}
            {success && phase !== 'success' && (
              <div className="nv-alert nv-alert-ok">
                <i className="fa-solid fa-circle-check"></i>
                <span>{success}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>

              {authMode !== 'update-password' && (
                <div className="nv-field">
                  <label>{t('lbl_email')}</label>
                  <div className="nv-input-wrap">
                    <i className="fa-solid fa-envelope nv-icon"></i>
                    <input type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com" autoComplete="email" />
                  </div>
                </div>
              )}

              {authMode !== 'forgot' && (
                <div className="nv-field">
                  <label>{authMode === 'update-password' ? t('lbl_new_password') : t('lbl_password')}</label>
                  <div className="nv-input-wrap">
                    <i className="fa-solid fa-lock nv-icon"></i>
                    <input type={showPassword ? 'text' : 'password'} required value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete={authMode === 'update-password' ? 'new-password' : 'current-password'} />
                    <button type="button" className="nv-eye" onClick={() => setShowPassword(!showPassword)}>
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
              )}

              {authMode === 'signin' && (
                <div className="nv-forgot-row">
                  <button type="button" className="nv-link"
                    onClick={() => { setAuthMode('forgot'); setError(null); setSuccess(null); setPhase('idle'); }}>
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} className={`nv-submit ${phase === 'loading' ? 'is-loading' : ''}`}>
                {phase === 'loading' ? (
                  <div className="nv-spinner" />
                ) : (
                  <>
                    {authMode === 'signin' ? t('btn_login') : authMode === 'forgot' ? 'Send link' : authMode === 'signup' ? 'Create account' : t('btn_save_password')}
                    <i className={`fa-solid ${authMode === 'forgot' ? 'fa-paper-plane' : 'fa-arrow-right'} nv-arrow`}></i>
                  </>
                )}
              </button>

              {/* Back */}
              {(authMode === 'forgot' || authMode === 'update-password') && (
                <button type="button" className="nv-back"
                  onClick={() => { setAuthMode('signin'); setError(null); setSuccess(null); setPhase('idle'); }}>
                  <i className="fa-solid fa-arrow-left"></i> Back to sign in
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="nv-footer">&copy; {new Date().getFullYear()} Norvexis Core</p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        /* ── ROOT ── */
        .nv-login-root {
          min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden; font-family: 'Inter', system-ui, sans-serif;
        }

        /* ── BACKGROUND ── */
        .nv-bg {
          position: absolute; inset: 0;
          background: linear-gradient(145deg, #080c12 0%, #0a0f18 40%, #060a10 100%);
        }
        .nv-bg-glow {
          position: absolute; width: 600px; height: 600px; top: -15%; left: 50%; transform: translateX(-50%);
          background: radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 60%);
          pointer-events: none;
        }

        /* ── CONTAINER ── */
        .nv-container {
          position: relative; z-index: 1; width: 100%; max-width: 400px; padding: 0 20px;
          display: flex; flex-direction: column; align-items: center;
          opacity: 0; transform: translateY(24px);
          transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1);
        }
        .nv-container.nv-in { opacity: 1; transform: translateY(0); }

        /* ── LOGO ── */
        .nv-logo-wrap {
          width: 72px; height: 72px; border-radius: 20px; margin-bottom: 20px;
          display: flex; align-items: center; justify-content: center; overflow: hidden;
          box-shadow: 0 0 0 1px rgba(16,185,129,0.1), 0 8px 32px rgba(0,0,0,0.4);
        }
        .nv-logo { width: 100%; height: 100%; object-fit: cover; border-radius: 20px; }

        /* ── BRAND ── */
        .nv-brand {
          font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.02em;
          margin-bottom: 32px; text-align: center;
        }
        .nv-brand span { color: #10b981; }

        /* ── CARD ── */
        .nv-card {
          width: 100%; border-radius: 20px; overflow: hidden;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 1px 2px rgba(0,0,0,0.2), 0 16px 40px rgba(0,0,0,0.15);
          transition: border-color 0.4s, box-shadow 0.4s;
        }
        .nv-card:hover { border-color: rgba(16,185,129,0.12); }
        .nv-card-inner { padding: 32px; }
        @media (max-width: 480px) { .nv-card-inner { padding: 24px; } }

        /* ── HEADER ── */
        .nv-header { margin-bottom: 28px; }
        .nv-header h2 { font-size: 20px; font-weight: 700; color: #fff; margin: 0 0 6px; letter-spacing: -0.01em; }
        .nv-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; font-weight: 400; line-height: 1.5; }

        /* ── ALERTS ── */
        .nv-alert {
          display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px;
          border-radius: 12px; margin-bottom: 20px; font-size: 13px; font-weight: 500; line-height: 1.45;
        }
        .nv-alert i { font-size: 13px; margin-top: 2px; flex-shrink: 0; }
        .nv-alert-error { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.12); color: #f87171; }
        .nv-alert-ok { background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.12); color: #34d399; }

        /* ── FIELDS ── */
        .nv-field { margin-bottom: 20px; }
        .nv-field label {
          display: block; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.4);
          margin-bottom: 8px; letter-spacing: 0.01em;
        }
        .nv-input-wrap {
          position: relative; display: flex; align-items: center;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; transition: all 0.25s ease;
        }
        .nv-input-wrap:focus-within {
          border-color: rgba(16,185,129,0.4);
          box-shadow: 0 0 0 3px rgba(16,185,129,0.08);
          background: rgba(16,185,129,0.03);
        }
        .nv-icon {
          position: absolute; left: 14px; font-size: 12px;
          color: rgba(255,255,255,0.15);
          transition: color 0.25s;
        }
        .nv-input-wrap:focus-within .nv-icon { color: rgba(16,185,129,0.6); }
        .nv-input-wrap input {
          width: 100%; height: 48px; padding: 0 42px 0 40px;
          background: transparent; border: none; outline: none;
          color: #fff; font-size: 14px; font-weight: 500; font-family: inherit;
        }
        .nv-input-wrap input::placeholder { color: rgba(255,255,255,0.12); }

        .nv-eye {
          position: absolute; right: 8px; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px; border: none; background: transparent;
          color: rgba(255,255,255,0.15); cursor: pointer; transition: all 0.2s;
        }
        .nv-eye:hover { color: rgba(16,185,129,0.6); background: rgba(255,255,255,0.04); }

        /* ── FORGOT ── */
        .nv-forgot-row { display: flex; justify-content: flex-end; margin: -8px 0 4px; }
        .nv-link {
          font-size: 12px; font-weight: 500; color: rgba(16,185,129,0.5); background: none;
          border: none; cursor: pointer; padding: 4px 0; transition: color 0.2s; font-family: inherit;
        }
        .nv-link:hover { color: #10b981; }

        /* ── SUBMIT BUTTON ── */
        .nv-submit {
          width: 100%; height: 48px; border-radius: 12px; border: none;
          background: #10b981; color: #fff; font-size: 14px; font-weight: 600;
          font-family: inherit; cursor: pointer; position: relative; overflow: hidden;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.25s ease; margin-top: 8px;
          box-shadow: 0 1px 2px rgba(16,185,129,0.2), 0 4px 12px rgba(16,185,129,0.15);
        }
        .nv-submit:hover:not(:disabled) {
          background: #059669;
          box-shadow: 0 1px 2px rgba(16,185,129,0.3), 0 8px 24px rgba(16,185,129,0.2);
          transform: translateY(-1px);
        }
        .nv-submit:active:not(:disabled) { transform: translateY(0) scale(0.98); }
        .nv-submit:disabled { opacity: 0.7; cursor: not-allowed; }
        .nv-submit .nv-arrow { font-size: 11px; transition: transform 0.2s; }
        .nv-submit:hover .nv-arrow { transform: translateX(3px); }
        .nv-submit.is-loading { pointer-events: none; }

        /* ── SPINNER ── */
        .nv-spinner {
          width: 22px; height: 22px; border-radius: 50%;
          border: 2.5px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          animation: nvSpin 0.7s linear infinite;
        }

        /* ── BACK ── */
        .nv-back {
          width: 100%; height: 40px; display: flex; align-items: center; justify-content: center;
          gap: 8px; margin-top: 12px; border-radius: 10px; border: none;
          background: transparent; color: rgba(255,255,255,0.2); font-size: 13px;
          font-weight: 500; cursor: pointer; transition: color 0.2s; font-family: inherit;
        }
        .nv-back i { font-size: 11px; }
        .nv-back:hover { color: rgba(255,255,255,0.5); }

        /* ── FOOTER ── */
        .nv-footer {
          margin-top: 32px; font-size: 11px; font-weight: 500;
          color: rgba(255,255,255,0.07); text-align: center; letter-spacing: 0.02em;
        }

        /* ── SUCCESS OVERLAY ── */
        .nv-success-overlay {
          position: fixed; inset: 0; z-index: 50;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: rgba(6,10,16,0.92); backdrop-filter: blur(8px);
          animation: nvFadeIn 0.4s ease;
        }
        .nv-success-check {
          width: 64px; height: 64px; border-radius: 50%;
          background: rgba(16,185,129,0.1); border: 2px solid rgba(16,185,129,0.3);
          display: flex; align-items: center; justify-content: center;
          color: #10b981; animation: nvScaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1);
        }
        .nv-success-check svg { width: 28px; height: 28px; }
        .nv-check-path {
          stroke-dasharray: 24; stroke-dashoffset: 24;
          animation: nvDrawCheck 0.4s ease 0.3s forwards;
        }
        .nv-success-text {
          margin-top: 20px; font-size: 15px; font-weight: 600;
          color: rgba(255,255,255,0.5);
          animation: nvFadeIn 0.4s ease 0.4s both;
        }

        /* ── SHAKE ── */
        @keyframes nvShake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-4px); }
          40%,80% { transform: translateX(4px); }
        }
        .nv-shake { animation: nvShake 0.4s ease-in-out; }

        /* ── ANIMATIONS ── */
        @keyframes nvSpin { to { transform: rotate(360deg); } }
        @keyframes nvFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nvScaleIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes nvDrawCheck { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
};

export default Login;
