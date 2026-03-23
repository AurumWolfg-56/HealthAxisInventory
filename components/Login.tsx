import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { supabase } from '../src/lib/supabase';

interface LoginProps {
  onLogin: (user: any) => void;
  onPasswordSet?: () => void;
  t: (key: string) => string;
  forcePasswordUpdate?: boolean;
}

/* ═══ CAPABILITY CARDS ═══ */
const capabilities = [
  { icon: 'fa-cubes', title: 'Inventory Control', desc: 'Real-time stock tracking, automated reorder alerts, and multi-location management' },
  { icon: 'fa-chart-line', title: 'Analytics & Reports', desc: 'Daily close reports, revenue insights, and operational intelligence dashboards' },
  { icon: 'fa-file-invoice-dollar', title: 'Billing & Claims', desc: 'Insurance verification, CPT coding, and streamlined patient billing workflows' },
  { icon: 'fa-shield-halved', title: 'Protocols & Compliance', desc: 'Clinical protocols, digital signatures, and audit-ready documentation' },
];

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
      if (forcePasswordUpdate || window.location.hash.includes('type=')) setAuthMode('update-password');
    }
  }, [forcePasswordUpdate]);

  useEffect(() => {
    if (phase === 'error') { const t = setTimeout(() => setPhase('idle'), 3500); return () => clearTimeout(t); }
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
    } catch (err: any) { fail(err.message); } finally { setLoading(false); }
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
        if (error) throw error; alert('Verification email sent!'); setAuthMode('signin'); setPhase('idle');
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error; setSuccess('Recovery link sent to your email.'); setPhase('idle');
        setTimeout(() => { setAuthMode('signin'); setSuccess(null); }, 4000);
      }
    } catch (err: any) { fail(err.message); } finally { if (phase !== 'success') setLoading(false); }
  };

  const modeConfig: Record<string, { title: string; sub: string }> = {
    'signin': { title: 'Welcome back', sub: 'Sign in to continue to your workspace' },
    'forgot': { title: 'Reset password', sub: 'Enter your email and we\'ll send a recovery link' },
    'update-password': { title: 'Set new password', sub: 'Choose a strong password for your account' },
    'signup': { title: 'Create account', sub: 'Get started with Norvexis Core' },
  };
  const { title, sub } = modeConfig[authMode];

  return (
    <div className="nv-root">
      <div className="nv-bg" />

      {/* Ambient glows */}
      <div className="nv-glow nv-glow-1" />
      <div className="nv-glow nv-glow-2" />

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

      {/* ═══ SPLIT LAYOUT ═══ */}
      <div className="nv-split">

        {/* ══ LEFT: HERO ══ */}
        <div className={`nv-hero ${ready ? 'nv-in' : ''}`}>
          <div className="nv-hero-inner">

            {/* Top: Logo + Brand */}
            <div className="nv-hero-top">
              <img src="/logo.png" alt="" className="nv-hero-logo" />
              <div>
                <div className="nv-hero-name">Norvexis <span>Core</span></div>
                <div className="nv-hero-sub">Clinical Operations Platform</div>
              </div>
            </div>

            {/* Center: Headline + Capabilities */}
            <div className="nv-hero-center">
              <h1 className="nv-headline">
                Streamline your<br />clinical operations
              </h1>
              <p className="nv-subline">
                A unified platform designed for modern healthcare practices.
              </p>

              {/* 2x2 Capability Grid */}
              <div className="nv-cap-grid">
                {capabilities.map((c, i) => (
                  <div key={c.title} className="nv-cap" style={{ animationDelay: `${0.6 + i * 0.12}s` }}>
                    <div className="nv-cap-icon">
                      <i className={`fa-solid ${c.icon}`}></i>
                    </div>
                    <div className="nv-cap-text">
                      <h3>{c.title}</h3>
                      <p>{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom: Subtle trust line */}
            <div className="nv-hero-bottom">
              <div className="nv-trust-line">
                <div className="nv-trust-dot" />
                <span>Trusted by healthcare teams across multiple locations</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ RIGHT: LOGIN ══ */}
        <div className={`nv-form-side ${ready ? 'nv-in' : ''}`}>
          <div className="nv-form-center">

            {/* Mobile-only branding */}
            <div className="nv-m-brand">
              <img src="/logo.png" alt="Norvexis Core" className="nv-m-logo" />
              <h1 className="nv-m-name">Norvexis <span>Core</span></h1>
            </div>

            {/* Card */}
            <div className={`nv-card ${phase === 'error' ? 'nv-shake' : ''}`}>
              <div className="nv-card-in">
                <div className="nv-hdr">
                  <h2>{title}</h2>
                  <p>{sub}</p>
                </div>

                {error && (
                  <div className="nv-alert nv-err">
                    <i className="fa-solid fa-circle-exclamation"></i><span>{error}</span>
                  </div>
                )}
                {success && phase !== 'success' && (
                  <div className="nv-alert nv-ok">
                    <i className="fa-solid fa-circle-check"></i><span>{success}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {authMode !== 'update-password' && (
                    <div className="nv-fld">
                      <label>{t('lbl_email')}</label>
                      <div className="nv-iw">
                        <i className="fa-solid fa-envelope nv-ic"></i>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@company.com" autoComplete="email" />
                      </div>
                    </div>
                  )}
                  {authMode !== 'forgot' && (
                    <div className="nv-fld">
                      <label>{authMode === 'update-password' ? t('lbl_new_password') : t('lbl_password')}</label>
                      <div className="nv-iw">
                        <i className="fa-solid fa-lock nv-ic"></i>
                        <input type={showPassword ? 'text' : 'password'} required value={password}
                          onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password"
                          autoComplete={authMode === 'update-password' ? 'new-password' : 'current-password'} />
                        <button type="button" className="nv-eye" onClick={() => setShowPassword(!showPassword)}>
                          <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>
                  )}
                  {authMode === 'signin' && (
                    <div className="nv-fgt"><button type="button" className="nv-lnk"
                      onClick={() => { setAuthMode('forgot'); setError(null); setSuccess(null); setPhase('idle'); }}>Forgot password?</button></div>
                  )}
                  <button type="submit" disabled={loading} className={`nv-btn ${phase === 'loading' ? 'is-ld' : ''}`}>
                    {phase === 'loading' ? <div className="nv-spin" /> : (
                      <>
                        {authMode === 'signin' ? t('btn_login') : authMode === 'forgot' ? 'Send link' : authMode === 'signup' ? 'Create account' : t('btn_save_password')}
                        <i className={`fa-solid ${authMode === 'forgot' ? 'fa-paper-plane' : 'fa-arrow-right'} nv-arr`}></i>
                      </>
                    )}
                  </button>
                  {(authMode === 'forgot' || authMode === 'update-password') && (
                    <button type="button" className="nv-bk"
                      onClick={() => { setAuthMode('signin'); setError(null); setSuccess(null); setPhase('idle'); }}>
                      <i className="fa-solid fa-arrow-left"></i> Back to sign in
                    </button>
                  )}
                </form>
              </div>
            </div>

            <p className="nv-ft">&copy; {new Date().getFullYear()} Norvexis Core</p>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .nv-root{min-height:100vh;width:100%;position:relative;overflow:hidden;font-family:'Inter',system-ui,sans-serif}
        .nv-bg{position:absolute;inset:0;background:linear-gradient(160deg,#070b11 0%,#0b1017 50%,#060a10 100%)}

        /* Ambient glows */
        .nv-glow{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px)}
        .nv-glow-1{width:500px;height:500px;top:-10%;left:5%;background:rgba(16,185,129,0.04)}
        .nv-glow-2{width:400px;height:400px;bottom:-5%;right:25%;background:rgba(16,185,129,0.03)}

        /* ── SPLIT ── */
        .nv-split{position:relative;z-index:1;min-height:100vh;display:flex}

        /* ── HERO ── */
        .nv-hero{
          display:none;flex:1.15;position:relative;
          border-right:1px solid rgba(255,255,255,0.04);
          opacity:0;transform:translateX(-20px);
          transition:all 0.9s cubic-bezier(0.16,1,0.3,1);
        }
        .nv-hero.nv-in{opacity:1;transform:translateX(0)}
        @media(min-width:1024px){.nv-hero{display:flex}}

        .nv-hero-inner{
          width:100%;max-width:560px;margin:0 auto;padding:48px 56px;
          display:flex;flex-direction:column;justify-content:space-between;min-height:100vh;
        }

        /* Hero top */
        .nv-hero-top{display:flex;align-items:center;gap:14px}
        .nv-hero-logo{width:44px;height:44px;border-radius:13px;object-fit:cover}
        .nv-hero-name{font-size:17px;font-weight:800;color:#fff;letter-spacing:-0.02em}
        .nv-hero-name span{color:#10b981}
        .nv-hero-sub{font-size:11px;font-weight:500;color:rgba(255,255,255,0.2);margin-top:1px}

        /* Hero center */
        .nv-hero-center{flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 0}

        .nv-headline{
          font-size:38px;font-weight:800;color:#fff;line-height:1.15;
          letter-spacing:-0.035em;margin:0 0 14px;
        }
        .nv-subline{
          font-size:16px;color:rgba(255,255,255,0.3);line-height:1.6;margin:0 0 40px;
          max-width:400px;
        }

        /* ── CAPABILITY GRID ── */
        .nv-cap-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}

        .nv-cap{
          display:flex;gap:14px;padding:18px;
          border-radius:16px;
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.04);
          opacity:0;transform:translateY(12px);
          animation:nvCapIn 0.6s ease forwards;
          transition:border-color 0.3s,background 0.3s;
        }
        .nv-cap:hover{border-color:rgba(16,185,129,0.15);background:rgba(16,185,129,0.03)}
        @keyframes nvCapIn{to{opacity:1;transform:translateY(0)}}

        .nv-cap-icon{
          width:40px;height:40px;border-radius:12px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.06));
          border:1px solid rgba(16,185,129,0.1);
        }
        .nv-cap-icon i{font-size:15px;color:#10b981}
        .nv-cap-text h3{font-size:13px;font-weight:700;color:rgba(255,255,255,0.85);margin:0 0 4px}
        .nv-cap-text p{font-size:11px;font-weight:400;color:rgba(255,255,255,0.25);line-height:1.5;margin:0}

        /* Hero bottom */
        .nv-hero-bottom{padding-top:16px}
        .nv-trust-line{display:flex;align-items:center;gap:8px}
        .nv-trust-dot{width:6px;height:6px;border-radius:50%;background:#10b981;animation:nvBlink 2.5s ease-in-out infinite}
        .nv-trust-line span{font-size:11px;font-weight:500;color:rgba(255,255,255,0.15)}
        @keyframes nvBlink{0%,100%{opacity:1}50%{opacity:0.3}}

        /* ── FORM SIDE ── */
        .nv-form-side{
          flex:1;display:flex;align-items:center;justify-content:center;padding:40px 28px;
          opacity:0;transform:translateX(20px);
          transition:all 0.9s cubic-bezier(0.16,1,0.3,1) 0.15s;
        }
        .nv-form-side.nv-in{opacity:1;transform:translateX(0)}
        .nv-form-center{width:100%;max-width:400px}

        /* Mobile brand */
        .nv-m-brand{display:flex;flex-direction:column;align-items:center;margin-bottom:32px}
        .nv-m-logo{width:64px;height:64px;border-radius:18px;object-fit:cover;margin-bottom:16px;box-shadow:0 0 0 1px rgba(16,185,129,0.1),0 8px 24px rgba(0,0,0,0.3)}
        .nv-m-name{font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em}
        .nv-m-name span{color:#10b981}
        @media(min-width:1024px){.nv-m-brand{display:none}}

        /* ── CARD ── */
        .nv-card{width:100%;border-radius:20px;overflow:hidden;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);box-shadow:0 1px 2px rgba(0,0,0,0.2),0 16px 40px rgba(0,0,0,0.15);transition:border-color 0.4s}
        .nv-card:hover{border-color:rgba(16,185,129,0.12)}
        .nv-card-in{padding:32px}
        @media(max-width:480px){.nv-card-in{padding:24px}}

        .nv-hdr{margin-bottom:28px}
        .nv-hdr h2{font-size:20px;font-weight:700;color:#fff;margin:0 0 6px;letter-spacing:-0.01em}
        .nv-hdr p{font-size:13px;color:rgba(255,255,255,0.35);margin:0;line-height:1.5}

        .nv-alert{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:12px;margin-bottom:20px;font-size:13px;font-weight:500;line-height:1.45}
        .nv-alert i{font-size:13px;margin-top:2px;flex-shrink:0}
        .nv-err{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.12);color:#f87171}
        .nv-ok{background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.12);color:#34d399}

        .nv-fld{margin-bottom:20px}
        .nv-fld label{display:block;font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);margin-bottom:8px}
        .nv-iw{position:relative;display:flex;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;transition:all 0.25s}
        .nv-iw:focus-within{border-color:rgba(16,185,129,0.4);box-shadow:0 0 0 3px rgba(16,185,129,0.08);background:rgba(16,185,129,0.03)}
        .nv-ic{position:absolute;left:14px;font-size:12px;color:rgba(255,255,255,0.15);transition:color 0.25s}
        .nv-iw:focus-within .nv-ic{color:rgba(16,185,129,0.6)}
        .nv-iw input{width:100%;height:48px;padding:0 42px 0 40px;background:transparent;border:none;outline:none;color:#fff;font-size:14px;font-weight:500;font-family:inherit}
        .nv-iw input::placeholder{color:rgba(255,255,255,0.12)}
        .nv-eye{position:absolute;right:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,0.15);cursor:pointer;transition:all 0.2s}
        .nv-eye:hover{color:rgba(16,185,129,0.6);background:rgba(255,255,255,0.04)}

        .nv-fgt{display:flex;justify-content:flex-end;margin:-8px 0 4px}
        .nv-lnk{font-size:12px;font-weight:500;color:rgba(16,185,129,0.5);background:none;border:none;cursor:pointer;padding:4px 0;transition:color 0.2s;font-family:inherit}
        .nv-lnk:hover{color:#10b981}

        .nv-btn{width:100%;height:48px;border-radius:12px;border:none;background:#10b981;color:#fff;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.25s;margin-top:8px;box-shadow:0 1px 2px rgba(16,185,129,0.2),0 4px 12px rgba(16,185,129,0.15)}
        .nv-btn:hover:not(:disabled){background:#059669;box-shadow:0 1px 2px rgba(16,185,129,0.3),0 8px 24px rgba(16,185,129,0.2);transform:translateY(-1px)}
        .nv-btn:active:not(:disabled){transform:translateY(0) scale(0.98)}
        .nv-btn:disabled{opacity:0.7;cursor:not-allowed}
        .nv-btn .nv-arr{font-size:11px;transition:transform 0.2s}
        .nv-btn:hover .nv-arr{transform:translateX(3px)}
        .nv-btn.is-ld{pointer-events:none}
        .nv-spin{width:22px;height:22px;border-radius:50%;border:2.5px solid rgba(255,255,255,0.25);border-top-color:#fff;animation:nvSpin 0.7s linear infinite}

        .nv-bk{width:100%;height:40px;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;border-radius:10px;border:none;background:transparent;color:rgba(255,255,255,0.2);font-size:13px;font-weight:500;cursor:pointer;transition:color 0.2s;font-family:inherit}
        .nv-bk i{font-size:11px}
        .nv-bk:hover{color:rgba(255,255,255,0.5)}

        .nv-ft{margin-top:32px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.07);text-align:center}

        /* ── SUCCESS ── */
        .nv-success-overlay{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(6,10,16,0.92);backdrop-filter:blur(8px);animation:nvFI 0.4s ease}
        .nv-success-check{width:64px;height:64px;border-radius:50%;background:rgba(16,185,129,0.1);border:2px solid rgba(16,185,129,0.3);display:flex;align-items:center;justify-content:center;color:#10b981;animation:nvSI 0.5s cubic-bezier(0.34,1.56,0.64,1)}
        .nv-success-check svg{width:28px;height:28px}
        .nv-check-path{stroke-dasharray:24;stroke-dashoffset:24;animation:nvDC 0.4s ease 0.3s forwards}
        .nv-success-text{margin-top:20px;font-size:15px;font-weight:600;color:rgba(255,255,255,0.5);animation:nvFI 0.4s ease 0.4s both}

        @keyframes nvShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}
        .nv-shake{animation:nvShake 0.4s ease-in-out}
        @keyframes nvSpin{to{transform:rotate(360deg)}}
        @keyframes nvFI{from{opacity:0}to{opacity:1}}
        @keyframes nvSI{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes nvDC{to{stroke-dashoffset:0}}
      `}</style>
    </div>
  );
};

export default Login;
