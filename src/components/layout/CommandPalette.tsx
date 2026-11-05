import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  Binary,
  Gauge,
  Network,
  ShieldCheck,
  Activity,
  FlaskConical,
  ScrollText,
  Settings,
  Search,
  ArrowRight,
  Upload,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const commands = [
    { id: 'nav-overview', title: 'Go to Overview', category: 'Navigation', icon: LayoutDashboard, action: () => navigate('/') },
    { id: 'nav-core', title: 'Go to Core Engine', category: 'Navigation', icon: Cpu, action: () => navigate('/core-engine') },
    { id: 'nav-binary', title: 'Go to Binary Lab', category: 'Navigation', icon: Binary, action: () => navigate('/binary-lab') },
    { id: 'nav-profiler', title: 'Go to Profiler', category: 'Navigation', icon: Gauge, action: () => navigate('/profiler') },
    { id: 'nav-mesh', title: 'Go to Distributed Mesh', category: 'Navigation', icon: Network, action: () => navigate('/distributed-mesh') },
    { id: 'nav-sandbox', title: 'Go to Sandbox', category: 'Navigation', icon: ShieldCheck, action: () => navigate('/sandbox') },
    { id: 'nav-monitor', title: 'Go to System Monitor', category: 'Navigation', icon: Activity, action: () => navigate('/system-monitor') },
    { id: 'nav-experiments', title: 'Go to Experiments', category: 'Navigation', icon: FlaskConical, action: () => navigate('/experiments') },
    { id: 'nav-logs', title: 'Go to Logs & Traces', category: 'Navigation', icon: ScrollText, action: () => navigate('/logs') },
    { id: 'nav-settings', title: 'Go to Settings', category: 'Navigation', icon: Settings, action: () => navigate('/settings') },
    { id: 'act-upload', title: 'Inspect Binary File', category: 'Action', icon: Upload, action: () => navigate('/binary-lab') },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (idx: number) => {
    const target = filteredCommands[idx];
    if (target) {
      target.action();
      onClose();
      setQuery('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Command Palette" maxWidth="lg">
      <div className="space-y-3 font-mono">
        {/* Search Field */}
        <div className="relative flex items-center border border-gogreen-border rounded bg-gogreen-bg-main px-3 py-2">
          <Search className="w-4 h-4 text-gogreen-primary mr-2 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, route, or action..."
            autoFocus
            className="w-full bg-transparent border-none text-xs text-gogreen-text-primary focus:outline-none placeholder:text-gogreen-text-secondary/60"
          />
        </div>

        {/* Command List */}
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-6 text-xs text-gogreen-text-secondary">
              No matching commands found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleSelect(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-gogreen-primary/20 text-gogreen-bright border border-gogreen-primary/30'
                      : 'text-gogreen-text-secondary hover:bg-gogreen-bg-elevated hover:text-gogreen-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{cmd.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gogreen-text-secondary uppercase">
                      {cmd.category}
                    </span>
                    <ArrowRight className="w-3 h-3 opacity-60" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
};
