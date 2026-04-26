import { useState, useEffect } from 'react';

export default function AuthWrapper({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = localStorage.getItem('app_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    // Use env variable if exists, otherwise default to '25452002'
    const correctPassword = import.meta.env.VITE_APP_PASSWORD || '25452002';
    if (password === correctPassword) {
      localStorage.setItem('app_auth', 'true');
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPassword('');
    }
  };

  if (loading) return null;

  if (isAuthenticated) {
    return children;
  }

  return (
    <div className="fixed inset-0 bg-[#0A1318] flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl" style={{ animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#FD5461] rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-[#FD5461]/30">
            <span className="text-3xl text-white">⚽</span>
          </div>
          <h1 className="font-heading font-black text-2xl uppercase tracking-wider text-[#0A1318]">
            Restricted Access
          </h1>
          <p className="text-gray-400 text-sm mt-2">Please enter password to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              className={`w-full px-5 py-4 rounded-xl border-2 text-center font-heading text-lg tracking-widest focus:outline-none transition-all
                ${error ? 'border-[#FD5461] bg-[#FD5461]/5 text-[#FD5461]' : 'border-gray-100 bg-gray-50 focus:border-[#0A1318] focus:bg-white text-[#0A1318]'}`}
              autoFocus
            />
            {error && (
              <p className="text-[#FD5461] text-[10px] font-heading font-black uppercase tracking-widest text-center mt-2">
                Incorrect Password
              </p>
            )}
          </div>
          
          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-[#0A1318] text-white font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-colors shadow-xl shadow-black/10 cursor-pointer"
          >
            Enter App
          </button>
        </form>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
