import { useState } from 'react';
import { useDealStore } from '../store/dealStore';
import { Key, Eye, EyeOff, CheckCircle2, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { apiKey, setApiKey } = useDealStore();
  const [key, setKey] = useState(apiKey);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8 px-4 sm:px-8 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-[#171717] mb-2">Settings</h1>
      <p className="text-sm text-[#666666] mb-8">Configure your SealedDeal workspace</p>

      <div className="bg-white border border-[#eaeaea] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#0f477b]/8 flex items-center justify-center">
            <Key className="w-5 h-5 text-[#0f477b]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#171717]">Anthropic API Key</h2>
            <p className="text-xs text-[#666666]">Required for AI-powered document analysis</p>
          </div>
        </div>

        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2.5 pr-20 bg-white border border-[#d4d4d4] rounded-lg text-sm text-[#171717] placeholder-[#a1a1a1] focus:outline-none focus:ring-2 focus:ring-[#0f477b] focus:border-transparent font-mono"
          />
          <button
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-[#f5f5f5] rounded"
          >
            {show ? (
              <EyeOff className="w-4 h-4 text-[#666666]" />
            ) : (
              <Eye className="w-4 h-4 text-[#666666]" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#0f477b] hover:bg-[#1a5c9e] text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saved ? 'Saved!' : 'Save Key'}
          </button>
          {saved && <CheckCircle2 className="w-4 h-4 text-[#46a758]" />}
        </div>

        <div className="mt-4 p-3 bg-[#f5f5f5] rounded-lg flex items-start gap-2">
          <Shield className="w-4 h-4 text-[#888888] shrink-0 mt-0.5" />
          <p className="text-xs text-[#888888]">
            Your API key is stored locally in your browser and only sent to Anthropic's API for document analysis.
            It never leaves your machine otherwise.
          </p>
        </div>
      </div>
    </div>
  );
}
