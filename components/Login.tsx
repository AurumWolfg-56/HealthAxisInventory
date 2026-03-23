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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

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
    <div className="min-h-screen w-full flex relative overflow-hidden" style={{ background: '#06080f' }}>

      {/* ─── Animated background mesh ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)', animation: 'float 15s ease-in-out infinite' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, transparent 70%)', animation: 'float 18s ease-in-out infinite reverse' }} />
        <div className="absolute top-[40%] right-[20%] w-[400px] h-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.3) 0%, transparent 70%)', animation: 'float 12s ease-in-out infinite 3s' }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      {/* ─── Left panel: Branding ─── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative z-10 flex-col justify-between p-12 xl:p-16">
        {/* Logo mark */}
        <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <img src="/logo.png" alt="" className="w-8 h-8 object-contain brightness-0 invert" />
            </div>
            <span className="text-white/40 text-xs font-bold tracking-[0.2em] uppercase">Norvexis Core</span>
          </div>
        </div>

        {/* Main hero text */}
        <div className={`transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.1] tracking-tight">
            Clinical
            <br />
            Operations
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400">
              Reimagined.
            </span>
          </h1>
          <p className="mt-6 text-white/30 text-sm leading-relaxed max-w-sm font-medium">
            A unified platform for healthcare organizations. Manage inventory, billing, protocols, and analytics — all from one intelligent command center.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-8">
            {[
              { icon: 'fa-boxes-stacked', text: 'Inventory' },
              { icon: 'fa-file-invoice-dollar', text: 'Billing' },
              { icon: 'fa-chart-mixed', text: 'Analytics' },
              { icon: 'fa-shield-check', text: 'Secure' },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/30 text-[10px] font-bold uppercase tracking-wider">
                <i className={`fa-solid ${f.icon} text-violet-400/60`}></i>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={`transition-all duration-1000 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-white/15 text-[10px] font-bold tracking-[0.3em] uppercase">
            &copy; {new Date().getFullYear()} Norvexis Core
          </p>
        </div>
      </div>

      {/* ─── Right panel: Login form ─── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16 relative z-10">
        <div className={`w-full max-w-md transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

          {/* Mobile logo (hidden on desktop) */}
          <div className="lg:hidden mb-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-2xl shadow-violet-500/30 mb-5">
              <img src="/logo.png" alt="" className="w-10 h-10 object-contain brightness-0 invert" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Norvexis <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">Core</span>
            </h1>
            <p className="text-white/25 text-[10px] font-bold tracking-[0.25em] uppercase mt-2">Clinical Operations Platform</p>
          </div>

          {/* Glass card */}
          <div className="relative">
            {/* Card glow */}
            <div className="absolute -inset-1 bg-gradient-to-b from-violet-500/20 via-transparent to-blue-500/10 rounded-[2.5rem] blur-xl opacity-60"></div>

            <div className="relative bg-white/[0.04] backdrop-blur-2xl rounded-[2.5rem] border border-white/[0.08] p-8 sm:p-10 shadow-2xl">

              {/* Form header */}
              <div className="mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight">
                  {authMode === 'signin' && 'Welcome back'}
                  {authMode === 'forgot' && 'Reset Password'}
                  {authMode === 'update-password' && 'Set New Password'}
                  {authMode === 'signup' && 'Create Account'}
                </h2>
                <p className="text-white/30 text-sm mt-1.5 font-medium">
                  {authMode === 'signin' && 'Sign in to your workspace'}
                  {authMode === 'forgot' && 'We\'ll send you a recovery link'}
                  {authMode === 'update-password' && 'Choose a secure password'}
                  {authMode === 'signup' && 'Get started with Norvexis Core'}
                </p>
              </div>

              {/* Error toast */}
              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-center gap-3 animate-shake">
                  <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                  </div>
                  <span>{error}</span>
                </div>
              )}

              {/* Success toast */}
              {success && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-circle-check text-xs"></i>
                  </div>
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-5">

                {/* Email field */}
                {authMode !== 'update-password' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.15em] ml-1">
                      {t('lbl_email')}
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center transition-colors group-focus-within:bg-violet-500/20">
                        <i className="fa-solid fa-envelope text-white/20 text-xs group-focus-within:text-violet-400 transition-colors"></i>
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@clinic.com"
                        autoComplete="email"
                        className="w-full h-14 pl-14 pr-5 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white font-semibold placeholder:text-white/15 focus:border-violet-500/40 focus:bg-white/[0.06] focus:ring-4 ring-violet-500/10 transition-all outline-none text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Password field */}
                {authMode !== 'forgot' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.15em] ml-1">
                      {authMode === 'update-password' ? t('lbl_new_password') : t('lbl_password')}
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center transition-colors group-focus-within:bg-violet-500/20">
                        <i className="fa-solid fa-lock text-white/20 text-xs group-focus-within:text-violet-400 transition-colors"></i>
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete={authMode === 'update-password' ? 'new-password' : 'current-password'}
                        className="w-full h-14 pl-14 pr-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white font-semibold placeholder:text-white/15 focus:border-violet-500/40 focus:bg-white/[0.06] focus:ring-4 ring-violet-500/10 transition-all outline-none text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-all"
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                      </button>
                    </div>
                  </div>
                )}

                {/* Forgot password link */}
                {authMode === 'signin' && (
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('forgot'); setError(null); setSuccess(null); }}
                      className="text-[11px] font-bold text-violet-400/60 hover:text-violet-400 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 relative group overflow-hidden rounded-2xl font-black text-sm tracking-wide text-white transition-all disabled:opacity-50 mt-2"
                >
                  {/* Button gradient bg */}
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-blue-600 to-violet-600 bg-[length:200%_100%] group-hover:bg-[position:100%_0] transition-all duration-500"></div>
                  {/* Button shine */}
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {/* Button shadow */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-blue-600 rounded-2xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity -z-10"></div>

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
                        <i className={`fa-solid ${authMode === 'forgot' ? 'fa-paper-plane' : 'fa-arrow-right'} text-xs transition-transform group-hover:translate-x-1`}></i>
                      </>
                    )}
                  </span>
                </button>

                {/* Back to Sign In */}
                {(authMode === 'forgot' || authMode === 'update-password') && (
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signin'); setError(null); setSuccess(null); }}
                    className="w-full text-center text-sm font-semibold text-white/25 hover:text-white/50 transition-colors flex items-center justify-center gap-2 py-2"
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

      {/* ─── Keyframe animations ─── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>
    </div>
  );
};

export default Login;
