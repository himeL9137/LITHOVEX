// ============================================================
// LoginScreen — Blurred wallpaper + centered login card
// ============================================================

import { useState, useCallback, memo } from 'react';
import { LogOut, Moon, Power, User } from 'lucide-react';
import { useOS } from '@linux/hooks/useOSStore';

const VALID_USERNAME = 'user';
const VALID_PASSWORD = 'user';

const LoginScreen = memo(function LoginScreen() {
  const { dispatch } = useOS();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleUnlock = useCallback(() => {
    if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
      setError(true);
      setErrorMsg('Incorrect username or password.');
      return;
    }
    setIsUnlocking(true);
    setError(false);
    setErrorMsg('');
    setTimeout(() => {
      dispatch({ type: 'LOGIN', isGuest: false });
    }, 800);
  }, [dispatch, username, password]);

  const handleGuest = useCallback(() => {
    dispatch({ type: 'LOGIN', isGuest: true });
  }, [dispatch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleUnlock();
    },
    [handleUnlock]
  );

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{
        backgroundImage: 'url(/wallpaper-default.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Blur overlay */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          background: 'rgba(0,0,0,0.65)',
        }}
      />

      {/* Login card */}
      <div
        className="relative z-10 w-[360px] rounded-[20px] p-10 flex flex-col items-center"
        style={{
          background: 'rgba(8,8,8,0.92)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)',
          animation: 'loginEnter 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center border-[2px] border-white/20 mb-4"
          style={{ background: 'linear-gradient(135deg, #1a1a1a, #000000)' }}
        >
          <User size={36} className="text-white/70" />
        </div>

        <h2 className="text-xl font-semibold text-white/90 mb-1">Sign In</h2>
        <p className="text-xs text-white/40 mb-6">LITHOVEX OS</p>

        {/* Username input */}
        <div className="w-full mb-3">
          <input
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(false); setErrorMsg(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Username"
            className="w-full h-11 rounded-full px-5 text-sm text-[#E0E0E0] outline-none transition-all"
            style={{
              background: '#050505',
              border: `1px solid ${error ? '#F44336' : 'rgba(255,255,255,0.1)'}`,
            }}
            onFocus={(e) => {
              if (!error) e.currentTarget.style.borderColor = '#ffffff';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.08)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error ? '#F44336' : 'rgba(255,255,255,0.1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Password input */}
        <div className="w-full">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); setErrorMsg(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Password"
            className="w-full h-11 rounded-full px-5 text-sm text-[#E0E0E0] outline-none transition-all"
            style={{
              background: '#050505',
              border: `1px solid ${error ? '#F44336' : 'rgba(255,255,255,0.1)'}`,
            }}
            onFocus={(e) => {
              if (!error) e.currentTarget.style.borderColor = '#ffffff';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.08)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error ? '#F44336' : 'rgba(255,255,255,0.1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-[#F44336] mt-2 text-center">{errorMsg}</p>
        )}

        {/* Sign In button */}
        <button
          onClick={handleUnlock}
          disabled={isUnlocking}
          className="w-full h-11 rounded-full mt-5 text-sm font-semibold transition-colors"
          style={{
            background: isUnlocking ? '#333333' : '#ffffff',
            color: isUnlocking ? '#aaaaaa' : '#000000',
            transform: 'scale(1)',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => { if (!isUnlocking) e.currentTarget.style.background = '#dddddd'; }}
          onMouseLeave={(e) => { if (!isUnlocking) e.currentTarget.style.background = '#ffffff'; }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {isUnlocking ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
              <span>Signing in...</span>
            </div>
          ) : (
            'Sign In'
          )}
        </button>

        {/* Guest login */}
        <button
          onClick={handleGuest}
          className="mt-3 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Continue as Guest
        </button>

        {/* Power options */}
        <div className="flex items-center gap-4 mt-6 pt-4 w-full justify-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all">
            <Power size={16} />
          </button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all">
            <Moon size={16} />
          </button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes loginEnter {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
});

export default LoginScreen;
