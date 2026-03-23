import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { supabase } from '../src/lib/supabase';

interface LoginProps {
  onLogin: (user: any) => void;
  onPasswordSet?: () => void;
  t: (key: string) => string;
  forcePasswordUpdate?: boolean;
}

/* ─── Inline Norvexis "N" hexagon mark ─── */
const NvLogo: React.FC<{ size?: number; className?: string }> = ({ size = 48, className = '' }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
    <defs>
      <linearGradient id="lg-hex" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7c3aed" />
        <stop offset="50%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
    </defs>
    <path d="M32 2L58 17V47L32 62L6 47V17L32 2Z" fill="url(#lg-hex)" />
    <path d="M32 2L58 17V32L32 2Z" fill="rgba(255,255,255,0.12)" />
    <path d="M22 44V20H28L42 38V20H22Z" fill="white" opacity="0.95" />
    <path d="M42 20V44H36L22 26V44H42Z" fill="white" opacity="0.65" />
  </svg>
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

  useEffect(() => {
    // Stagger mount animation
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

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
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
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ username })
            .eq('id', user.id);

          if (profileError) {
            console.warn(`Username update failed: ${profileError.message}`);
          }
        }
      }

      await supabase.auth.signOut();
      alert('Contraseña guardada exitosamente. Por favor, inicia sesión con tu nueva contraseña.');

      if (onPasswordSet) onPasswordSet();
      setAuthMode('signin');
      setPassword('');
      setUsername('');
      setEmail('');
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        setError('Conexión interrumpida, pero la contraseña podría haberse guardado. Intenta recargar e iniciar sesión.');
      } else {
        setError(err.message);
      }
    } finally {
      if (document.body) {
        setLoading(false);
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'update-password') {
      return handleUpdatePassword(e);
    }
    setLoading(true);
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
          setSuccess(t('msg_login_success'));
          setTimeout(() => onLogin(data.user), 500);
        }
      } else if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: email.split('@')[0] }
          }
        });
        if (error) throw error;
        alert('Verification email sent!');
        setAuthMode('signin');
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccess('A recovery link has been sent to your email address.');
        setTimeout(() => {
          setAuthMode('signin');
          setSuccess(null);
        }, 4000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden" style={{ background: '#050810' }}>

      {/* ─── Animated background ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs — slow floating animation */}
        <div className="nv-orb absolute top-[-15%] left-[5%] w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 65%)', animationDuration: '20s' }} />
        <div className="nv-orb absolute bottom-[-15%] right-[0%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 65%)', animationDuration: '25s', animationDirection: 'reverse' }} />
        <div className="nv-orb absolute top-[50%] left-[40%] w-[350px] h-[350px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 65%)', animationDuration: '18s', animationDelay: '5s' }} />

        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
      </div>

      {/* ─── Left panel: Branding ─── */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative z-10 flex-col justify-between p-12 xl:p-16">

        {/* Logo + wordmark */}
        <div className={`flex items-center gap-4 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
          <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-white/[0.06] flex items-center justify-center backdrop-blur-sm">
            <NvLogo size={28} />
          </div>
          <span className="text-white/30 text-[11px] font-bold tracking-[0.2em] uppercase">Norvexis Core</span>
        </div>

        {/* Hero text */}
        <div className={`transition-all duration-1000 delay-200 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h1 className="text-[3.4rem] xl:text-[4rem] font-black text-white leading-[1.05] tracking-[-0.02em]">
            Clinical
            <br />
            Operations
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-300">
              Reimagined.
            </span>
          </h1>
          <p className="mt-7 text-white/40 text-[15px] leading-relaxed max-w-[380px] font-medium">
            A unified platform for healthcare organizations. Manage inventory, billing, protocols, and analytics — all from one intelligent command center.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2.5 mt-9">
            {[
              { icon: 'fa-boxes-stacked', text: 'Inventory' },
              { icon: 'fa-file-invoice-dollar', text: 'Billing' },
              { icon: 'fa-chart-line', text: 'Analytics' },
              { icon: 'fa-shield-halved', text: 'Secure' },
            ].map((f, i) => (
              <div key={f.text}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{
                  transitionDelay: `${600 + i * 100}ms`,
                  background: 'rgba(255,255,255,0.02)',
                  borderColor: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.35)',
                }}>
                <i className={`fa-solid ${f.icon}`} style={{ color: 'rgba(139,92,246,0.6)' }}></i>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={`transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-white/10 text-[10px] font-bold tracking-[0.3em] uppercase">
            &copy; {new Date().getFullYear()} Norvexis Core &middot; v1.0
          </p>
        </div>
      </div>

      {/* ─── Right panel: Login form ─── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16 relative z-10">
        <div className={`w-full max-w-[440px] transition-all duration-1000 delay-300 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}>

          {/* Mobile logo */}
          <div className="lg:hidden mb-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-white/[0.06] mb-5">
              <NvLogo size={40} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Norvexis <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">Core</span>
            </h1>
            <p className="text-white/20 text-[10px] font-bold tracking-[0.25em] uppercase mt-2">Clinical Operations Platform</p>
          </div>

          {/* ─── Glass card ─── */}
          <div className="relative group/card">
            {/* Glow ring — visible and alive */}
            <div className="absolute -inset-[1px] rounded-[2.5rem] opacity-60 transition-opacity duration-500 group-hover/card:opacity-100"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(99,102,241,0.1) 40%, transparent 60%, rgba(59,130,246,0.2))' }} />
            {/* Soft glow behind */}
            <div className="absolute -inset-4 rounded-[3rem] blur-2xl opacity-40 transition-opacity duration-700 group-hover/card:opacity-60"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), transparent 50%, rgba(59,130,246,0.1))' }} />

            <div className="relative rounded-[2.5rem] border border-white/[0.07] p-8 sm:p-10 overflow-hidden"
              style={{ background: 'rgba(15,18,30,0.85)', backdropFilter: 'blur(40px)' }}>

              {/* Inner shine line at top */}
              <div className="absolute top-0 left-8 right-8 h-[1px]"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.08) 70%, transparent)' }} />

              {/* Form header */}
              <div className="mb-8">
                <h2 className="text-[1.65rem] font-black text-white tracking-tight leading-tight">
                  {authMode === 'signin' && 'Welcome back'}
                  {authMode === 'forgot' && 'Reset Password'}
                  {authMode === 'update-password' && 'Set New Password'}
                  {authMode === 'signup' && 'Create Account'}
                </h2>
                <p className="text-white/35 text-sm mt-2 font-medium leading-relaxed">
                  {authMode === 'signin' && 'Sign in to access your workspace'}
                  {authMode === 'forgot' && 'We\'ll send a recovery link to your email'}
                  {authMode === 'update-password' && 'Choose a strong, secure password'}
                  {authMode === 'signup' && 'Get started with Norvexis Core'}
                </p>
              </div>

              {/* ── Error ── */}
              {error && (
                <div className="mb-6 p-4 rounded-2xl border flex items-start gap-3 animate-shake"
                  style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <i className="fa-solid fa-triangle-exclamation text-red-400 text-xs"></i>
                  </div>
                  <span className="text-red-400/90 text-sm font-semibold leading-relaxed">{error}</span>
                </div>
              )}

              {/* ── Success ── */}
              {success && (
                <div className="mb-6 p-4 rounded-2xl border flex items-start gap-3"
                  style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.15)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(16,185,129,0.15)' }}>
                    <i className="fa-solid fa-circle-check text-emerald-400 text-xs"></i>
                  </div>
                  <span className="text-emerald-400/90 text-sm font-semibold leading-relaxed">{success}</span>
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-5">

                {/* ── Email ── */}
                {authMode !== 'update-password' && (
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] ml-1"
                      style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {t('lbl_email')}
                    </label>
                    <div className="relative group/input">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300"
                        style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <i className="fa-solid fa-envelope text-xs transition-colors duration-300"
                          style={{ color: 'rgba(255,255,255,0.15)' }}></i>
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@clinic.com"
                        autoComplete="email"
                        className="nv-input w-full h-[3.5rem] pl-[3.5rem] pr-5 rounded-2xl border text-white font-semibold text-sm outline-none transition-all duration-300"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          borderColor: 'rgba(255,255,255,0.06)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* ── Password ── */}
                {authMode !== 'forgot' && (
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] ml-1"
                      style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {authMode === 'update-password' ? t('lbl_new_password') : t('lbl_password')}
                    </label>
                    <div className="relative group/input">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300"
                        style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <i className="fa-solid fa-lock text-xs transition-colors duration-300"
                          style={{ color: 'rgba(255,255,255,0.15)' }}></i>
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete={authMode === 'update-password' ? 'new-password' : 'current-password'}
                        className="nv-input w-full h-[3.5rem] pl-[3.5rem] pr-14 rounded-2xl border text-white font-semibold text-sm outline-none transition-all duration-300"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          borderColor: 'rgba(255,255,255,0.06)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                        style={{ color: 'rgba(255,255,255,0.2)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                      </button>
                    </div>
                  </div>
                )}

                {/* Forgot password */}
                {authMode === 'signin' && (
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('forgot'); setError(null); setSuccess(null); }}
                      className="text-[11px] font-semibold transition-colors duration-200"
                      style={{ color: 'rgba(139,92,246,0.55)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(139,92,246,0.9)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(139,92,246,0.55)'}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* ── Submit button ── */}
                <button
                  type="submit"
                  disabled={loading}
                  className="nv-btn w-full h-[3.5rem] relative group/btn overflow-hidden rounded-2xl font-black text-sm tracking-wide text-white transition-all duration-300 disabled:opacity-50 mt-3 cursor-pointer"
                >
                  {/* Gradient bg */}
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 transition-all duration-500" />
                  {/* Hover brighten */}
                  <div className="absolute inset-0 bg-white/0 group-hover/btn:bg-white/[0.08] transition-all duration-300" />
                  {/* Top shine line */}
                  <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  {/* Shadow glow */}
                  <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-2xl blur-xl opacity-0 group-hover/btn:opacity-25 transition-opacity duration-500 -z-10" />

                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {loading ? (
                      <i className="fa-solid fa-circle-notch fa-spin text-lg"></i>
                    ) : (
                      <>
                        <span>
                          {authMode === 'signin' ? t('btn_login')
                            : authMode === 'forgot' ? 'Send Recovery Link'
                            : authMode === 'signup' ? 'Create Account'
                              : t('btn_save_password')}
                        </span>
                        <i className={`fa-solid ${authMode === 'forgot' ? 'fa-paper-plane' : 'fa-arrow-right'} text-xs transition-transform duration-300 group-hover/btn:translate-x-1`}></i>
                      </>
                    )}
                  </span>
                </button>

                {/* Back to Sign In */}
                {(authMode === 'forgot' || authMode === 'update-password') && (
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signin'); setError(null); setSuccess(null); }}
                    className="w-full text-center text-sm font-semibold transition-colors flex items-center justify-center gap-2 py-2"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                  >
                    <i className="fa-solid fa-arrow-left text-xs"></i>
                    Back to Sign In
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Mobile footer */}
          <div className="lg:hidden mt-8 text-center">
            <p className="text-white/10 text-[10px] font-bold tracking-[0.3em] uppercase">
              &copy; {new Date().getFullYear()} Norvexis Core
            </p>
          </div>
        </div>
      </div>

      {/* ─── Scoped styles ─── */}
      <style>{`
        @keyframes nvFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(25px, -35px) scale(1.03); }
          66% { transform: translate(-15px, 20px) scale(0.97); }
        }
        .nv-orb { animation: nvFloat 20s ease-in-out infinite; }

        .nv-input::placeholder { color: rgba(255,255,255,0.12); }
        .nv-input:focus {
          border-color: rgba(124,58,237,0.4) !important;
          background: rgba(255,255,255,0.05) !important;
          box-shadow: 0 0 0 4px rgba(124,58,237,0.08);
        }
        .nv-input:focus ~ .group\\/input > div:first-child,
        .nv-input:focus + div { background: rgba(124,58,237,0.15) !important; }

        .nv-btn:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
};

export default Login;
