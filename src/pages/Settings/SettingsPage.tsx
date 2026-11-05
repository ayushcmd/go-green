import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import {
  Settings,
  Save,
  RotateCcw,
  Check,
} from 'lucide-react';
import { loadSettings, saveSettings, defaultSettings } from '@/services/systemService';
import { AppSettings } from '@/types';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [activeTab, setActiveTab] = useState('general');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = () => {
    saveSettings(settings);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    saveSettings(defaultSettings);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <Card noPadding>
        <div className="p-4 border-b border-gogreen-border bg-gogreen-bg-secondary/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <Settings className="w-5 h-5 text-gogreen-bright" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-gogreen-text-primary uppercase tracking-wide">
                Laboratory Settings & Configurations
              </h2>
              <p className="text-xs text-gogreen-text-secondary mt-0.5">
                IPC sockets, gRPC endpoints, telemetry intervals & security profiles
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="flex items-center gap-1 text-xs font-mono text-gogreen-bright animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                Settings Persisted
              </span>
            )}
            <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={handleReset}>
              Restore Defaults
            </Button>
            <Button variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSave}>
              Save Preferences
            </Button>
          </div>
        </div>

        <div className="p-3">
          <Tabs
            tabs={[
              { id: 'general', label: 'General & Appearance' },
              { id: 'endpoints', label: 'Service Endpoints & IPC' },
              { id: 'security', label: 'Security & Sandboxing' },
              { id: 'about', label: 'About GoGreen' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </Card>

      {/* Tab Panels */}
      {activeTab === 'general' && (
        <Card title="General & Appearance Preferences">
          <div className="space-y-4 font-mono text-xs max-w-xl">
            <div>
              <label className="block text-gogreen-text-secondary uppercase mb-1">
                Telemetry Polling Interval (ms)
              </label>
              <input
                type="number"
                value={settings.general.telemetryRefreshInterval}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    general: {
                      ...settings.general,
                      telemetryRefreshInterval: parseInt(e.target.value, 10) || 1000,
                    },
                  })
                }
                className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
              />
            </div>

            <div>
              <label className="block text-gogreen-text-secondary uppercase mb-1">
                Terminal Font Size (px)
              </label>
              <input
                type="number"
                value={settings.general.terminalFontSize}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    general: {
                      ...settings.general,
                      terminalFontSize: parseInt(e.target.value, 10) || 12,
                    },
                  })
                }
                className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
              />
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.general.denseMode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      general: { ...settings.general, denseMode: e.target.checked },
                    })
                  }
                  className="rounded border-gogreen-border text-gogreen-primary focus:ring-0 bg-gogreen-bg-main"
                />
                <span className="text-gogreen-text-primary">
                  Enable high-density technical grid layout
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.general.showDisassemblyHex}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      general: { ...settings.general, showDisassemblyHex: e.target.checked },
                    })
                  }
                  className="rounded border-gogreen-border text-gogreen-primary focus:ring-0 bg-gogreen-bg-main"
                />
                <span className="text-gogreen-text-primary">
                  Display raw machine opcodes in disassembly stream
                </span>
              </label>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'endpoints' && (
        <Card title="Service Endpoints & IPC Sockets" subtitle="Addresses used by GoGreen Studio to connect to background services">
          <div className="space-y-4 font-mono text-xs max-w-xl">
            <div>
              <label className="block text-gogreen-text-secondary uppercase mb-1">
                Platform Gateway URL
              </label>
              <input
                type="text"
                value={settings.endpoints.gatewayUrl}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    endpoints: { ...settings.endpoints, gatewayUrl: e.target.value },
                  })
                }
                className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
              />
            </div>

            <div>
              <label className="block text-gogreen-text-secondary uppercase mb-1">
                Native Engine IPC Domain Socket
              </label>
              <input
                type="text"
                value={settings.endpoints.nativeDaemonRpc}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    endpoints: { ...settings.endpoints, nativeDaemonRpc: e.target.value },
                  })
                }
                className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
              />
            </div>

            <div>
              <label className="block text-gogreen-text-secondary uppercase mb-1">
                Distributed Mesh Coordinator Endpoint
              </label>
              <input
                type="text"
                value={settings.endpoints.meshCoordinatorRpc}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    endpoints: { ...settings.endpoints, meshCoordinatorRpc: e.target.value },
                  })
                }
                className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.endpoints.autoReconnect}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      endpoints: { ...settings.endpoints, autoReconnect: e.target.checked },
                    })
                  }
                  className="rounded border-gogreen-border text-gogreen-primary focus:ring-0 bg-gogreen-bg-main"
                />
                <span className="text-gogreen-text-primary">
                  Automatically retry socket reconnections with exponential backoff
                </span>
              </label>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'security' && (
        <Card title="Security & Isolation Preferences">
          <div className="space-y-4 font-mono text-xs max-w-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.security.enforceMtls}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    security: { ...settings.security, enforceMtls: e.target.checked },
                  })
                }
                className="rounded border-gogreen-border text-gogreen-primary focus:ring-0 bg-gogreen-bg-main"
              />
              <div>
                <div className="text-gogreen-text-primary font-semibold">
                  Enforce Mutual TLS (mTLS) on Worker Mesh
                </div>
                <div className="text-[11px] text-gogreen-text-secondary">
                  Reject worker connections that do not provide verified X.509 certificates.
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.security.sandboxStrictSeccomp}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    security: { ...settings.security, sandboxStrictSeccomp: e.target.checked },
                  })
                }
                className="rounded border-gogreen-border text-gogreen-primary focus:ring-0 bg-gogreen-bg-main"
              />
              <div>
                <div className="text-gogreen-text-primary font-semibold">
                  Strict Seccomp-BPF Syscall Enforcement
                </div>
                <div className="text-[11px] text-gogreen-text-secondary">
                  Terminate any sandbox process executing unwhitelisted syscalls with SIGSYS.
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.security.allowLocalBinaryAnalysis}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    security: { ...settings.security, allowLocalBinaryAnalysis: e.target.checked },
                  })
                }
                className="rounded border-gogreen-border text-gogreen-primary focus:ring-0 bg-gogreen-bg-main"
              />
              <div>
                <div className="text-gogreen-text-primary font-semibold">
                  Allow Client-Side ArrayBuffer Parsing
                </div>
                <div className="text-[11px] text-gogreen-text-secondary">
                  Process ELF/PE binaries locally in browser memory without cloud transmission.
                </div>
              </div>
            </label>
          </div>
        </Card>
      )}

      {activeTab === 'about' && (
        <Card title="About GoGreen Studio">
          <div className="space-y-4 font-mono text-xs max-w-xl">
            <div className="flex items-center gap-3 p-3 bg-gogreen-bg-main border border-gogreen-border rounded">
              <div className="w-10 h-10 rounded bg-gogreen-bg-secondary border border-gogreen-primary/40 flex items-center justify-center font-bold text-gogreen-bright text-base">
                GG
              </div>
              <div>
                <div className="font-bold text-gogreen-text-primary text-sm">
                  GoGreen Systems Engineering Laboratory
                </div>
                <div className="text-[11px] text-gogreen-bright">
                  BUILD DEEP. THINK LOW-LEVEL. ENGINEER BEYOND LIMITS.
                </div>
              </div>
            </div>

            <div className="space-y-2 text-gogreen-text-secondary">
              <div className="flex justify-between py-1 border-b border-gogreen-border/50">
                <span>Release Version</span>
                <span className="text-gogreen-text-primary font-semibold">1.0.0</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gogreen-border/50">
                <span>Target Repository</span>
                <span className="text-gogreen-bright font-semibold">github.com/ayushcmd/go-green</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gogreen-border/50">
                <span>Repository Owner</span>
                <span className="text-gogreen-text-primary">ayushcmd</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gogreen-border/50">
                <span>Visual Identity</span>
                <span className="text-gogreen-text-primary">NVIDIA-Inspired Industrial Tech</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
