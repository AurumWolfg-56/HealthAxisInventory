import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { supabase } from '../src/lib/supabase';

interface LoginProps {
  onLogin: (user: any) => void;
  onPasswordSet?: () => void;
  t: (key: string) => string;
  forcePasswordUpdate?: boolean;
}

/* ═══════════════════════════════════════════
   SACRED GEOMETRY CONSTELLATION
   ═══════════════════════════════════════════ */
const nodes = [
  { label: 'Inventory', icon: '\uf468', angle: 270 },     // fa-boxes-stacked (top)
  { label: 'Analytics', icon: '\uf201', angle: 330 },     // fa-chart-line (top-right)
  { label: 'Billing', icon: '\uf571', angle: 30 },        // fa-file-invoice-dollar (bottom-right)  
  { label: 'Daily Ops', icon: '\uf073', angle: 90 },      // fa-calendar-check (bottom)
  { label: 'Protocols', icon: '\uf46d', angle: 150 },     // fa-clipboard-list (bottom-left)
  { label: 'Quality', icon: '\uf3ed', angle: 210 },       // fa-shield-halved (top-left)
];

const Constellation: React.FC = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 400); return () => clearTimeout(t); }, []);

  const cx = 300, cy = 300, R = 200, r2 = 120;

  // Outer ring points
  const outer = nodes.map((n, i) => {
    const a = (n.angle * Math.PI) / 180;
    return { ...n, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), i };
  });

  // Inner ring (rotated 30°)
  const inner = nodes.map((n, i) => {
    const a = ((n.angle + 30) * Math.PI) / 180;
    return { x: cx + r2 * Math.cos(a), y: cy + r2 * Math.sin(a) };
  });

  // Build connection lines: center→outer, center→inner, outer→adjacent outer, inner→adjacent inner, outer→inner
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; delay: number }> = [];
  let d = 0;

  // Center to outer
  outer.forEach(p => { lines.push({ x1: cx, y1: cy, x2: p.x, y2: p.y, delay: d }); d += 0.06; });
  // Center to inner
  inner.forEach(p => { lines.push({ x1: cx, y1: cy, x2: p.x, y2: p.y, delay: d }); d += 0.04; });
  // Outer hexagon edges
  outer.forEach((p, i) => { const n = outer[(i + 1) % 6]; lines.push({ x1: p.x, y1: p.y, x2: n.x, y2: n.y, delay: d }); d += 0.04; });
  // Inner hexagon edges
  inner.forEach((p, i) => { const n = inner[(i + 1) % 6]; lines.push({ x1: p.x, y1: p.y, x2: n.x, y2: n.y, delay: d }); d += 0.03; });
  // Outer to nearest inner
  outer.forEach((p, i) => { lines.push({ x1: p.x, y1: p.y, x2: inner[i].x, y2: inner[i].y, delay: d }); d += 0.03; });
  outer.forEach((p, i) => { const ni = (i + 5) % 6; lines.push({ x1: p.x, y1: p.y, x2: inner[ni].x, y2: inner[ni].y, delay: d }); d += 0.02; });

  return (
    <div className={`nv-constellation ${visible ? 'is-vis' : ''}`}>
      <svg viewBox="0 0 600 600" className="nv-geo-svg">
        <defs>
          <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(16,185,129,0)" />
            <stop offset="40%" stopColor="rgba(16,185,129,0)" />
            <stop offset="50%" stopColor="rgba(16,185,129,0.7)" />
            <stop offset="60%" stopColor="rgba(16,185,129,0)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0)" />
          </linearGradient>
          <radialGradient id="cg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(16,185,129,0.15)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Ambient center glow */}
        <circle cx={cx} cy={cy} r="150" fill="url(#cg)" className="nv-center-glow" />

        {/* Connection lines */}
        {lines.map((l, i) => (
          <g key={i}>
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              className="nv-geo-line" style={{ animationDelay: `${0.5 + l.delay}s` }} />
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              className="nv-geo-flow" style={{ animationDelay: `${2 + i * 0.15}s` }} />
          </g>
        ))}

        {/* Inner ring dots */}
        {inner.map((p, i) => (
          <circle key={`in-${i}`} cx={p.x} cy={p.y} r="4"
            className="nv-inner-dot" style={{ animationDelay: `${1.2 + i * 0.08}s` }} />
        ))}

        {/* Outer ring: icon circles + labels */}
        {outer.map((p, i) => {
          const labelAbove = p.y < cy - 20;
          const labelBelow = p.y > cy + 20;
          const labelY = labelAbove ? p.y - 40 : labelBelow ? p.y + 46 : p.y;
          const textAnchor = p.x < cx - 40 ? 'end' : p.x > cx + 40 ? 'start' : 'middle';
          const labelX = p.x < cx - 40 ? p.x - 6 : p.x > cx + 40 ? p.x + 6 : p.x;

          return (
            <g key={i} className="nv-node" style={{ animationDelay: `${0.8 + i * 0.12}s` }}>
              {/* Pulse ring */}
              <circle cx={p.x} cy={p.y} r="28" className="nv-pulse-ring"
                style={{ animationDelay: `${2 + i * 0.5}s` }} />
              {/* Node bg */}
              <circle cx={p.x} cy={p.y} r="28" className="nv-node-bg" />
              <circle cx={p.x} cy={p.y} r="28" className="nv-node-border" />
              {/* Icon */}
              <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="central"
                className="nv-node-icon">{p.icon}</text>
              {/* Label */}
              <text x={labelX} y={labelY} textAnchor={textAnchor}
                className="nv-node-label" style={{ animationDelay: `${1.2 + i * 0.12}s` }}>
                {p.label}
              </text>
            </g>
          );
        })}

        {/* Center node — logo placeholder */}
        <circle cx={cx} cy={cy} r="36" className="nv-center-ring" />
        <circle cx={cx} cy={cy} r="6" className="nv-center-dot" />
      </svg>

      {/* Real logo overlaid at center */}
      <img src="/logo.png" alt="" className="nv-geo-logo" />
      {/* Slow rotating outer ring */}
      <div className="nv-orbit-ring" />
    </div>
  );
};

/* ═══════════════════════════════════════════
   LOGIN COMPONENT
   ═══════════════════════════════════════════ */
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

  const cfg: Record<string, { t: string; s: string }> = {
    'signin': { t: 'Welcome back', s: 'Sign in to continue to your workspace' },
    'forgot': { t: 'Reset password', s: 'Enter your email and we\'ll send a recovery link' },
    'update-password': { t: 'Set new password', s: 'Choose a strong password for your account' },
    'signup': { t: 'Create account', s: 'Get started with Norvexis Core' },
  };

  return (
    <div className="nv-root">
      <div className="nv-bg" />
      <div className="nv-glow-a" />
      <div className="nv-glow-b" />

      {/* Success */}
      {phase === 'success' && (
        <div className="nv-suc-ov">
          <div className="nv-suc-chk">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" className="nv-chk-p" />
            </svg>
          </div>
          <p className="nv-suc-txt">Signing you in…</p>
        </div>
      )}

      <div className="nv-split">
        {/* ── LEFT: HERO ── */}
        <div className={`nv-hero ${ready ? 'is-in' : ''}`}>
          <div className="nv-hero-inner">
            {/* Brand top-left */}
            <div className="nv-hero-top">
              <img src="/logo.png" alt="" className="nv-htl" />
              <div>
                <div className="nv-hn">Norvexis <span>Core</span></div>
                <div className="nv-hs">Clinical Operations Platform</div>
              </div>
            </div>

            {/* Constellation center */}
            <div className="nv-hero-mid">
              <Constellation />
            </div>

            {/* Bottom trust */}
            <div className="nv-hero-bot">
              <div className="nv-trust"><span className="nv-tdot" /><span>Trusted by healthcare teams across multiple locations</span></div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: LOGIN ── */}
        <div className={`nv-form-side ${ready ? 'is-in' : ''}`}>
          <div className="nv-fc">
            <div className="nv-mb">
              <img src="/logo.png" alt="Norvexis Core" className="nv-ml" />
              <h1 className="nv-mn">Norvexis <span>Core</span></h1>
            </div>

            <div className={`nv-card ${phase === 'error' ? 'nv-shake' : ''}`}>
              <div className="nv-ci">
                <div className="nv-hdr">
                  <h2>{cfg[authMode].t}</h2>
                  <p>{cfg[authMode].s}</p>
                </div>
                {error && <div className="nv-al nv-al-e"><i className="fa-solid fa-circle-exclamation"></i><span>{error}</span></div>}
                {success && phase !== 'success' && <div className="nv-al nv-al-s"><i className="fa-solid fa-circle-check"></i><span>{success}</span></div>}

                <form onSubmit={handleSubmit}>
                  {authMode !== 'update-password' && (
                    <div className="nv-f">
                      <label>{t('lbl_email')}</label>
                      <div className="nv-iw">
                        <i className="fa-solid fa-envelope nv-ic"></i>
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="you@company.com" autoComplete="email" />
                      </div>
                    </div>
                  )}
                  {authMode !== 'forgot' && (
                    <div className="nv-f">
                      <label>{authMode === 'update-password' ? t('lbl_new_password') : t('lbl_password')}</label>
                      <div className="nv-iw">
                        <i className="fa-solid fa-lock nv-ic"></i>
                        <input type={showPassword ? 'text' : 'password'} required value={password}
                          onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                          autoComplete={authMode === 'update-password' ? 'new-password' : 'current-password'} />
                        <button type="button" className="nv-ey" onClick={() => setShowPassword(!showPassword)}>
                          <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>
                  )}
                  {authMode === 'signin' && (
                    <div className="nv-fr"><button type="button" className="nv-lk"
                      onClick={() => { setAuthMode('forgot'); setError(null); setSuccess(null); setPhase('idle'); }}>Forgot password?</button></div>
                  )}
                  <button type="submit" disabled={loading} className={`nv-bt ${phase === 'loading' ? 'is-ld' : ''}`}>
                    {phase === 'loading' ? <div className="nv-sp" /> : (
                      <>
                        {authMode === 'signin' ? t('btn_login') : authMode === 'forgot' ? 'Send link' : authMode === 'signup' ? 'Create account' : t('btn_save_password')}
                        <i className={`fa-solid ${authMode === 'forgot' ? 'fa-paper-plane' : 'fa-arrow-right'} nv-ar`}></i>
                      </>
                    )}
                  </button>
                  {(authMode === 'forgot' || authMode === 'update-password') && (
                    <button type="button" className="nv-bk" onClick={() => { setAuthMode('signin'); setError(null); setSuccess(null); setPhase('idle'); }}>
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
        .nv-glow-a{position:absolute;width:500px;height:500px;top:-10%;left:8%;background:radial-gradient(circle,rgba(16,185,129,0.05) 0%,transparent 55%);pointer-events:none;filter:blur(40px)}
        .nv-glow-b{position:absolute;width:400px;height:400px;bottom:0;right:30%;background:rgba(16,185,129,0.02);border-radius:50%;pointer-events:none;filter:blur(60px)}

        .nv-split{position:relative;z-index:1;min-height:100vh;display:flex}

        /* ── HERO ── */
        .nv-hero{display:none;flex:1.2;position:relative;border-right:1px solid rgba(255,255,255,0.04);opacity:0;transform:translateX(-20px);transition:all .9s cubic-bezier(.16,1,.3,1)}
        .nv-hero.is-in{opacity:1;transform:translateX(0)}
        @media(min-width:1024px){.nv-hero{display:flex;align-items:center;justify-content:center}}

        .nv-hero-inner{width:100%;max-width:580px;margin:0 auto;padding:40px 48px;display:flex;flex-direction:column;justify-content:space-between;min-height:100vh}

        .nv-hero-top{display:flex;align-items:center;gap:12px}
        .nv-htl{width:40px;height:40px;border-radius:12px;object-fit:cover}
        .nv-hn{font-size:16px;font-weight:800;color:#fff;letter-spacing:-.02em}
        .nv-hn span{color:#10b981}
        .nv-hs{font-size:10px;font-weight:500;color:rgba(255,255,255,.2);margin-top:1px}

        .nv-hero-mid{flex:1;display:flex;align-items:center;justify-content:center;padding:8px 0}

        .nv-hero-bot{text-align:center;padding-bottom:8px}
        .nv-trust{display:flex;align-items:center;justify-content:center;gap:8px}
        .nv-tdot{width:6px;height:6px;border-radius:50%;background:#10b981;flex-shrink:0;animation:nvBlink 2.5s ease-in-out infinite}
        @keyframes nvBlink{0%,100%{opacity:1}50%{opacity:.3}}
        .nv-trust span:last-child{font-size:11px;font-weight:500;color:rgba(255,255,255,.15)}

        /* ── CONSTELLATION ── */
        .nv-constellation{position:relative;width:100%;max-width:500px;aspect-ratio:1;opacity:0;transform:scale(.85);transition:all 1.2s cubic-bezier(.16,1,.3,1) .3s}
        .nv-constellation.is-vis{opacity:1;transform:scale(1)}
        .nv-geo-svg{width:100%;height:100%;animation:nvBreathe 8s ease-in-out infinite}
        @keyframes nvBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}

        .nv-center-glow{animation:nvCGlow 4s ease-in-out infinite}
        @keyframes nvCGlow{0%,100%{opacity:.6}50%{opacity:1}}

        .nv-geo-line{stroke:rgba(16,185,129,.12);stroke-width:1;stroke-dasharray:200;stroke-dashoffset:200;animation:nvLineDraw 1.2s ease forwards}
        @keyframes nvLineDraw{to{stroke-dashoffset:0}}

        .nv-geo-flow{stroke:url(#flowGrad);stroke-width:2;stroke-dasharray:30 200;stroke-dashoffset:230;opacity:0;animation:nvFlow 4s linear infinite}
        @keyframes nvFlow{0%{stroke-dashoffset:230;opacity:0}10%{opacity:1}90%{opacity:1}100%{stroke-dashoffset:0;opacity:0}}

        .nv-inner-dot{fill:rgba(16,185,129,.4);opacity:0;animation:nvDotIn .4s ease forwards}
        @keyframes nvDotIn{to{opacity:1}}

        .nv-node{opacity:0;animation:nvNodeIn .6s ease forwards}
        @keyframes nvNodeIn{to{opacity:1}}

        .nv-node-bg{fill:rgba(10,14,20,.9)}
        .nv-node-border{fill:none;stroke:rgba(16,185,129,.25);stroke-width:1.5}
        .nv-node-icon{font-family:'Font Awesome 6 Free';font-weight:900;font-size:16px;fill:#10b981}
        .nv-node-label{font-family:'Inter',sans-serif;font-size:12px;font-weight:600;fill:rgba(255,255,255,.65);opacity:0;animation:nvLabelIn .5s ease forwards}
        @keyframes nvLabelIn{to{opacity:1}}

        .nv-pulse-ring{fill:none;stroke:rgba(16,185,129,.15);stroke-width:1;opacity:0;animation:nvPulse 3s ease-in-out infinite}
        @keyframes nvPulse{0%{r:28;opacity:.4}100%{r:44;opacity:0}}

        .nv-center-ring{fill:none;stroke:rgba(16,185,129,.2);stroke-width:1.5;stroke-dasharray:4 4;animation:nvCRot 20s linear infinite}
        @keyframes nvCRot{to{stroke-dashoffset:-188.5}}
        .nv-center-dot{fill:#10b981;animation:nvCDot 2.5s ease-in-out infinite}
        @keyframes nvCDot{0%,100%{opacity:1;r:6}50%{opacity:.5;r:4}}

        .nv-geo-logo{position:absolute;top:50%;left:50%;width:60px;height:60px;transform:translate(-50%,-50%);border-radius:16px;object-fit:cover;pointer-events:none}
        .nv-orbit-ring{position:absolute;top:50%;left:50%;width:80px;height:80px;transform:translate(-50%,-50%);border-radius:50%;border:1px solid rgba(16,185,129,.08);pointer-events:none}

        /* ── FORM SIDE ── */
        .nv-form-side{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 28px;opacity:0;transform:translateX(20px);transition:all .9s cubic-bezier(.16,1,.3,1) .15s}
        .nv-form-side.is-in{opacity:1;transform:translateX(0)}
        .nv-fc{width:100%;max-width:400px}

        .nv-mb{display:flex;flex-direction:column;align-items:center;margin-bottom:32px}
        .nv-ml{width:64px;height:64px;border-radius:18px;object-fit:cover;margin-bottom:16px;box-shadow:0 0 0 1px rgba(16,185,129,.1),0 8px 24px rgba(0,0,0,.3)}
        .nv-mn{font-size:22px;font-weight:800;color:#fff;letter-spacing:-.02em}
        .nv-mn span{color:#10b981}
        @media(min-width:1024px){.nv-mb{display:none}}

        .nv-card{width:100%;border-radius:20px;overflow:hidden;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);box-shadow:0 1px 2px rgba(0,0,0,.2),0 16px 40px rgba(0,0,0,.15);transition:border-color .4s}
        .nv-card:hover{border-color:rgba(16,185,129,.12)}
        .nv-ci{padding:32px}
        @media(max-width:480px){.nv-ci{padding:24px}}

        .nv-hdr{margin-bottom:28px}
        .nv-hdr h2{font-size:20px;font-weight:700;color:#fff;margin:0 0 6px;letter-spacing:-.01em}
        .nv-hdr p{font-size:13px;color:rgba(255,255,255,.35);margin:0;line-height:1.5}

        .nv-al{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:12px;margin-bottom:20px;font-size:13px;font-weight:500;line-height:1.45}
        .nv-al i{font-size:13px;margin-top:2px;flex-shrink:0}
        .nv-al-e{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.12);color:#f87171}
        .nv-al-s{background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.12);color:#34d399}

        .nv-f{margin-bottom:20px}
        .nv-f label{display:block;font-size:12px;font-weight:600;color:rgba(255,255,255,.4);margin-bottom:8px}
        .nv-iw{position:relative;display:flex;align-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;transition:all .25s}
        .nv-iw:focus-within{border-color:rgba(16,185,129,.4);box-shadow:0 0 0 3px rgba(16,185,129,.08);background:rgba(16,185,129,.03)}
        .nv-ic{position:absolute;left:14px;font-size:12px;color:rgba(255,255,255,.15);transition:color .25s}
        .nv-iw:focus-within .nv-ic{color:rgba(16,185,129,.6)}
        .nv-iw input{width:100%;height:48px;padding:0 42px 0 40px;background:transparent;border:none;outline:none;color:#fff;font-size:14px;font-weight:500;font-family:inherit}
        .nv-iw input::placeholder{color:rgba(255,255,255,.12)}
        .nv-ey{position:absolute;right:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,.15);cursor:pointer;transition:all .2s}
        .nv-ey:hover{color:rgba(16,185,129,.6);background:rgba(255,255,255,.04)}

        .nv-fr{display:flex;justify-content:flex-end;margin:-8px 0 4px}
        .nv-lk{font-size:12px;font-weight:500;color:rgba(16,185,129,.5);background:none;border:none;cursor:pointer;padding:4px 0;transition:color .2s;font-family:inherit}
        .nv-lk:hover{color:#10b981}

        .nv-bt{width:100%;height:48px;border-radius:12px;border:none;background:#10b981;color:#fff;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .25s;margin-top:8px;box-shadow:0 1px 2px rgba(16,185,129,.2),0 4px 12px rgba(16,185,129,.15)}
        .nv-bt:hover:not(:disabled){background:#059669;box-shadow:0 1px 2px rgba(16,185,129,.3),0 8px 24px rgba(16,185,129,.2);transform:translateY(-1px)}
        .nv-bt:active:not(:disabled){transform:translateY(0) scale(.98)}
        .nv-bt:disabled{opacity:.7;cursor:not-allowed}
        .nv-bt .nv-ar{font-size:11px;transition:transform .2s}
        .nv-bt:hover .nv-ar{transform:translateX(3px)}
        .nv-bt.is-ld{pointer-events:none}
        .nv-sp{width:22px;height:22px;border-radius:50%;border:2.5px solid rgba(255,255,255,.25);border-top-color:#fff;animation:nvSpin .7s linear infinite}

        .nv-bk{width:100%;height:40px;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;border-radius:10px;border:none;background:transparent;color:rgba(255,255,255,.2);font-size:13px;font-weight:500;cursor:pointer;transition:color .2s;font-family:inherit}
        .nv-bk i{font-size:11px}
        .nv-bk:hover{color:rgba(255,255,255,.5)}

        .nv-ft{margin-top:32px;font-size:11px;font-weight:500;color:rgba(255,255,255,.07);text-align:center}

        .nv-suc-ov{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(6,10,16,.92);backdrop-filter:blur(8px);animation:nvFI .4s ease}
        .nv-suc-chk{width:64px;height:64px;border-radius:50%;background:rgba(16,185,129,.1);border:2px solid rgba(16,185,129,.3);display:flex;align-items:center;justify-content:center;color:#10b981;animation:nvSI .5s cubic-bezier(.34,1.56,.64,1)}
        .nv-suc-chk svg{width:28px;height:28px}
        .nv-chk-p{stroke-dasharray:24;stroke-dashoffset:24;animation:nvDC .4s ease .3s forwards}
        .nv-suc-txt{margin-top:20px;font-size:15px;font-weight:600;color:rgba(255,255,255,.5);animation:nvFI .4s ease .4s both}

        @keyframes nvShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}
        .nv-shake{animation:nvShake .4s ease-in-out}
        @keyframes nvSpin{to{transform:rotate(360deg)}}
        @keyframes nvFI{from{opacity:0}to{opacity:1}}
        @keyframes nvSI{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes nvDC{to{stroke-dashoffset:0}}
      `}</style>
    </div>
  );
};

export default Login;
