import { useDealStore } from '../store/dealStore';
import { Shield, LogOut, Info } from 'lucide-react';

export default function SettingsPage() {
  const { logout, deals } = useDealStore();

  return (
    <div className="p-8 px-4 sm:px-8 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-[#171717] mb-2">Settings</h1>
      <p className="text-sm text-[#666666] mb-8">Configure your SealedDeal workspace</p>

      {/* Workspace Info */}
      <div className="bg-white border border-[#eaeaea] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#0f477b]/8 flex items-center justify-center">
            <Info className="w-5 h-5 text-[#0f477b]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#171717]">Workspace</h2>
            <p className="text-xs text-[#666666]">SealedDeal PE Due Diligence Platform</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-[#f5f5f5]">
            <span className="text-[#666666]">Active deals</span>
            <span className="text-[#171717] font-medium">{deals.length}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#f5f5f5]">
            <span className="text-[#666666]">AI analysis</span>
            <span className="text-[#171717] font-medium">Claude Sonnet 4</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[#666666]">Version</span>
            <span className="text-[#171717] font-medium">1.0.0</span>
          </div>
        </div>

        <div className="mt-4 p-3 bg-[#f5f5f5] rounded-lg flex items-start gap-2">
          <Shield className="w-4 h-4 text-[#888888] shrink-0 mt-0.5" />
          <p className="text-xs text-[#888888]">
            AI analysis is powered by Anthropic's API. Your API key is securely stored as a server environment variable and never exposed to the browser.
          </p>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-white border border-[#eaeaea] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#e5484d]/8 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-[#e5484d]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#171717]">Session</h2>
            <p className="text-xs text-[#666666]">Sign out of SealedDeal</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 bg-[#fafafa] hover:bg-[#f5f5f5] text-[#e5484d] border border-[#eaeaea] rounded-lg text-sm font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
