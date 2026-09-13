import React from 'react';
import { Home, ArrowLeftRight, Repeat, Layers, BarChart3, BookOpen, Compass } from 'lucide-react';
import { NavTab } from '../types';

interface BottomNavBarProps {
  activeTab: NavTab;
  theme?: 'dark' | 'light';
  onTabChange: (tab: NavTab) => void;
  onHomeClick: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  theme = 'dark',
  onTabChange,
  onHomeClick,
}) => {
  const isDark = theme === 'dark';
  const navItems: Array<{
    id: NavTab;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    badge?: string;
  }> = [
    {
      id: 'home',
      label: 'Home',
      sublabel: 'Hero 3D',
      icon: Home,
      color: 'from-cyan-400 to-blue-500',
    },
    {
      id: 'bridge',
      label: 'Bridge',
      sublabel: 'Cross-Chain',
      icon: ArrowLeftRight,
      color: 'from-fuchsia-500 to-pink-500',
      badge: 'Fast',
    },
    {
      id: 'swap',
      label: 'Swap',
      sublabel: 'DEX Trading',
      icon: Repeat,
      color: 'from-purple-400 to-indigo-500',
    },
    {
      id: 'ecosystem',
      label: 'Ecosystem',
      sublabel: 'dApps & TVL',
      icon: Layers,
      color: 'from-emerald-400 to-teal-500',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      sublabel: 'Live Markets',
      icon: BarChart3,
      color: 'from-amber-400 to-orange-500',
    },
    {
      id: 'docs',
      label: 'Docs',
      sublabel: 'Protocol ↗',
      icon: BookOpen,
      color: 'from-sky-400 to-cyan-500',
    },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      aria-label="Bottom Navigation"
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl transition-colors duration-300"
    >
      <div
        className={`relative backdrop-blur-2xl rounded-2xl p-1.5 sm:p-2 transition-all duration-300 ${
          isDark
            ? 'bg-[#0e0c24]/85 border border-cyan-500/25 shadow-[0_10px_40px_rgba(0,0,0,0.7),0_0_20px_rgba(168,85,247,0.15)] ring-1 ring-white/10'
            : 'bg-white/90 border border-slate-300 shadow-[0_10px_30px_rgba(0,0,0,0.1)] ring-1 ring-slate-200'
        }`}
      >
        {/* Subtle top neon highlight bar */}
        <div
          className={`absolute -top-[1px] left-1/4 right-1/4 h-[1px] ${
            isDark
              ? 'bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent'
              : 'bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent'
          }`}
        />

        <ul className="flex items-center justify-between gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <li key={item.id} className="flex-1">
                <button
                  type="button"
                  id={`nav-btn-${item.id}`}
                  onClick={() => {
                    if (item.id === 'home') {
                      onHomeClick();
                    }
                    onTabChange(item.id);
                  }}
                  className={`w-full relative group flex flex-col items-center justify-center py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl transition-all duration-300 cursor-pointer ${
                    isActive
                      ? isDark
                        ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(6,182,212,0.35)] border border-cyan-400/40 -translate-y-1'
                        : 'bg-slate-100 text-slate-900 shadow-sm border border-cyan-400/50 -translate-y-1 font-bold'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  {/* Badge */}
                  {item.badge && (
                    <span className="absolute -top-1.5 right-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white scale-90 shadow-sm animate-pulse">
                      {item.badge}
                    </span>
                  )}

                  {/* Icon with glow when active */}
                  <div className="relative">
                    <Icon
                      className={`w-5 h-5 sm:w-5 sm:h-5 transition-transform duration-300 ${
                        isActive
                          ? isDark
                            ? 'scale-110 text-cyan-300'
                            : 'scale-110 text-cyan-600'
                          : 'group-hover:scale-105'
                      }`}
                    />
                    {isActive && isDark && (
                      <span className="absolute inset-0 bg-cyan-400/20 blur-sm rounded-full" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-[11px] sm:text-xs font-semibold tracking-wide mt-1 transition-colors ${
                      isActive
                        ? isDark
                          ? 'text-cyan-200'
                          : 'text-cyan-700'
                        : isDark
                        ? 'text-slate-400'
                        : 'text-slate-600'
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Active bottom dot */}
                  {isActive && (
                    <span
                      className={`absolute -bottom-1 w-2.5 h-1 rounded-full ${
                        isDark ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-cyan-600 shadow-sm'
                      }`}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};
