import React, { useState, useEffect, useRef } from 'react';
import { UserRole } from '../types';
import { supabase } from '../src/lib/supabase';

interface LoginProps {
  onLogin: (user: any) => void;
  onPasswordSet?: () => void;
  t: (key: string) => string;
  forcePasswordUpdate?: boolean;
}

/* ─── Norvexis Logo (Real PNG) ─── */
const NvLogo: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <img src="/logo.png" alt="Norvexis Core" width={size} height={size} className="object-contain" />
);

const Login: React.FC<LoginProps> = ({ onLogin, onPasswordSet, t, forcePasswordUpdate }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot' | 'update-password'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loginState, setLoginState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));

    if (forcePasswordUpdate ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('type=invite') ||
      window.location.hash.includes('type=signup') ||
      (window.location.hash.includes('error=access_denied&error_code=403') === false && window.location.hash.includes('access_token='))) {
      if (forcePasswordUpdate || window.location.hash.includes('type=')) {
        setAuthMode('update-password');
      }
    }

    document.body.classList.add('premium-auth-flow');
    return () => document.body.classList.remove('premium-auth-flow');
  }, [forcePasswordUpdate]);

  // Clear error state after 4s
  useEffect(() => {
    if (loginState === 'error') {
      const t = setTimeout(() => setLoginState('idle'), 4000);
      return () => clearTimeout(t);
    }
  }, [loginState]);

  const triggerError = (msg: string) => {
    setError(msg);
    setLoginState('error');
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setLoginState('loading');
    setError(null);
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;

      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      if (username) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({ username }).eq('id', user.id);
        }
      }

      await supabase.auth.signOut();
      alert('Contraseña guardada exitosamente. Por favor, inicia sesión con tu nueva contraseña.');

      if (onPasswordSet) onPasswordSet();
      setAuthMode('signin');
      setPassword('');
      setUsername('');
      setEmail('');
      setLoginState('idle');
    } catch (err: any) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'update-password') return handleUpdatePassword(e);

    setLoading(true);
    setLoginState('loading');
    setError(null);
    setSuccess(null);

    try {
      if (authMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.includes('@') ? email : `${username}@healthaxis.com`,
          password
        });
        if (error) throw error;
        if (data.user) {
          setLoginState('success');
          setSuccess(t('msg_login_success'));
          // Delay to show retina scan animation
          setTimeout(() => onLogin(data.user), 2200);
        }
      } else if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: email.split('@')[0] } }
        });
        if (error) throw error;
        alert('Verification email sent!');
        setAuthMode('signin');
        setLoginState('idle');
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccess('Recovery link sent to your email.');
        setLoginState('idle');
        setTimeout(() => { setAuthMode('signin'); setSuccess(null); }, 4000);
      }
    } catch (err: any) {
      triggerError(err.message);
    } finally {
      if (loginState !== 'success') setLoading(false);
    }
  };

  const borderColor = loginState === 'error'
    ? 'rgba(220,38,38,0.6)'
    : loginState === 'success'
      ? 'rgba(16,185,129,0.6)'
      : 'rgba(16,185,129,0.12)';

  return (
    <div className="nv-login min-h-screen w-full flex items-center justify-center relative overflow-hidden">

      {/* ═══ BACKGROUND ═══ */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, #0d1117 0%, #080b10 40%, #030507 100%)' }} />

      {/* Data mesh grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `
          linear-gradient(rgba(16,185,129,0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(16,185,129,0.3) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      {/* World map wireframe overlay — using dots pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `radial-gradient(rgba(16,185,129,0.5) 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }} />

      {/* Ambient orbs */}
      <div className="nv-orb absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 65%)' }} />
      <div className="nv-orb absolute bottom-[-10%] right-[5%] w-[600px] h-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(5,150,105,0.06) 0%, transparent 65%)', animationDirection: 'reverse', animationDuration: '25s' }} />

      {/* ═══ RETINA SCAN OVERLAY (on success) ═══ */}
      {loginState === 'success' && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* Scan line */}
          <div className="nv-scan-line absolute left-0 right-0 h-[3px]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.8), rgba(52,211,153,1), rgba(16,185,129,0.8), transparent)', boxShadow: '0 0 30px rgba(16,185,129,0.5), 0 0 60px rgba(16,185,129,0.3)' }} />
          {/* Flash */}
          <div className="nv-scan-flash absolute inset-0" style={{ background: 'rgba(16,185,129,0.03)' }} />
          {/* Center reticle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="nv-reticle w-32 h-32 rounded-full border-2 border-emerald-500/30 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border border-emerald-400/40 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-emerald-400 nv-pulse-dot" />
              </div>
            </div>
          </div>
          {/* Access granted text */}
          <div className="absolute inset-0 flex items-center justify-center mt-28">
            <span className="nv-access-text text-emerald-400/80 text-xs font-bold tracking-[0.4em] uppercase">
              Access Granted
            </span>
          </div>
        </div>
      )}

      {/* ═══ MAIN CONTAINER ═══ */}
      <div className={`relative z-10 w-full max-w-md px-6 transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

        {/* ── Logo + Brand ── */}
        <div className={`text-center mb-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 relative" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <NvLogo size={38} />
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-2xl nv-logo-pulse" style={{ border: '1px solid rgba(16,185,129,0.2)' }} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none">
            Norvexis <span className="text-emerald-400">Core</span>
          </h1>
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase mt-2.5" style={{ color: 'rgba(16,185,129,0.35)' }}>
            Secure Access Terminal
          </p>
        </div>

        {/* ── Glass Card ── */}
        <div ref={cardRef}
          className={`nv-card relative rounded-[2rem] overflow-hidden transition-all duration-500
            ${loginState === 'error' ? 'nv-shake nv-glitch' : ''}`}
          style={{
            background: 'rgba(13,17,23,0.8)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: `1px solid ${borderColor}`,
            boxShadow: loginState === 'error'
              ? '0 0 40px rgba(220,38,38,0.1), inset 0 0 40px rgba(220,38,38,0.03)'
              : loginState === 'success'
                ? '0 0 60px rgba(16,185,129,0.15), inset 0 0 40px rgba(16,185,129,0.03)'
                : '0 0 60px rgba(16,185,129,0.04), inset 0 1px 0 rgba(255,255,255,0.03)'
          }}
        >
          {/* Top shine */}
          <div className="absolute top-0 left-10 right-10 h-[1px]"
            style={{ background: loginState === 'error'
              ? 'linear-gradient(90deg, transparent, rgba(220,38,38,0.3), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(16,185,129,0.15), transparent)' }} />

          {/* Corner accents */}
          <div className="absolute top-4 left-4 w-3 h-3 border-t border-l rounded-tl-sm transition-colors duration-500"
            style={{ borderColor: loginState === 'error' ? 'rgba(220,38,38,0.4)' : 'rgba(16,185,129,0.2)' }} />
          <div className="absolute top-4 right-4 w-3 h-3 border-t border-r rounded-tr-sm transition-colors duration-500"
            style={{ borderColor: loginState === 'error' ? 'rgba(220,38,38,0.4)' : 'rgba(16,185,129,0.2)' }} />
          <div className="absolute bottom-4 left-4 w-3 h-3 border-b border-l rounded-bl-sm transition-colors duration-500"
            style={{ borderColor: loginState === 'error' ? 'rgba(220,38,38,0.4)' : 'rgba(16,185,129,0.2)' }} />
          <div className="absolute bottom-4 right-4 w-3 h-3 border-b border-r rounded-br-sm transition-colors duration-500"
            style={{ borderColor: loginState === 'error' ? 'rgba(220,38,38,0.4)' : 'rgba(16,185,129,0.2)' }} />

          <div className="p-8 sm:p-10">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 nv-status-dot" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(16,185,129,0.5)' }}>
                  {authMode === 'signin' ? 'System Ready' : authMode === 'forgot' ? 'Recovery Mode' : authMode === 'update-password' ? 'Security Update' : 'New User'}
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {authMode === 'signin' && 'Identity Verification'}
                {authMode === 'forgot' && 'Password Recovery'}
                {authMode === 'update-password' && 'Set New Password'}
                {authMode === 'signup' && 'Create Account'}
              </h2>
              <p className="text-sm mt-1.5 font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {authMode === 'signin' && 'Authenticate to access your workspace'}
                {authMode === 'forgot' && 'We\'ll send a secure recovery link'}
                {authMode === 'update-password' && 'Choose a strong password'}
                {authMode === 'signup' && 'Initialize your account'}
              </p>
            </div>

            {/* ── Error ── */}
            {error && (
              <div className="mb-6 p-3.5 rounded-xl flex items-start gap-3"
                style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <i className="fa-solid fa-hexagon-exclamation text-red-400 text-sm mt-0.5"></i>
                <span className="text-red-400/80 text-sm font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* ── Success ── */}
            {success && loginState !== 'success' && (
              <div className="mb-6 p-3.5 rounded-xl flex items-start gap-3"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <i className="fa-solid fa-circle-check text-emerald-400 text-sm mt-0.5"></i>
                <span className="text-emerald-400/80 text-sm font-medium leading-relaxed">{success}</span>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-5">

              {/* ── Email ── */}
              {authMode !== 'update-password' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-medium tracking-[0.15em] uppercase ml-1"
                    style={{ color: 'rgba(255,255,255,0.2)', fontFamily: "'Inter', sans-serif" }}>
                    {t('lbl_email')}
                  </label>
                  <div className="relative">
                    <i className="fa-solid fa-at absolute left-4 top-1/2 -translate-y-1/2 text-xs nv-input-icon" style={{ color: 'rgba(255,255,255,0.12)' }}></i>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@clinic.com"
                      autoComplete="email"
                      className="nv-field w-full h-[3.2rem] pl-11 pr-4 rounded-xl text-white font-medium text-sm outline-none transition-all duration-400"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid transparent', fontFamily: "'Inter', sans-serif" }}
                    />
                  </div>
                </div>
              )}

              {/* ── Password ── */}
              {authMode !== 'forgot' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-medium tracking-[0.15em] uppercase ml-1"
                    style={{ color: 'rgba(255,255,255,0.2)', fontFamily: "'Inter', sans-serif" }}>
                    {authMode === 'update-password' ? t('lbl_new_password') : t('lbl_password')}
                  </label>
                  <div className="relative">
                    <i className="fa-solid fa-fingerprint absolute left-4 top-1/2 -translate-y-1/2 text-xs nv-input-icon" style={{ color: 'rgba(255,255,255,0.12)' }}></i>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      autoComplete={authMode === 'update-password' ? 'new-password' : 'current-password'}
                      className="nv-field w-full h-[3.2rem] pl-11 pr-12 rounded-xl text-white font-medium text-sm outline-none transition-all duration-400"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid transparent', fontFamily: "'Inter', sans-serif" }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{ color: 'rgba(255,255,255,0.15)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(16,185,129,0.6)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.15)'}>
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                    </button>
                  </div>
                </div>
              )}

              {/* Forgot */}
              {authMode === 'signin' && (
                <div className="flex justify-end -mt-1">
                  <button type="button"
                    onClick={() => { setAuthMode('forgot'); setError(null); setSuccess(null); setLoginState('idle'); }}
                    className="text-[11px] font-medium transition-colors"
                    style={{ color: 'rgba(16,185,129,0.35)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(16,185,129,0.7)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(16,185,129,0.35)'}>
                    Forgot password?
                  </button>
                </div>
              )}

              {/* ── Tactical Submit Button ── */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`nv-tactical-btn relative overflow-hidden rounded-xl font-bold text-sm tracking-wide transition-all duration-500 cursor-pointer
                    ${loginState === 'loading' ? 'w-14 h-14 rounded-full mx-auto' : 'w-full h-[3.2rem]'}`}
                  style={{
                    background: loginState === 'loading' ? 'transparent' : 'rgba(16,185,129,1)',
                    color: 'white',
                    border: loginState === 'loading' ? '2px solid rgba(16,185,129,0.3)' : 'none',
                    boxShadow: loginState === 'loading' ? 'none' : '0 0 30px rgba(16,185,129,0.2), 0 4px 20px rgba(16,185,129,0.3)',
                  }}
                >
                  {loginState === 'loading' ? (
                    /* Orbital ring */
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="nv-orbital w-full h-full rounded-full" style={{
                        border: '2px solid transparent',
                        borderTopColor: 'rgba(16,185,129,0.9)',
                        borderRightColor: 'rgba(16,185,129,0.3)',
                      }} />
                    </div>
                  ) : (
                    <>
                      {/* Hover glow pulse */}
                      <div className="absolute inset-0 bg-white/0 hover:bg-white/5 transition-all duration-300" />
                      <div className="nv-btn-pulse absolute inset-0 rounded-xl" />
                      <span className="relative z-10 flex items-center justify-center gap-2.5">
                        <span style={{ fontFamily: "'Inter', sans-serif" }}>
                          {authMode === 'signin' ? t('btn_login')
                            : authMode === 'forgot' ? 'Send Link'
                            : authMode === 'signup' ? 'Initialize'
                              : t('btn_save_password')}
                        </span>
                        <i className={`fa-solid ${authMode === 'forgot' ? 'fa-paper-plane' : 'fa-arrow-right'} text-xs`}></i>
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Back */}
              {(authMode === 'forgot' || authMode === 'update-password') && (
                <button type="button"
                  onClick={() => { setAuthMode('signin'); setError(null); setSuccess(null); setLoginState('idle'); }}
                  className="w-full text-center text-sm font-medium flex items-center justify-center gap-2 py-2 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.15)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.15)'}>
                  <i className="fa-solid fa-arrow-left text-xs"></i>
                  Back to Terminal
                </button>
              )}
            </form>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={`mt-8 text-center transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-[9px] font-bold tracking-[0.35em] uppercase" style={{ color: 'rgba(255,255,255,0.06)' }}>
            &copy; {new Date().getFullYear()} Norvexis Core &middot; Encrypted Channel
          </p>
        </div>
      </div>

      {/* ═══ SCOPED STYLES ═══ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap');

        /* ── Floating orbs ── */
        @keyframes nvFloat { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(20px,-30px) scale(1.02)} 66%{transform:translate(-15px,15px) scale(0.98)} }
        .nv-orb { animation: nvFloat 22s ease-in-out infinite; }

        /* ── Input fields: borderless → emerald glow on focus ── */
        .nv-field::placeholder { color: rgba(255,255,255,0.08); font-family: 'Inter', sans-serif; }
        .nv-field:focus {
          background: rgba(16,185,129,0.04) !important;
          border-color: rgba(16,185,129,0.35) !important;
          box-shadow: 0 0 0 4px rgba(16,185,129,0.06), inset 0 0 20px rgba(16,185,129,0.03);
        }
        .nv-field:focus ~ .nv-input-icon,
        .nv-field:focus + .nv-input-icon { color: rgba(16,185,129,0.6) !important; }

        /* ── Status dot blink ── */
        @keyframes nvBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .nv-status-dot { animation: nvBlink 2s ease-in-out infinite; }

        /* ── Logo pulse ── */
        @keyframes nvLogoPulse { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:0;transform:scale(1.3)} }
        .nv-logo-pulse { animation: nvLogoPulse 3s ease-in-out infinite; }

        /* ── Tactical button hover pulse ── */
        @keyframes nvBtnPulse { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.3)} 50%{box-shadow:0 0 0 8px rgba(16,185,129,0)} }
        .nv-tactical-btn:not(:disabled):hover .nv-btn-pulse { animation: nvBtnPulse 2s ease-in-out infinite; }
        .nv-tactical-btn:active { transform: scale(0.97); }

        /* ── Orbital loading spinner ── */
        @keyframes nvOrbital { to { transform: rotate(360deg); } }
        .nv-orbital { animation: nvOrbital 1s linear infinite; }

        /* ── Shake + glitch (error) ── */
        @keyframes nvShake {
          0%,100% { transform: translateX(0); }
          10%,30%,50%,70%,90% { transform: translateX(-4px); }
          20%,40%,60%,80% { transform: translateX(4px); }
        }
        .nv-shake { animation: nvShake 0.6s ease-in-out; }

        @keyframes nvGlitch {
          0%,100% { clip-path: inset(0 0 0 0); filter: none; }
          20% { clip-path: inset(5% 0 80% 0); filter: hue-rotate(90deg); }
          40% { clip-path: inset(60% 0 5% 0); filter: hue-rotate(-90deg); }
          60% { clip-path: inset(30% 0 40% 0); filter: saturate(3); }
          80% { clip-path: inset(0 0 0 0); filter: none; }
        }
        .nv-glitch::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 2rem;
          border: 1px solid rgba(220,38,38,0.4);
          animation: nvGlitch 0.3s linear 1;
          pointer-events: none;
        }

        /* ── Retina scan line ── */
        @keyframes nvScanLine {
          0% { top: -5%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 105%; opacity: 0; }
        }
        .nv-scan-line { animation: nvScanLine 1.8s ease-in-out 1; }

        /* ── Scan flash ── */
        @keyframes nvScanFlash { 0%{opacity:0} 30%{opacity:1} 100%{opacity:0} }
        .nv-scan-flash { animation: nvScanFlash 2s ease-out 1; }

        /* ── Reticle ── */
        @keyframes nvReticle { 0%{transform:scale(0.5);opacity:0} 50%{transform:scale(1);opacity:1} 100%{transform:scale(1.2);opacity:0} }
        .nv-reticle { animation: nvReticle 2s ease-out 1; }

        /* ── Pulse dot ── */
        @keyframes nvPulseDot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(2);opacity:0.3} }
        .nv-pulse-dot { animation: nvPulseDot 1s ease-in-out infinite; }

        /* ── Access granted text ── */
        @keyframes nvAccessText { 0%{opacity:0;letter-spacing:0.8em} 50%{opacity:1;letter-spacing:0.4em} 100%{opacity:0} }
        .nv-access-text { animation: nvAccessText 2.2s ease-out 1; }
      `}</style>
    </div>
  );
};

export default Login;
