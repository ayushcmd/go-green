import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import {
  ShieldCheck,
  Cpu,
  HardDrive,
  Clock,
  WifiOff,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { initialSandboxProfiles } from '@/services/systemService';
import { SandboxProfile } from '@/types';

export const SandboxPage: React.FC = () => {
  const [profiles] = useState<SandboxProfile[]>(initialSandboxProfiles);
  const [selectedProfile, setSelectedProfile] = useState<SandboxProfile>(initialSandboxProfiles[0]!);
  const [activeTab, setActiveTab] = useState('policies');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleAttemptLaunch = () => {
    setStatusMessage(
      'Execution blocked: Kernel isolation backend offline. cgroups v2 and seccomp-BPF filters require the native GoGreen daemon with root/CAP_SYS_ADMIN privileges.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Sandbox Header */}
      <Card noPadding>
        <div className="p-4 border-b border-gogreen-border bg-gogreen-bg-secondary/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <ShieldCheck className="w-5 h-5 text-gogreen-bright" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-gogreen-text-primary uppercase tracking-wide">
                Hardened Execution Sandbox
              </h2>
              <p className="text-xs text-gogreen-text-secondary mt-0.5">
                Deterministic cgroups v2 resource capping, seccomp-BPF syscall filters & namespaces
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-gogreen-bg-elevated border border-gogreen-border text-xs font-mono">
              <span className="text-gogreen-text-secondary">Isolation Backend:</span>
              <StatusIndicator status="offline" label="OFFLINE" />
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="w-3.5 h-3.5" />}
              onClick={handleAttemptLaunch}
            >
              Dispatch in Sandbox
            </Button>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3 bg-gogreen-warning/10 border-b border-gogreen-warning/30 text-xs font-mono text-gogreen-warning flex items-center justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statusMessage}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatusMessage(null)}
              className="text-gogreen-warning hover:text-gogreen-primary"
            >
              Dismiss
            </Button>
          </div>
        )}

        <div className="p-3">
          <Tabs
            tabs={[
              { id: 'policies', label: 'Isolation Policies', badge: profiles.length },
              { id: 'syscalls', label: 'Seccomp Syscall Whitelist', badge: selectedProfile.allowedSyscalls.length },
              { id: 'history', label: 'Execution Audit Log' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </Card>

      {/* Main Tab Views */}
      {activeTab === 'policies' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Selector */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-wider text-gogreen-text-secondary font-semibold">
              Security Profiles
            </h3>
            {profiles.map((profile) => {
              const isSelected = profile.id === selectedProfile.id;
              return (
                <div
                  key={profile.id}
                  onClick={() => {
                    setSelectedProfile(profile);
                    setStatusMessage(null);
                  }}
                  className={`p-4 rounded border cursor-pointer font-mono text-xs transition-all ${
                    isSelected
                      ? 'bg-gogreen-bg-elevated border-gogreen-primary text-gogreen-bright shadow-glow-sm'
                      : 'bg-gogreen-bg-panel border-gogreen-border text-gogreen-text-secondary hover:text-gogreen-text-primary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{profile.name}</span>
                    <Badge size="sm" variant={profile.seccompProfile === 'strict' ? 'primary' : 'neutral'}>
                      {profile.seccompProfile}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-gogreen-text-secondary mt-2 space-y-1">
                    <div>CPU Quota: {profile.maxCpuShares} shares</div>
                    <div>Memory Cap: {profile.maxMemoryMb} MB</div>
                    <div>Timeout: {profile.timeoutSeconds}s</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Profile Detailed Parameters Editor */}
          <div className="lg:col-span-2 space-y-6">
            <Card
              title={selectedProfile.name}
              subtitle="cgroups v2 resource quotas and network isolation flags"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                {/* CPU Limit */}
                <div className="p-3 bg-gogreen-bg-main border border-gogreen-border rounded space-y-1">
                  <div className="flex items-center gap-2 text-gogreen-text-secondary text-[11px]">
                    <Cpu className="w-3.5 h-3.5 text-gogreen-primary" />
                    <span>CPU SHARES (cgroups v2)</span>
                  </div>
                  <div className="text-base font-bold text-gogreen-text-primary">
                    {selectedProfile.maxCpuShares} shares
                  </div>
                  <div className="text-[10px] text-gogreen-text-secondary">
                    cpu.weight relative priority allocation
                  </div>
                </div>

                {/* Memory Limit */}
                <div className="p-3 bg-gogreen-bg-main border border-gogreen-border rounded space-y-1">
                  <div className="flex items-center gap-2 text-gogreen-text-secondary text-[11px]">
                    <HardDrive className="w-3.5 h-3.5 text-gogreen-primary" />
                    <span>MEMORY HIGH WATERMARK</span>
                  </div>
                  <div className="text-base font-bold text-gogreen-text-primary">
                    {selectedProfile.maxMemoryMb} MB
                  </div>
                  <div className="text-[10px] text-gogreen-text-secondary">
                    memory.max hard OOM kill barrier
                  </div>
                </div>

                {/* Timeout */}
                <div className="p-3 bg-gogreen-bg-main border border-gogreen-border rounded space-y-1">
                  <div className="flex items-center gap-2 text-gogreen-text-secondary text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-gogreen-primary" />
                    <span>WALL-CLOCK TIMEOUT</span>
                  </div>
                  <div className="text-base font-bold text-gogreen-text-primary">
                    {selectedProfile.timeoutSeconds} Seconds
                  </div>
                  <div className="text-[10px] text-gogreen-text-secondary">
                    SIGKILL emitted after deadline
                  </div>
                </div>

                {/* Network Isolation */}
                <div className="p-3 bg-gogreen-bg-main border border-gogreen-border rounded space-y-1">
                  <div className="flex items-center gap-2 text-gogreen-text-secondary text-[11px]">
                    <WifiOff className="w-3.5 h-3.5 text-gogreen-primary" />
                    <span>NETWORK NAMESPACE</span>
                  </div>
                  <div className="text-base font-bold text-gogreen-text-primary">
                    {selectedProfile.networkEnabled ? 'ENABLED' : 'STRICTLY ISOLATED'}
                  </div>
                  <div className="text-[10px] text-gogreen-text-secondary">
                    CLONE_NEWNET zero external socket access
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gogreen-border flex justify-end">
                <Button size="sm" variant="secondary" onClick={handleAttemptLaunch}>
                  Validate Isolation Parameters
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'syscalls' && (
        <Card
          title="Seccomp-BPF Syscall Filter"
          subtitle="Permitted Linux system calls under execution profile"
        >
          <div className="font-mono text-xs space-y-4">
            <p className="text-gogreen-text-secondary font-sans">
              Any invocation of a syscall not present in this whitelist triggers an immediate SIGSYS termination:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {selectedProfile.allowedSyscalls.map((call) => (
                <div
                  key={call}
                  className="p-2 rounded bg-gogreen-bg-main border border-gogreen-border text-gogreen-bright text-[11px] flex items-center justify-between"
                >
                  <span>sys_{call}</span>
                  <Badge size="sm" variant="primary">ALLOW</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card title="Execution Audit Log" subtitle="Sanboxed run history">
          <EmptyState
            type="no_data"
            title="No sandboxed runs recorded"
            description="No processes have executed inside the sandbox yet. Historical stdout, stderr, and resource traces will appear here."
          />
        </Card>
      )}
    </div>
  );
};
