import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import Logo from './Logo';
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
  const [isPasskeySupported, setIsPasskeySupported] = useState(false);

  useEffect(() => {
    if (window.PublicKeyCredential) {
      setIsPasskeySupported(true);
    }

    if (forcePasswordUpdate ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('type=invite') ||
      window.location.hash.includes('type=signup') ||
      (window.location.hash.includes('error=access_denied&error_code=403') === false && window.location.hash.includes('access_token='))) {
      if (forcePasswordUpdate || window.location.hash.includes('type=')) {
        setAuthMode('update-password');
      }
    }

    // Premium theme injection
    document.body.classList.add('premium-auth-flow');
    return () => document.body.classList.remove('premium-auth-flow');
  }, [forcePasswordUpdate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;

      if (username) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ username })
            .eq('id', user.id);

          if (profileError) {
            setError(`Password set, but username failed: ${profileError.message}`);
            setLoading(false);
            return;
          }
        }
      }

      alert('Account setup complete! Please log in with your new credentials.');
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      await supabase.auth.signOut();
      if (onPasswordSet) onPasswordSet();
      setAuthMode('signin');
      setPassword('');
      setUsername('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        alert('Password reset link sent!');
        setAuthMode('signin');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      alert('Biometric login initialized... (Production only)');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#f8fafc] dark:bg-[#0f172a] overflow-hidden relative">
      {/* Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-medical-500/10 dark:bg-medical-500/5 blur-[120px] rounded-full animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/10 dark:bg-teal-500/5 blur-[120px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-lg animate-fade-in-up">
        <div className="mb-12 text-center">
          <div className="inline-block p-4 rounded-[2.5rem] bg-white dark:bg-slate-900 luxury-shadow mb-6 transform hover:scale-105 transition-transform duration-500">
            <Logo className="w-20 h-20" />
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3 leading-none">
            Axis<span className="text-medical-600">Inventory</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-[0.2em] text-[10px]">
            {t('login_subtitle')}
          </p>
        </div>

        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-10 rounded-[3rem] border border-white/50 dark:border-slate-800 luxury-shadow relative overflow-hidden group">
          {/* Glossy overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none"></div>

          {error && (
            <div className="mb-8 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-extrabold flex items-center gap-3 animate-shake">
              <i className="fa-solid fa-triangle-exclamation"></i>
              {error}
            </div>
          )}

          {success && (
            <div className="mb-8 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-sm font-extrabold flex items-center gap-3">
              <i className="fa-solid fa-circle-check"></i>
              {success}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-6 relative z-10">
            {authMode !== 'update-password' && (
              <div className="space-y-2 group">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">{t('lbl_email')}</label>
                <div className="relative">
                  <i className="fa-solid fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-medical-500 transition-colors"></i>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@healthaxis.com"
                    className="w-full h-14 pl-12 pr-6 rounded-2xl border-none bg-slate-100/50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-extrabold placeholder:text-slate-400 focus:ring-4 ring-medical-500/10 transition-all outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 group">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">{authMode === 'update-password' ? t('lbl_new_password') : t('lbl_password')}</label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-medical-500 transition-colors"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-14 pl-12 pr-12 rounded-2xl border-none bg-slate-100/50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-extrabold placeholder:text-slate-400 focus:ring-4 ring-medical-500/10 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-medical-600 transition-colors"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-gradient-to-r from-medical-600 to-teal-600 text-white font-extrabold rounded-2xl shadow-2xl shadow-medical-500/25 hover:shadow-medical-500/40 hover:scale-[1.02] active:scale-95 transition-all text-lg flex items-center justify-center gap-3 mt-4 disabled:opacity-75 tracking-tight"
            >
              {loading ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xl"></i>
              ) : (
                <>
                  <span>{authMode === 'signin' ? t('btn_login') : t('btn_save_password')}</span>
                  <i className="fa-solid fa-arrow-right text-sm"></i>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-12 text-center text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.3em]">
          &copy; {new Date().getFullYear()} HealthAxis Global • Precision Operations
        </div>
      </div>
    </div>
  );
};

export default Login;
