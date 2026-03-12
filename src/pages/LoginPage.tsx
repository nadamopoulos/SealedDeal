import { useState, type FormEvent } from 'react';
import { useDealStore } from '../store/dealStore';
import { Lock } from 'lucide-react';
import SealedDealLogo from '../components/SealedDealLogo';

export default function LoginPage() {
  const { login } = useDealStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ok = login(password);
    if (!ok) {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <SealedDealLogo className="h-10 w-auto mb-3" />
          <p className="text-xs text-[#a1a1a1] font-medium tracking-wider uppercase">
            PE Due Diligence Platform
          </p>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleSubmit}
          className={`bg-white border border-[#eaeaea] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
            shake ? 'animate-shake' : ''
          }`}
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-[#0f477b]/8 flex items-center justify-center">
              <Lock className="w-4 h-4 text-[#0f477b]" />
            </div>
            <h2 className="text-sm font-semibold text-[#171717]">Enter password to continue</h2>
          </div>

          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            placeholder="Password"
            autoFocus
            className={`w-full px-3 py-2.5 text-sm rounded-lg border bg-white outline-none transition-colors ${
              error
                ? 'border-[#e5484d] focus:ring-2 focus:ring-[#e5484d]/20'
                : 'border-[#eaeaea] focus:ring-2 focus:ring-[#0f477b]/20 focus:border-[#0f477b]'
            }`}
          />

          {error && (
            <p className="text-xs text-[#e5484d] mt-2">Incorrect password</p>
          )}

          <button
            type="submit"
            className="w-full mt-4 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#0f477b] hover:bg-[#1a5c9e] text-white transition-colors"
          >
            Enter
          </button>
        </form>

        <p className="text-center text-[10px] text-[#a1a1a1] mt-6">
          Authorized access only
        </p>
      </div>
    </div>
  );
}
