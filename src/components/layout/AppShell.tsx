import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Breadcrumbs } from './Breadcrumbs';
import { CommandPalette } from './CommandPalette';
import { getInitialSystemStatus, getHostHardwareInfo } from '@/services/systemService';

export const AppShell: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState(getInitialSystemStatus());
  const host = getHostHardwareInfo();

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setStatus(getInitialSystemStatus());
      setIsRefreshing(false);
    }, 400);
  };

  return (
    <div className="flex h-screen bg-gogreen-bg-main text-gogreen-text-primary overflow-hidden">
      {/* Persistent Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        nativeConnected={status.nativeEngineConnected}
        activeWorkers={status.activeWorkers}
      />

      {/* Main Studio Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onRefreshTelemetry={handleRefresh}
          isRefreshing={isRefreshing}
          gatewayConnected={status.gatewayConnected}
          hostArch={host.arch}
        />

        {/* Workspace Content Canvas */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gogreen-border/40">
            <Breadcrumbs />
            <div className="text-[11px] font-mono text-gogreen-text-secondary hidden md:block">
              BUILD DEEP. THINK LOW-LEVEL. ENGINEER BEYOND LIMITS.
            </div>
          </div>

          <Outlet context={{ status, host }} />
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
};
