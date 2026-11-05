import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { navigationItems } from './navigationItems';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  nativeConnected: boolean;
  activeWorkers: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  nativeConnected,
  activeWorkers,
}) => {
  return (
    <aside
      className={cn(
        'h-screen bg-gogreen-bg-secondary border-r border-gogreen-border flex flex-col transition-all duration-200 z-30 select-none shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center px-4 border-b border-gogreen-border justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded bg-gogreen-bg-main border border-gogreen-primary/40 flex items-center justify-center shrink-0 shadow-glow-sm">
            <span className="font-mono text-sm font-bold text-gogreen-bright">GG</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="font-mono text-sm font-bold text-gogreen-text-primary tracking-wider flex items-center gap-1.5">
                GoGreen
                <span className="text-[10px] px-1 py-0.2 rounded bg-gogreen-primary/20 text-gogreen-bright border border-gogreen-primary/30 font-mono">
                  v1.0
                </span>
              </span>
              <span className="text-[10px] text-gogreen-text-secondary truncate tracking-tight">
                Systems Engineering Lab
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded text-gogreen-text-secondary hover:text-gogreen-primary hover:bg-gogreen-bg-elevated transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const badgeVal = item.badge ? item.badge(activeWorkers) : undefined;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded text-xs font-mono transition-all group relative',
                  isActive
                    ? 'bg-gogreen-bg-panel text-gogreen-bright border-l-2 border-gogreen-primary font-medium'
                    : 'text-gogreen-text-secondary hover:text-gogreen-text-primary hover:bg-gogreen-bg-elevated/40'
                )
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && badgeVal !== undefined && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-gogreen-bg-elevated border border-gogreen-border text-gogreen-text-secondary">
                  {badgeVal}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Subsystem Status */}
      <div className="p-3 border-t border-gogreen-border bg-gogreen-bg-main/60">
        {!collapsed ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-gogreen-text-secondary">Native Daemon:</span>
              <span
                className={cn(
                  'font-medium',
                  nativeConnected ? 'text-gogreen-bright' : 'text-gogreen-text-secondary'
                )}
              >
                {nativeConnected ? 'ONLINE' : 'NOT CONNECTED'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-gogreen-text-secondary">Mesh Workers:</span>
              <span
                className={cn(
                  'font-medium',
                  activeWorkers > 0 ? 'text-gogreen-bright' : 'text-gogreen-text-secondary'
                )}
              >
                {activeWorkers > 0 ? `${activeWorkers} Active` : '0 Active'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                nativeConnected ? 'bg-gogreen-bright shadow-[0_0_8px_#39FF14]' : 'bg-gogreen-border'
              )}
              title={nativeConnected ? 'Native Daemon: Online' : 'Native Daemon: Not Connected'}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
