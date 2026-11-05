import React from 'react';
import { cn } from '@/utils/cn';
import { Search, RefreshCw, Terminal, Bell, Cpu } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Button } from '@/components/ui/Button';

export interface TopbarProps {
  onOpenCommandPalette: () => void;
  onRefreshTelemetry: () => void;
  isRefreshing?: boolean;
  gatewayConnected: boolean;
  hostArch: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenCommandPalette,
  onRefreshTelemetry,
  isRefreshing = false,
  gatewayConnected,
  hostArch,
}) => {
  return (
    <header className="h-14 bg-gogreen-bg-secondary border-b border-gogreen-border px-4 flex items-center justify-between select-none shrink-0 z-20">
      {/* Search / Command Palette Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 bg-gogreen-bg-elevated border border-gogreen-border rounded px-3 py-1.5 text-xs font-mono text-gogreen-text-secondary hover:text-gogreen-text-primary hover:border-gogreen-primary/50 transition-colors w-64 md:w-80 group text-left"
        >
          <Search className="w-3.5 h-3.5 text-gogreen-text-secondary group-hover:text-gogreen-primary transition-colors shrink-0" />
          <span className="flex-1 truncate">Search commands, symbols...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-gogreen-bg-panel border border-gogreen-border rounded text-gogreen-text-secondary">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Hardware Target & Telemetry Status */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Host Arch Tag */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-gogreen-bg-panel border border-gogreen-border text-xs font-mono text-gogreen-text-secondary">
          <Cpu className="w-3.5 h-3.5 text-gogreen-bright" />
          <span className="uppercase text-[11px] text-gogreen-text-primary font-semibold">{hostArch}</span>
        </div>

        {/* Global Connection Badge */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-gogreen-bg-panel border border-gogreen-border">
          <StatusIndicator
            status={gatewayConnected ? 'online' : 'offline'}
            label={gatewayConnected ? 'GATEWAY LINK' : 'NOT CONNECTED'}
            pulse={gatewayConnected}
          />
        </div>

        {/* Manual Refresh Telemetry Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefreshTelemetry}
          title="Refresh telemetry"
          className="px-2"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin text-gogreen-primary')} />
        </Button>

        {/* Diagnostic notifications */}
        <div className="relative">
          <button
            className="p-1.5 rounded text-gogreen-text-secondary hover:text-gogreen-primary hover:bg-gogreen-bg-elevated transition-colors"
            title="System Events"
          >
            <Bell className="w-4 h-4" />
          </button>
        </div>

        {/* System User / Profile */}
        <div className="border-l border-gogreen-border pl-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gogreen-bg-elevated border border-gogreen-border flex items-center justify-center text-xs font-mono font-bold text-gogreen-bright">
            <Terminal className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </header>
  );
};
