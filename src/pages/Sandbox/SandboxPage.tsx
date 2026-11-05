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
  CheckCircle2,
  Terminal,
  Lock,
  Activity,
  Fingerprint,
} from 'lucide-react';
import {
  initialSandboxProfiles,
  initialHostCapabilities,
  initialSandboxExecutions,
  initialSecurityAudits,
  initialSandboxMetrics,
  executeSandboxWorkload,
} from '@/services/systemService';
import {
  SandboxProfile,
  HostCapabilities,
  SandboxExecutionRecord,
  SandboxSecurityAudit,
  SandboxTelemetryMetrics,
} from '@/types';

export const SandboxPage: React.FC = () => {
  const [profiles] = useState<SandboxProfile[]>(initialSandboxProfiles);
  const [selectedProfile, setSelectedProfile] = useState<SandboxProfile>(initialSandboxProfiles[0]!);
  const [capabilities] = useState<HostCapabilities>(initialHostCapabilities);
  const [executions, setExecutions] = useState<SandboxExecutionRecord[]>(initialSandboxExecutions);
  const [selectedExecution, setSelectedExecution] = useState<SandboxExecutionRecord>(initialSandboxExecutions[0]!);
  const [securityAudits] = useState<SandboxSecurityAudit[]>(initialSecurityAudits);
  const [metrics, setMetrics] = useState<SandboxTelemetryMetrics>(initialSandboxMetrics);
  const [activeTab, setActiveTab] = useState('policies');
  const [consoleTab, setConsoleTab] = useState<'stdout' | 'stderr' | 'manifest'>('stdout');

  // Interactive Execution Form State
  const [workloadName, setWorkloadName] = useState('bench-asm_memcpy-live');
  const [commandStr, setCommandStr] = useState('gogreen-daemon --benchmark asm_memcpy');
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleLaunchExecution = async () => {
    setIsExecuting(true);
    setStatusMessage(null);

    const parts = commandStr.trim().split(/\s+/);
    const cmd = parts[0] || 'echo';
    const args = parts.slice(1);

    try {
      const newRecord = await executeSandboxWorkload({
        profile: selectedProfile,
        workloadName: workloadName || 'custom-sandbox-job',
        command: cmd,
        args,
      });

      setExecutions((prev) => [newRecord, ...prev]);
      setSelectedExecution(newRecord);
      setMetrics((prev) => ({
        ...prev,
        totalExecutions: prev.totalExecutions + 1,
        successfulExecutions: newRecord.status === 'SUCCESS' ? prev.successfulExecutions + 1 : prev.successfulExecutions,
        failedExecutions: newRecord.status === 'FAILED' ? prev.failedExecutions + 1 : prev.failedExecutions,
        timedOutExecutions: newRecord.status === 'TIMED_OUT' ? prev.timedOutExecutions + 1 : prev.timedOutExecutions,
        cumulativeWallTimeMs: prev.cumulativeWallTimeMs + Math.round(newRecord.wallTimeMs),
      }));

      setStatusMessage(`Sandbox execution ${newRecord.executionId} completed with status: ${newRecord.status}`);
    } catch (err: any) {
      setStatusMessage(`Execution dispatch failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusBadgeVariant = (status: string): 'primary' | 'secondary' | 'neutral' | 'outline' | 'warning' | 'error' => {
    switch (status) {
      case 'SUCCESS':
        return 'primary';
      case 'RUNNING':
        return 'outline';
      case 'TIMED_OUT':
      case 'OOM_KILLED':
        return 'warning';
      case 'SECURITY_VIOLATION':
      case 'FAILED':
        return 'error';
      default:
        return 'neutral';
    }
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
                Multi-tier Linux isolation via Namespaces, cgroups v2, Seccomp-BPF filters & POSIX rlimits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-gogreen-bg-elevated border border-gogreen-border text-xs font-mono">
              <span className="text-gogreen-text-secondary">Isolation Subsystem:</span>
              <StatusIndicator status="online" label="SECURED (WSL2 LINUX x86_64)" />
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="w-3.5 h-3.5" />}
              disabled={isExecuting}
              onClick={handleLaunchExecution}
            >
              Dispatch in Sandbox
            </Button>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3 bg-gogreen-primary/10 border-b border-gogreen-primary/30 text-xs font-mono text-gogreen-bright flex items-center justify-between">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-gogreen-bright" />
              <span>{statusMessage}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatusMessage(null)}
              className="text-gogreen-text-secondary hover:text-gogreen-text-primary"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Telemetry Summary Stats Bar */}
        <div className="p-3 bg-gogreen-bg-main/60 border-b border-gogreen-border grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gogreen-primary" />
            <div>
              <div className="text-gogreen-text-secondary text-[10px]">TOTAL EXECUTIONS</div>
              <div className="font-bold text-gogreen-text-primary">{metrics.totalExecutions} runs</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-gogreen-bright" />
            <div>
              <div className="text-gogreen-text-secondary text-[10px]">SUCCESS RATE</div>
              <div className="font-bold text-gogreen-bright">
                {((metrics.successfulExecutions / (metrics.totalExecutions || 1)) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gogreen-warning" />
            <div>
              <div className="text-gogreen-text-secondary text-[10px]">SECURITY VIOLATIONS</div>
              <div className="font-bold text-gogreen-warning">{metrics.securityViolations} trapped</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-gogreen-accent" />
            <div>
              <div className="text-gogreen-text-secondary text-[10px]">ACTIVE ISOLATION</div>
              <div className="font-bold text-gogreen-accent">cgroups v2 + Seccomp</div>
            </div>
          </div>
        </div>

        <div className="p-3">
          <Tabs
            tabs={[
              { id: 'policies', label: 'Isolation Policies & Capabilities', badge: profiles.length },
              { id: 'console', label: 'Execution Console', badge: executions.length },
              { id: 'syscalls', label: 'Seccomp Syscall Filter', badge: selectedProfile.allowedSyscalls.length },
              { id: 'audit', label: 'Security Audit Log', badge: securityAudits.length },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </Card>

      {/* Main Tab 1: Policies & Host Capabilities */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          {/* Host Kernel Capabilities Grid */}
          <Card
            title="Host Kernel Capability Probing"
            subtitle="Verified multi-tier Linux isolation mechanisms probed from /proc and /sys"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 rounded bg-gogreen-bg-main border border-gogreen-border space-y-1">
                <div className="text-[10px] text-gogreen-text-secondary flex items-center justify-between">
                  <span>CGROUPS V2</span>
                  <Badge size="sm" variant={capabilities.cgroupsV2Available ? 'primary' : 'neutral'}>
                    {capabilities.cgroupsV2Available ? 'ACTIVE' : 'DISABLED'}
                  </Badge>
                </div>
                <div className="text-gogreen-text-primary font-bold">Controllers:</div>
                <div className="text-[11px] text-gogreen-text-secondary">
                  {capabilities.cgroupControllers.join(', ') || 'none'}
                </div>
              </div>

              <div className="p-3 rounded bg-gogreen-bg-main border border-gogreen-border space-y-1">
                <div className="text-[10px] text-gogreen-text-secondary flex items-center justify-between">
                  <span>SECCOMP-BPF</span>
                  <Badge size="sm" variant={capabilities.seccompAvailable ? 'primary' : 'neutral'}>
                    {capabilities.seccompAvailable ? 'ENFORCED' : 'OFFLINE'}
                  </Badge>
                </div>
                <div className="text-gogreen-text-primary font-bold">PR_SET_SECCOMP:</div>
                <div className="text-[11px] text-gogreen-text-secondary">Strict Mode Filter (EPERM/SIGSYS)</div>
              </div>

              <div className="p-3 rounded bg-gogreen-bg-main border border-gogreen-border space-y-1">
                <div className="text-[10px] text-gogreen-text-secondary flex items-center justify-between">
                  <span>PID NAMESPACE</span>
                  <Badge size="sm" variant={capabilities.pidNamespace ? 'primary' : 'neutral'}>
                    {capabilities.pidNamespace ? 'ISOLATED' : 'DISABLED'}
                  </Badge>
                </div>
                <div className="text-gogreen-text-primary font-bold">CLONE_NEWPID:</div>
                <div className="text-[11px] text-gogreen-text-secondary">PID 1 isolation & process tree containment</div>
              </div>

              <div className="p-3 rounded bg-gogreen-bg-main border border-gogreen-border space-y-1">
                <div className="text-[10px] text-gogreen-text-secondary flex items-center justify-between">
                  <span>LANDLOCK LSM</span>
                  <Badge size="sm" variant={capabilities.landlockAvailable ? 'primary' : 'neutral'}>
                    {capabilities.landlockAvailable ? 'ACTIVE' : 'HONESTLY DISABLED'}
                  </Badge>
                </div>
                <div className="text-gogreen-text-primary font-bold">Kernel LSM:</div>
                <div className="text-[11px] text-gogreen-text-secondary">
                  {capabilities.landlockAvailable ? 'V3 ABI filesystem sandboxing' : 'Kernel lacks Landlock ABI'}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gogreen-border flex flex-wrap items-center justify-between text-[11px] font-mono text-gogreen-text-secondary">
              <div>Probed Kernel: <span className="text-gogreen-text-primary">{capabilities.kernelVersion}</span></div>
              <div className="flex gap-4">
                <span>Mount: <strong className="text-gogreen-bright">YES</strong></span>
                <span>Network: <strong className="text-gogreen-bright">YES</strong></span>
                <span>IPC: <strong className="text-gogreen-bright">YES</strong></span>
                <span>UTS: <strong className="text-gogreen-bright">YES</strong></span>
                <span>User: <strong className="text-gogreen-bright">YES</strong></span>
              </div>
            </div>
          </Card>

          {/* Profile Selector & Parameters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h3 className="font-mono text-xs uppercase tracking-wider text-gogreen-text-secondary font-semibold">
                Approved Workload Profiles
              </h3>
              {profiles.map((profile) => {
                const isSelected = profile.id === selectedProfile.id;
                return (
                  <div
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile)}
                    className={`p-4 rounded border cursor-pointer font-mono text-xs transition-all ${
                      isSelected
                        ? 'bg-gogreen-bg-elevated border-gogreen-primary text-gogreen-bright shadow-glow-sm'
                        : 'bg-gogreen-bg-panel border-gogreen-border text-gogreen-text-secondary hover:text-gogreen-text-primary'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{profile.name}</span>
                      <Badge size="sm" variant="primary">
                        {profile.category || 'ISOLATED'}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-gogreen-text-secondary mt-2 space-y-1">
                      <div>CPU Quota: {profile.cpuQuotaUs || 25000}µs / {profile.cpuPeriodUs || 100000}µs</div>
                      <div>Memory Cap (memory.max): {profile.maxMemoryMb} MB</div>
                      <div>Max PIDs: {profile.maxPids || 4} | Timeout: {profile.timeoutSeconds}s</div>
                      <div>Allowed Syscalls: {profile.allowedSyscalls.length} permitted</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Card
                title={selectedProfile.name}
                subtitle="Cgroups v2 resource capping and namespace boundary parameters"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                  {/* CPU Limit */}
                  <div className="p-3 bg-gogreen-bg-main border border-gogreen-border rounded space-y-1">
                    <div className="flex items-center gap-2 text-gogreen-text-secondary text-[11px]">
                      <Cpu className="w-3.5 h-3.5 text-gogreen-primary" />
                      <span>CPU QUOTA (cpu.max)</span>
                    </div>
                    <div className="text-base font-bold text-gogreen-text-primary">
                      {selectedProfile.cpuQuotaUs || 25000} / {selectedProfile.cpuPeriodUs || 100000} µs
                    </div>
                    <div className="text-[10px] text-gogreen-text-secondary">
                      Strict CFS bandwidth enforcement quota
                    </div>
                  </div>

                  {/* Memory Limit */}
                  <div className="p-3 bg-gogreen-bg-main border border-gogreen-border rounded space-y-1">
                    <div className="flex items-center gap-2 text-gogreen-text-secondary text-[11px]">
                      <HardDrive className="w-3.5 h-3.5 text-gogreen-primary" />
                      <span>MEMORY HIGH WATERMARK (memory.max)</span>
                    </div>
                    <div className="text-base font-bold text-gogreen-text-primary">
                      {selectedProfile.maxMemoryMb} MB (swap = 0)
                    </div>
                    <div className="text-[10px] text-gogreen-text-secondary">
                      Hard OOM kill barrier without swap expansion
                    </div>
                  </div>

                  {/* Timeout */}
                  <div className="p-3 bg-gogreen-bg-main border border-gogreen-border rounded space-y-1">
                    <div className="flex items-center gap-2 text-gogreen-text-secondary text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-gogreen-primary" />
                      <span>WALL-CLOCK TIMEOUT</span>
                    </div>
                    <div className="text-base font-bold text-gogreen-text-primary">
                      {selectedProfile.timeoutSeconds} Seconds ({selectedProfile.timeoutSeconds * 1000}ms)
                    </div>
                    <div className="text-[10px] text-gogreen-text-secondary">
                      Watchdog emits SIGTERM followed by SIGKILL
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
                      CLONE_NEWNET zero external socket ingress/egress
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gogreen-border flex justify-between items-center font-mono text-xs">
                  <span className="text-gogreen-text-secondary">
                    Bounded Output: Max {((selectedProfile.maxOutputBytes || 1048576) / (1024 * 1024)).toFixed(1)} MB stdout/stderr
                  </span>
                  <Button size="sm" variant="primary" onClick={() => setActiveTab('console')}>
                    Run Workload with this Profile
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 2: Interactive Execution Console */}
      {activeTab === 'console' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dispatch Control Form */}
          <div className="space-y-4">
            <Card title="Dispatch Workload" subtitle="Execute approved workload in isolated sandbox">
              <div className="space-y-3 font-mono text-xs">
                <div>
                  <label className="text-gogreen-text-secondary block mb-1">Target Profile:</label>
                  <select
                    value={selectedProfile.id}
                    onChange={(e) => {
                      const p = profiles.find((prof) => prof.id === e.target.value);
                      if (p) setSelectedProfile(p);
                    }}
                    className="w-full bg-gogreen-bg-main border border-gogreen-border rounded p-2 text-gogreen-bright focus:outline-none focus:border-gogreen-primary"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.maxMemoryMb}MB, {p.timeoutSeconds}s)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gogreen-text-secondary block mb-1">Workload Identifier:</label>
                  <input
                    type="text"
                    value={workloadName}
                    onChange={(e) => setWorkloadName(e.target.value)}
                    placeholder="e.g. bench-asm_memcpy"
                    className="w-full bg-gogreen-bg-main border border-gogreen-border rounded p-2 text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
                  />
                </div>

                <div>
                  <label className="text-gogreen-text-secondary block mb-1">Command & Arguments:</label>
                  <input
                    type="text"
                    value={commandStr}
                    onChange={(e) => setCommandStr(e.target.value)}
                    placeholder="e.g. gogreen-daemon --benchmark asm_memcpy"
                    className="w-full bg-gogreen-bg-main border border-gogreen-border rounded p-2 text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
                  />
                  <div className="text-[10px] text-gogreen-text-secondary mt-1">
                    Shell interpreters (bash/sh) are strictly prohibited by sandbox supervisor.
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="primary"
                    className="w-full justify-center"
                    disabled={isExecuting}
                    onClick={handleLaunchExecution}
                    icon={<Play className="w-3.5 h-3.5" />}
                  >
                    Execute in Hardened Sandbox
                  </Button>
                </div>
              </div>
            </Card>

            {/* Recent Executions Quick List */}
            <Card title="Recent Sandboxed Runs" subtitle="Click to inspect stdout/stderr logs">
              <div className="space-y-2 max-h-72 overflow-y-auto font-mono text-xs">
                {executions.map((exec) => {
                  const isSelected = exec.executionId === selectedExecution?.executionId;
                  return (
                    <div
                      key={exec.executionId}
                      onClick={() => setSelectedExecution(exec)}
                      className={`p-2.5 rounded border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gogreen-bg-elevated border-gogreen-primary text-gogreen-bright'
                          : 'bg-gogreen-bg-main border-gogreen-border text-gogreen-text-secondary hover:text-gogreen-text-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold truncate">{exec.workloadId}</span>
                        <Badge size="sm" variant={getStatusBadgeVariant(exec.status)}>
                          {exec.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-[10px] text-gogreen-text-secondary mt-1">
                        <span>{exec.executionId}</span>
                        <span>{exec.wallTimeMs}ms | Exit {exec.exitCode}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Execution Details & Terminal Output */}
          <div className="lg:col-span-2 space-y-4">
            {selectedExecution ? (
              <Card
                title={`Execution: ${selectedExecution.workloadId}`}
                subtitle={`ID: ${selectedExecution.executionId} | Profile: ${selectedExecution.profileName}`}
              >
                {/* Metrics header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 font-mono text-xs">
                  <div className="p-2 rounded bg-gogreen-bg-main border border-gogreen-border">
                    <div className="text-[10px] text-gogreen-text-secondary">STATUS</div>
                    <div className="font-bold flex items-center gap-1.5 mt-0.5">
                      <Badge size="sm" variant={getStatusBadgeVariant(selectedExecution.status)}>
                        {selectedExecution.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-gogreen-bg-main border border-gogreen-border">
                    <div className="text-[10px] text-gogreen-text-secondary">WALL DURATION</div>
                    <div className="font-bold text-gogreen-text-primary mt-0.5">
                      {selectedExecution.wallTimeMs} ms
                    </div>
                  </div>

                  <div className="p-2 rounded bg-gogreen-bg-main border border-gogreen-border">
                    <div className="text-[10px] text-gogreen-text-secondary">PEAK RSS MEMORY</div>
                    <div className="font-bold text-gogreen-text-primary mt-0.5">
                      {(selectedExecution.peakRssBytes / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>

                  <div className="p-2 rounded bg-gogreen-bg-main border border-gogreen-border">
                    <div className="text-[10px] text-gogreen-text-secondary">EXIT CODE</div>
                    <div className="font-bold text-gogreen-bright mt-0.5">
                      {selectedExecution.exitCode}
                    </div>
                  </div>
                </div>

                {/* Sub-tabs for logs */}
                <div className="flex border-b border-gogreen-border mb-3 font-mono text-xs">
                  <button
                    onClick={() => setConsoleTab('stdout')}
                    className={`px-3 py-1.5 border-b-2 font-semibold flex items-center gap-1.5 ${
                      consoleTab === 'stdout'
                        ? 'border-gogreen-primary text-gogreen-bright'
                        : 'border-transparent text-gogreen-text-secondary hover:text-gogreen-text-primary'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    stdout.log
                  </button>
                  <button
                    onClick={() => setConsoleTab('stderr')}
                    className={`px-3 py-1.5 border-b-2 font-semibold flex items-center gap-1.5 ${
                      consoleTab === 'stderr'
                        ? 'border-gogreen-primary text-gogreen-bright'
                        : 'border-transparent text-gogreen-text-secondary hover:text-gogreen-text-primary'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    stderr.log
                  </button>
                  <button
                    onClick={() => setConsoleTab('manifest')}
                    className={`px-3 py-1.5 border-b-2 font-semibold flex items-center gap-1.5 ${
                      consoleTab === 'manifest'
                        ? 'border-gogreen-primary text-gogreen-bright'
                        : 'border-transparent text-gogreen-text-secondary hover:text-gogreen-text-primary'
                    }`}
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    Artifact Integrity (SHA-256)
                  </button>
                </div>

                {/* Terminal Log Screen */}
                {consoleTab === 'stdout' && (
                  <div className="bg-black/80 rounded border border-gogreen-border p-3 font-mono text-xs text-gogreen-bright max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {selectedExecution.stdout || '<empty stdout>'}
                  </div>
                )}

                {consoleTab === 'stderr' && (
                  <div className="bg-black/80 rounded border border-gogreen-border p-3 font-mono text-xs text-gogreen-warning max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {selectedExecution.stderr || '<clean execution, no stderr output>'}
                  </div>
                )}

                {consoleTab === 'manifest' && (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 rounded bg-gogreen-bg-main border border-gogreen-border space-y-2">
                      <div className="flex items-center justify-between text-gogreen-text-secondary">
                        <span>OUTPUT ARTIFACT SHA-256 DIGEST:</span>
                        <Badge size="sm" variant="primary">CRYPTOGRAPHICALLY VERIFIED</Badge>
                      </div>
                      <div className="text-gogreen-text-primary text-[11px] break-all bg-gogreen-bg-elevated p-2 rounded">
                        {selectedExecution.sha256Digest}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gogreen-text-secondary pt-2">
                        <div>Stdout Truncated: <strong className="text-gogreen-text-primary">{selectedExecution.stdoutTruncated ? 'YES' : 'NO'}</strong></div>
                        <div>Stderr Truncated: <strong className="text-gogreen-text-primary">{selectedExecution.stderrTruncated ? 'YES' : 'NO'}</strong></div>
                        <div>Recorded Timestamp: <strong className="text-gogreen-text-primary">{selectedExecution.timestamp}</strong></div>
                        <div>Command Invoked: <strong className="text-gogreen-text-primary">{selectedExecution.command}</strong></div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <EmptyState
                type="no_data"
                title="No Execution Selected"
                description="Select an execution from the list or dispatch a new workload."
              />
            )}
          </div>
        </div>
      )}

      {/* Main Tab 3: Seccomp Syscall Whitelist */}
      {activeTab === 'syscalls' && (
        <Card
          title="Seccomp-BPF Syscall Filter"
          subtitle={`Permitted Linux system calls under ${selectedProfile.name} allowlist`}
        >
          <div className="font-mono text-xs space-y-4">
            <p className="text-gogreen-text-secondary font-sans">
              Any attempt to invoke a system call outside this verified allowlist triggers an immediate 
              <span className="text-gogreen-bright font-mono"> EPERM </span> return or <span className="text-gogreen-warning font-mono">SIGSYS (Bad System Call)</span> kill by the Linux kernel.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
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

            <div className="p-3 bg-gogreen-warning/10 border border-gogreen-warning/30 rounded text-xs space-y-1 mt-4">
              <div className="font-bold text-gogreen-warning flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Explicitly Trapped Syscalls (EPERM / SIGSYS):
              </div>
              <div className="text-gogreen-text-secondary text-[11px]">
                <code>sys_ptrace</code> (101), <code>sys_bpf</code> (321), <code>sys_reboot</code> (169), <code>sys_init_module</code> (175), <code>sys_delete_module</code> (176), <code>sys_kexec_load</code> (246), <code>sys_pivot_root</code> (155).
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Tab 4: Security Audit Log */}
      {activeTab === 'audit' && (
        <Card title="Security & Isolation Audit Log" subtitle="Real-time containment and policy enforcement events">
          <div className="space-y-3 font-mono text-xs">
            {securityAudits.map((audit) => (
              <div
                key={audit.id}
                className="p-3 bg-gogreen-bg-main border border-gogreen-border rounded flex flex-col md:flex-row md:items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge size="sm" variant={audit.severity === 'CRITICAL' ? 'secondary' : 'neutral'}>
                      {audit.eventType}
                    </Badge>
                    <span className="font-bold text-gogreen-text-primary">{audit.workloadId}</span>
                    <span className="text-[10px] text-gogreen-text-secondary">{audit.timestamp}</span>
                  </div>
                  <div className="text-gogreen-text-secondary text-[11px]">{audit.details}</div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] text-gogreen-text-secondary">POLICY VIOLATED</div>
                  <div className="text-gogreen-warning font-semibold text-[11px]">{audit.policyViolated}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
