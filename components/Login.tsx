import React, { useState, useEffect, useRef } from 'react';
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
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));

    if (forcePasswordUpdate ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('type=invite') ||
      window.location.hash.includes('type=signup') ||
      (!window.location.hash.includes('error=access_denied&error_code=403') && window.location.hash.includes('access_token='))) {
      if (forcePasswordUpdate || window.location.hash.includes('type=')) {
        setAuthMode('update-password');
      }
    }
    return () => cancelAnimationFrame(raf);
  }, [forcePasswordUpdate]);

  useEffect(() => {
    if (phase === 'error') {
      const timer = setTimeout(() => setPhase('idle'), 4000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const triggerError = (msg: string) => {
    setError(msg);
    setPhase('error');
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setPhase('loading');
    setError(null);
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      if (username) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('profiles').update({ username }).eq('id', user.id);
      }
      await supabase.auth.signOut();
      alert('Contraseña guardada exitosamente. Por favor, inicia sesión con tu nueva contraseña.');
      if (onPasswordSet) onPasswordSet();
      setAuthMode('signin');
      setPassword('');
      setUsername('');
      setEmail('');
      setPhase('idle');
    } catch (err: any) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'update-password') return handleUpdatePassword(e);
    setLoading(true);
    setPhase('loading');
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
          setPhase('success');
          setSuccess(t('msg_login_success'));
          setTimeout(() => onLogin(data.user), 2400);
        }
      } else if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: email.split('@')[0] } }
        });
        if (error) throw error;
        alert('Verification email sent!');
        setAuthMode('signin');
        setPhase('idle');
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setSuccess('Recovery link sent to your email.');
        setPhase('idle');
        setTimeout(() => { setAuthMode('signin'); setSuccess(null); }, 4000);
      }
    } catch (err: any) {
      triggerError(err.message);
    } finally {
      if (phase !== 'success') setLoading(false);
    }
  };

  // Dynamic border color based on state
  const cardBorder = phase === 'error' ? 'rgba(239,68,68,0.5)' : phase === 'success' ? 'rgba(16,185,129,0.5)' : 'rgba(16,185,129,0.1)';
  const cardShadow = phase === 'error'
    ? '0 0 80px rgba(239,68,68,0.08), inset 0 0 60px rgba(239,68,68,0.02)'
    : phase === 'success'
      ? '0 0 80px rgba(16,185,129,0.12), inset 0 0 60px rgba(16,185,129,0.03)'
      : '0 0 80px rgba(16,185,129,0.03)';

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{ background: '#040608' }}>

      {/* ═══════════ BACKGROUND LAYERS ═══════════ */}
      {/* Radial gradient base */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 35%, #0c1018 0%, #060a0f 45%, #030507 100%)' }} />

      {/* Data mesh — subtle emerald grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 70%)',
      }} />

      {/* Floating ambient light */}
      <div className="nv-float absolute w-[500px] h-[500px] rounded-full" style={{ top: '-8%', left: '15%', background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 65%)' }} />
      <div className="nv-float absolute w-[400px] h-[400px] rounded-full" style={{ bottom: '0%', right: '10%', background: 'radial-gradient(circle, rgba(5,150,105,0.05) 0%, transparent 65%)', animationDelay: '8s', animationDirection: 'reverse' }} />

      {/* ═══════════ RETINA SCAN OVERLAY (success) ═══════════ */}
      {phase === 'success' && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="nv-scanline absolute left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.6), rgba(52,211,153,0.9), rgba(16,185,129,0.6), transparent)', boxShadow: '0 0 40px 8px rgba(16,185,129,0.15)' }} />
          <div className="nv-scanflash absolute inset-0" style={{ background: 'rgba(16,185,129,0.02)' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="nv-reticle w-28 h-28 rounded-full" style={{ border: '1.5px solid rgba(16,185,129,0.25)' }}>
              <div className="w-full h-full rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(16,185,129,0.15)' }}>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 nv-pulse-dot" />
              </div>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: '140px' }}>
            <span className="nv-granted text-emerald-400/70 text-[11px] font-bold tracking-[0.5em] uppercase">
              Access Granted
            </span>
          </div>
        </div>
      )}

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className={`relative z-10 w-full max-w-[420px] px-5 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>

        {/* ── BRANDING ── */}
        <div className={`text-center mb-10 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          {/* Logo — prominently displayed with glow ring */}
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-[1.4rem] flex items-center justify-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.06) 100%)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <img src="/logo.png" alt="Norvexis Core" className="w-14 h-14 object-contain relative z-10" />
            </div>
            {/* Pulse ring behind logo */}
            <div className="absolute inset-0 rounded-[1.4rem] nv-logo-ring" style={{ border: '1px solid rgba(16,185,129,0.15)' }} />
            {/* Subtle glow */}
            <div className="absolute -inset-3 rounded-[1.8rem] blur-xl" style={{ background: 'rgba(16,185,129,0.06)' }} />
          </div>
          <h1 className="text-[1.75rem] font-black text-white tracking-tight leading-none">
            Norvexis <span className="text-emerald-400">Core</span>
          </h1>
          <p className="text-[10px] font-semibold tracking-[0.25em] uppercase mt-2" style={{ color: 'rgba(16,185,129,0.3)' }}>
            Secure Access Terminal
          </p>
        </div>

        {/* ── GLASS CARD ── */}
        <div className={`nv-card relative rounded-[1.75rem] overflow-hidden transition-all duration-500 ${phase === 'error' ? 'nv-shake nv-glitch' : ''}`}
          style={{ background: 'rgba(10,14,20,0.85)', backdropFilter: 'blur(40px)', border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}>

          {/* Card inner highlight line */}
          <div className="absolute top-0 left-12 right-12 h-px" style={{
            background: phase === 'error'
              ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.25), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(16,185,129,0.12), transparent)'
          }} />

          {/* Tactical corner brackets */}
          <div className="absolute top-3.5 left-3.5 w-2.5 h-2.5 transition-colors duration-500" style={{ borderTop: `1px solid ${phase === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.18)'}`, borderLeft: `1px solid ${phase === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.18)'}` }} />
          <div className="absolute top-3.5 right-3.5 w-2.5 h-2.5 transition-colors duration-500" style={{ borderTop: `1px solid ${phase === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.18)'}`, borderRight: `1px solid ${phase === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.18)'}` }} />
          <div className="absolute bottom-3.5 left-3.5 w-2.5 h-2.5 transition-colors duration-500" style={{ borderBottom: `1px solid ${phase === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.18)'}`, borderLeft: `1px solid ${phase === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.18)'}` }} />
          <div className="absolute bottom-3.5 right-3.5 w-2.5 h-2.5 transition-colors duration-500" style={{ borderBottom: `1px solid ${phase === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.18)'}`, borderRight: `1px solid ${phase === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.18)'}` }} />

          <div className="p-7 sm:p-9">
            {/* Status + Title */}
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-1.5 h-1.5 rounded-full nv-blink" style={{ background: phase === 'error' ? '#ef4444' : '#10b981' }} />
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: phase === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.4)' }}>
                  {phase === 'error' ? 'Authentication Failed' : authMode === 'signin' ? 'System Online' : authMode === 'forgot' ? 'Recovery Mode' : authMode === 'update-password' ? 'Security Update' : 'Registration'}
                </span>
              </div>
              <h2 className="text-[1.5rem] font-black text-white tracking-tight leading-snug">
                {authMode === 'signin' && 'Identity Verification'}
                {authMode === 'forgot' && 'Password Recovery'}
                {authMode === 'update-password' && 'Set New Password'}
                {authMode === 'signup' && 'Create Account'}
              </h2>
              <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {authMode === 'signin' && 'Authenticate to access your workspace'}
                {authMode === 'forgot' && 'We\'ll send a secure recovery link'}
                {authMode === 'update-password' && 'Choose a strong, secure password'}
                {authMode === 'signup' && 'Initialize your operator account'}
              </p>
            </div>

            {/* Error alert */}
            {error && (
              <div className="mb-5 p-3 rounded-xl flex items-start gap-2.5" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
                <i className="fa-solid fa-triangle-exclamation text-red-400/80 text-xs mt-0.5"></i>
                <span className="text-red-400/80 text-[13px] font-medium leading-snug">{error}</span>
              </div>
            )}

            {/* Success alert */}
            {success && phase !== 'success' && (
              <div className="mb-5 p-3 rounded-xl flex items-start gap-2.5" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)' }}>
                <i className="fa-solid fa-circle-check text-emerald-400/80 text-xs mt-0.5"></i>
                <span className="text-emerald-400/80 text-[13px] font-medium leading-snug">{success}</span>
              </div>
            )}

            {/* ── FORM ── */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email */}
              {authMode !== 'update-password' && (
                <div>
                  <label className="block text-[9px] font-bold tracking-[0.15em] uppercase mb-2 ml-0.5 transition-colors duration-300"
                    style={{ color: emailFocused ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.18)' }}>
                    {t('lbl_email')}
                  </label>
                  <div className="relative">
                    <i className={`fa-solid fa-at absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] transition-colors duration-300`}
                      style={{ color: emailFocused ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.1)' }} />
                    <input type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      placeholder="operator@clinic.com"
                      autoComplete="email"
                      className="nv-input w-full h-12 pl-10 pr-4 rounded-xl text-white text-[13px] font-medium outline-none transition-all duration-300"
                      style={{
                        background: emailFocused ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                        border: emailFocused ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.04)',
                        boxShadow: emailFocused ? '0 0 0 3px rgba(16,185,129,0.06), inset 0 0 20px rgba(16,185,129,0.02)' : 'none',
                      }} />
                  </div>
                </div>
              )}

              {/* Password */}
              {authMode !== 'forgot' && (
                <div>
                  <label className="block text-[9px] font-bold tracking-[0.15em] uppercase mb-2 ml-0.5 transition-colors duration-300"
                    style={{ color: passFocused ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.18)' }}>
                    {authMode === 'update-password' ? t('lbl_new_password') : t('lbl_password')}
                  </label>
                  <div className="relative">
                    <i className={`fa-solid fa-fingerprint absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] transition-colors duration-300`}
                      style={{ color: passFocused ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.1)' }} />
                    <input type={showPassword ? 'text' : 'password'} required value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPassFocused(true)}
                      onBlur={() => setPassFocused(false)}
                      placeholder="••••••••••"
                      autoComplete={authMode === 'update-password' ? 'new-password' : 'current-password'}
                      className="nv-input w-full h-12 pl-10 pr-12 rounded-xl text-white text-[13px] font-medium outline-none transition-all duration-300"
                      style={{
                        background: passFocused ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                        border: passFocused ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.04)',
                        boxShadow: passFocused ? '0 0 0 3px rgba(16,185,129,0.06), inset 0 0 20px rgba(16,185,129,0.02)' : 'none',
                      }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/[0.04]"
                      style={{ color: 'rgba(255,255,255,0.12)' }}>
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-[11px]`}></i>
                    </button>
                  </div>
                </div>
              )}

              {/* Forgot password link */}
              {authMode === 'signin' && (
                <div className="flex justify-end -mt-1">
                  <button type="button"
                    onClick={() => { setAuthMode('forgot'); setError(null); setSuccess(null); setPhase('idle'); }}
                    className="text-[11px] font-medium transition-colors duration-200 hover:text-emerald-400/70"
                    style={{ color: 'rgba(16,185,129,0.3)' }}>
                    Forgot password?
                  </button>
                </div>
              )}

              {/* ── TACTICAL SUBMIT BUTTON ── */}
              <div className="pt-1">
                <button type="submit" disabled={loading}
                  className={`nv-btn relative overflow-hidden rounded-xl font-bold text-[13px] tracking-wide text-white transition-all duration-500 cursor-pointer disabled:cursor-not-allowed
                    ${phase === 'loading' ? 'w-12 h-12 rounded-full mx-auto p-0' : 'w-full h-12'}`}
                  style={{
                    background: phase === 'loading' ? 'transparent' : '#10b981',
                    border: phase === 'loading' ? '2px solid rgba(16,185,129,0.25)' : '1px solid rgba(16,185,129,0.3)',
                    boxShadow: phase === 'loading' ? 'none' : '0 0 25px rgba(16,185,129,0.15), 0 4px 15px rgba(16,185,129,0.2)',
                    opacity: loading && phase !== 'loading' ? 0.6 : 1,
                  }}>
                  {phase === 'loading' ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="nv-orbital w-full h-full rounded-full"
                        style={{ border: '2px solid transparent', borderTopColor: '#10b981', borderRightColor: 'rgba(16,185,129,0.2)' }} />
                    </div>
                  ) : (
                    <>
                      {/* Hover glow */}
                      <div className="absolute inset-0 bg-white/0 hover:bg-white/[0.06] transition-all duration-300" />
                      {/* Pulse on hover */}
                      <div className="nv-btn-glow absolute inset-0 rounded-xl" />
                      {/* Top shine */}
                      <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {authMode === 'signin' ? t('btn_login')
                          : authMode === 'forgot' ? 'Send Recovery Link'
                          : authMode === 'signup' ? 'Create Account'
                          : t('btn_save_password')}
                        <i className={`fa-solid ${authMode === 'forgot' ? 'fa-paper-plane' : 'fa-arrow-right'} text-[10px] transition-transform duration-300 group-hover:translate-x-1`}></i>
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Back link */}
              {(authMode === 'forgot' || authMode === 'update-password') && (
                <button type="button"
                  onClick={() => { setAuthMode('signin'); setError(null); setSuccess(null); setPhase('idle'); }}
                  className="w-full text-center text-[13px] font-medium flex items-center justify-center gap-2 py-1.5 transition-colors hover:text-white/40"
                  style={{ color: 'rgba(255,255,255,0.15)' }}>
                  <i className="fa-solid fa-arrow-left text-[10px]"></i>
                  Back to Sign In
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className={`mt-8 text-center transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-[8px] font-semibold tracking-[0.35em] uppercase" style={{ color: 'rgba(255,255,255,0.05)' }}>
            &copy; {new Date().getFullYear()} Norvexis Core &middot; Encrypted Channel
          </p>
        </div>
      </div>

      {/* ═══════════ STYLES ═══════════ */}
      <style>{`
        @keyframes nvFloat{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(20px,-25px) scale(1.02)}66%{transform:translate(-12px,15px) scale(0.98)}}
        .nv-float{animation:nvFloat 22s ease-in-out infinite}

        .nv-input::placeholder{color:rgba(255,255,255,0.07)}

        @keyframes nvBlink{0%,100%{opacity:1}50%{opacity:0.2}}
        .nv-blink{animation:nvBlink 2.5s ease-in-out infinite}

        @keyframes nvLogoRing{0%,100%{opacity:0.2;transform:scale(1)}50%{opacity:0;transform:scale(1.25)}}
        .nv-logo-ring{animation:nvLogoRing 3.5s ease-in-out infinite}

        .nv-btn:not(:disabled):hover .nv-btn-glow{animation:nvBtnGlow 2s ease-in-out infinite}
        @keyframes nvBtnGlow{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.25)}50%{box-shadow:0 0 0 6px rgba(16,185,129,0)}}
        .nv-btn:active:not(:disabled){transform:scale(0.97)}

        @keyframes nvOrbital{to{transform:rotate(360deg)}}
        .nv-orbital{animation:nvOrbital 0.9s linear infinite}

        @keyframes nvShake{0%,100%{transform:translateX(0)}15%,45%,75%{transform:translateX(-3px)}30%,60%,90%{transform:translateX(3px)}}
        .nv-shake{animation:nvShake 0.5s ease-in-out}

        .nv-glitch::after{content:'';position:absolute;inset:-1px;border-radius:1.75rem;pointer-events:none;animation:nvGlitchBorder 0.3s linear 1}
        @keyframes nvGlitchBorder{
          0%,100%{border:1px solid transparent;clip-path:inset(0)}
          20%{border:1px solid rgba(239,68,68,0.4);clip-path:inset(8% 0 75% 0)}
          40%{border:1px solid rgba(59,130,246,0.3);clip-path:inset(55% 0 10% 0)}
          60%{border:1px solid rgba(239,68,68,0.3);clip-path:inset(25% 0 40% 0)}
          80%{border:1px solid transparent;clip-path:inset(0)}
        }

        @keyframes nvScanLine{0%{top:-3%;opacity:0}8%{opacity:1}92%{opacity:1}100%{top:103%;opacity:0}}
        .nv-scanline{animation:nvScanLine 1.6s ease-in-out 1 forwards}

        @keyframes nvScanFlash{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
        .nv-scanflash{animation:nvScanFlash 2s ease-out 1}

        @keyframes nvReticle{0%{transform:scale(0.4);opacity:0}40%{transform:scale(1);opacity:1}100%{transform:scale(1.15);opacity:0}}
        .nv-reticle{animation:nvReticle 2s ease-out 1}

        @keyframes nvPulseDot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.8);opacity:0.2}}
        .nv-pulse-dot{animation:nvPulseDot 1.2s ease-in-out infinite}

        @keyframes nvGranted{0%{opacity:0;letter-spacing:0.8em}40%{opacity:1;letter-spacing:0.5em}100%{opacity:0;letter-spacing:0.4em}}
        .nv-granted{animation:nvGranted 2.4s ease-out 1}
      `}</style>
    </div>
  );
};

export default Login;
