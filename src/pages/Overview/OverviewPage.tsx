import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import {
  Cpu,
  Network,
  Activity,
  ShieldCheck,
  Binary,
  Radio,
  ArrowUpRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getHostHardwareInfo, systemLogsSeed } from '@/services/systemService';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const host = getHostHardwareInfo();

  return (
    <div className="space-y-6">
      {/* Top Platform Health Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gateway Status */}
        <Card noPadding>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-gogreen-text-secondary uppercase">
                Platform Gateway
              </div>
              <div className="text-lg font-mono font-bold text-gogreen-text-primary mt-1">
                STANDBY
              </div>
              <div className="text-[11px] text-gogreen-text-secondary mt-0.5">
                Waiting for host daemon link
              </div>
            </div>
            <div className="p-3 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <Radio className="w-5 h-5 text-gogreen-warning" />
            </div>
          </div>
          <div className="px-4 py-2 bg-gogreen-bg-secondary/40 border-t border-gogreen-border/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-gogreen-text-secondary">Host Binding</span>
            <span className="text-gogreen-text-primary">127.0.0.1:8080</span>
          </div>
        </Card>

        {/* Native Engine Status */}
        <Card noPadding>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-gogreen-text-secondary uppercase">
                Native Engine
              </div>
              <div className="text-lg font-mono font-bold text-gogreen-text-secondary mt-1">
                NOT CONNECTED
              </div>
              <div className="text-[11px] text-gogreen-text-secondary mt-0.5">
                IPC socket offline
              </div>
            </div>
            <div className="p-3 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <Cpu className="w-5 h-5 text-gogreen-text-secondary" />
            </div>
          </div>
          <div className="px-4 py-2 bg-gogreen-bg-secondary/40 border-t border-gogreen-border/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-gogreen-text-secondary">Target Architecture</span>
            <span className="text-gogreen-bright font-semibold uppercase">{host.arch}</span>
          </div>
        </Card>

        {/* Distributed Mesh Workers */}
        <Card noPadding>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-gogreen-text-secondary uppercase">
                Connected Workers
              </div>
              <div className="text-lg font-mono font-bold text-gogreen-text-primary mt-1">
                0 NODES
              </div>
              <div className="text-[11px] text-gogreen-text-secondary mt-0.5">
                Mesh coordinator idle
              </div>
            </div>
            <div className="p-3 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <Network className="w-5 h-5 text-gogreen-text-secondary" />
            </div>
          </div>
          <div className="px-4 py-2 bg-gogreen-bg-secondary/40 border-t border-gogreen-border/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-gogreen-text-secondary">Active Jobs</span>
            <span className="text-gogreen-text-primary">0 Queued</span>
          </div>
        </Card>

        {/* Hardware Isolation Substrate */}
        <Card noPadding>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-gogreen-text-secondary uppercase">
                Hardware Host
              </div>
              <div className="text-lg font-mono font-bold text-gogreen-text-primary mt-1">
                {host.cores} CORES
              </div>
              <div className="text-[11px] text-gogreen-text-secondary mt-0.5">
                Logical execution threads
              </div>
            </div>
            <div className="p-3 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <Activity className="w-5 h-5 text-gogreen-bright" />
            </div>
          </div>
          <div className="px-4 py-2 bg-gogreen-bg-secondary/40 border-t border-gogreen-border/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-gogreen-text-secondary">Client Binary Engine</span>
            <span className="text-gogreen-bright font-semibold">ACTIVE</span>
          </div>
        </Card>
      </div>

      {/* Utilization & Module Diagnostics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telemetry Gauge & Operational Status */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="Telemetry Feeds & Operational States"
            subtitle="Honest telemetry reflection from host hardware & execution engines"
            headerAction={
              <Badge variant="warning" dot>
                Awaiting Daemon
              </Badge>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CPU Utilization Panel */}
              <div className="bg-gogreen-bg-main border border-gogreen-border rounded p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gogreen-text-secondary uppercase">
                    Host CPU Utilization
                  </span>
                  <StatusIndicator status="standby" label="Waiting for connection" />
                </div>
                <div className="my-6 text-center">
                  <div className="text-3xl font-mono font-bold text-gogreen-text-secondary">
                    -- %
                  </div>
                  <div className="text-xs text-gogreen-text-secondary mt-1">
                    Daemon offline (No fabricated metric)
                  </div>
                </div>
                <div className="text-[11px] font-mono text-gogreen-text-secondary border-t border-gogreen-border/50 pt-2 flex justify-between">
                  <span>Detected Cores</span>
                  <span className="text-gogreen-text-primary">{host.cores} Logical Units</span>
                </div>
              </div>

              {/* Memory Saturation Panel */}
              <div className="bg-gogreen-bg-main border border-gogreen-border rounded p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gogreen-text-secondary uppercase">
                    Host RAM Allocation
                  </span>
                  <StatusIndicator status="standby" label="Waiting for connection" />
                </div>
                <div className="my-6 text-center">
                  <div className="text-3xl font-mono font-bold text-gogreen-text-secondary">
                    -- GB
                  </div>
                  <div className="text-xs text-gogreen-text-secondary mt-1">
                    Direct memory telemetry unavailable
                  </div>
                </div>
                <div className="text-[11px] font-mono text-gogreen-text-secondary border-t border-gogreen-border/50 pt-2 flex justify-between">
                  <span>Host OS</span>
                  <span className="text-gogreen-text-primary truncate max-w-[140px]">{host.platform}</span>
                </div>
              </div>
            </div>

            {/* Quick Launchpad to Modules */}
            <div className="mt-6 pt-4 border-t border-gogreen-border">
              <div className="text-xs font-mono font-semibold text-gogreen-text-primary uppercase tracking-wider mb-3">
                Laboratory Workspaces
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => navigate('/binary-lab')}
                  className="flex items-center justify-between p-3 rounded bg-gogreen-bg-elevated/60 border border-gogreen-border hover:border-gogreen-primary/50 text-left transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <Binary className="w-4 h-4 text-gogreen-bright" />
                    <div>
                      <div className="text-xs font-mono font-medium text-gogreen-text-primary group-hover:text-gogreen-bright">
                        Binary Lab
                      </div>
                      <div className="text-[10px] text-gogreen-text-secondary">
                        ELF/PE inspection
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-gogreen-text-secondary group-hover:text-gogreen-bright" />
                </button>

                <button
                  onClick={() => navigate('/core-engine')}
                  className="flex items-center justify-between p-3 rounded bg-gogreen-bg-elevated/60 border border-gogreen-border hover:border-gogreen-primary/50 text-left transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <Cpu className="w-4 h-4 text-gogreen-bright" />
                    <div>
                      <div className="text-xs font-mono font-medium text-gogreen-text-primary group-hover:text-gogreen-bright">
                        Core Engine
                      </div>
                      <div className="text-[10px] text-gogreen-text-secondary">
                        SIMD & microkernels
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-gogreen-text-secondary group-hover:text-gogreen-bright" />
                </button>

                <button
                  onClick={() => navigate('/sandbox')}
                  className="flex items-center justify-between p-3 rounded bg-gogreen-bg-elevated/60 border border-gogreen-border hover:border-gogreen-primary/50 text-left transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-gogreen-bright" />
                    <div>
                      <div className="text-xs font-mono font-medium text-gogreen-text-primary group-hover:text-gogreen-bright">
                        Sandbox
                      </div>
                      <div className="text-[10px] text-gogreen-text-secondary">
                        Isolation policies
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-gogreen-text-secondary group-hover:text-gogreen-bright" />
                </button>
              </div>
            </div>
          </Card>

          {/* Benchmarks & Experiments State */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card
              title="Recent Experiments"
              subtitle="Registered research iterations"
              headerAction={
                <Button size="sm" variant="ghost" onClick={() => navigate('/experiments')}>
                  View Registry
                </Button>
              }
            >
              <EmptyState
                type="no_data"
                title="No experiments recorded"
                description="There are currently no recorded experimental runs in the database."
                actionLabel="Create Experiment"
                onAction={() => navigate('/experiments')}
              />
            </Card>

            <Card
              title="Benchmark History"
              subtitle="Microarchitectural profiling runs"
              headerAction={
                <Button size="sm" variant="ghost" onClick={() => navigate('/profiler')}>
                  Profiler
                </Button>
              }
            >
              <EmptyState
                type="no_data"
                title="No benchmark results available"
                description="Connect the native execution engine to generate cycle-accurate benchmarks."
                actionLabel="Open Profiler"
                onAction={() => navigate('/profiler')}
              />
            </Card>
          </div>
        </div>

        {/* Right Sidebar: Subsystem Health & System Event Log */}
        <div className="space-y-6">
          {/* Subsystem Health Status Matrix */}
          <Card title="Module Health Overview">
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gogreen-border/50">
                <span className="text-gogreen-text-secondary">Binary Parser Engine</span>
                <span className="text-gogreen-bright font-semibold">READY</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gogreen-border/50">
                <span className="text-gogreen-text-secondary">Virtual Hex Grid</span>
                <span className="text-gogreen-bright font-semibold">READY</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gogreen-border/50">
                <span className="text-gogreen-text-secondary">Native IPC Gateway</span>
                <span className="text-gogreen-warning font-semibold">STANDBY</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gogreen-border/50">
                <span className="text-gogreen-text-secondary">Distributed Mesh Hub</span>
                <span className="text-gogreen-warning font-semibold">STANDBY</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gogreen-border/50">
                <span className="text-gogreen-text-secondary">Hardware PMC Probes</span>
                <span className="text-gogreen-text-secondary font-semibold">NOT CONNECTED</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gogreen-text-secondary">Seccomp Isolator</span>
                <span className="text-gogreen-text-secondary font-semibold">NOT CONNECTED</span>
              </div>
            </div>
          </Card>

          {/* System Events Feed */}
          <Card
            title="System Events"
            subtitle="Laboratory event log"
            headerAction={
              <Button size="sm" variant="ghost" onClick={() => navigate('/logs')}>
                View All
              </Button>
            }
          >
            <div className="space-y-2 font-mono text-xs">
              {systemLogsSeed.slice(0, 4).map((entry) => (
                <div
                  key={entry.id}
                  className="p-2 rounded bg-gogreen-bg-main border border-gogreen-border/50 space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gogreen-text-secondary">{entry.timestamp}</span>
                    <Badge
                      size="sm"
                      variant={
                        entry.level === 'WARN'
                          ? 'warning'
                          : entry.level === 'ERROR'
                          ? 'error'
                          : 'primary'
                      }
                    >
                      {entry.level}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-gogreen-text-primary leading-tight">
                    {entry.message}
                  </div>
                  <div className="text-[10px] text-gogreen-text-secondary">{entry.service}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
