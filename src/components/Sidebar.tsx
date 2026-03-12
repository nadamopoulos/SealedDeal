import { NavLink, useNavigate } from 'react-router-dom';
import { useDealStore } from '../store/dealStore';
import {
  LayoutDashboard,
  Settings,
  Plus,
  Building2,
  X,
} from 'lucide-react';
import SealedDealLogo from './SealedDealLogo';

interface SidebarProps {
  onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { deals, activeDealId } = useDealStore();
  const navigate = useNavigate();

  const recentDeals = deals.slice(0, 8);

  return (
    <aside className="w-64 bg-[#fafafa] border-r border-[#eaeaea] flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-[#eaeaea] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-[#f0f0f0] rounded-lg md:hidden transition-colors"
        >
          <X className="w-4 h-4 text-[#666666]" />
        </button>
        <SealedDealLogo className="h-8 w-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <NavLink
          to="/deals"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive && !activeDealId
                ? 'bg-[#0f477b]/8 text-[#0f477b]'
                : 'text-[#666666] hover:text-[#171717] hover:bg-[#f0f0f0]'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4" />
          All Deals
        </NavLink>

        {/* Recent Deals */}
        {recentDeals.length > 0 && (
          <div className="mt-4">
            <p className="px-3 py-2 text-[10px] font-semibold text-[#a1a1a1] uppercase tracking-wider">
              Recent Deals
            </p>
            {recentDeals.map((deal) => (
              <button
                key={deal.id}
                onClick={() => { navigate(`/deals/${deal.id}`); onClose(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  activeDealId === deal.id
                    ? 'bg-[#0f477b]/8 text-[#0f477b]'
                    : 'text-[#666666] hover:text-[#171717] hover:bg-[#f0f0f0]'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{deal.company || deal.name}</span>
                <StatusDot status={deal.status} />
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-[#eaeaea] space-y-1">
        <button
          onClick={() => { navigate('/deals?new=1'); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#0f477b] hover:bg-[#1a5c9e] text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[#0f477b]/8 text-[#0f477b]'
                : 'text-[#666666] hover:text-[#171717] hover:bg-[#f0f0f0]'
            }`
          }
        >
          <Settings className="w-4 h-4" />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-[#a1a1a1]',
    uploading: 'bg-[#0070f3]',
    analyzing: 'bg-[#f5a524] animate-pulse',
    reviewed: 'bg-[#46a758]',
    archived: 'bg-[#d4d4d4]',
  };
  return <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-[#a1a1a1]'}`} />;
}
