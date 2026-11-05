import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable, Column } from '@/components/ui/DataTable';
import {
  Activity,
} from 'lucide-react';
import {
  getHostHardwareInfo,
  fetchNativeHealth,
  fetchNativeHost,
  fetchNativeCpu,
} from '@/services/systemService';
import {
  SystemProcess,
  NativeHostInfo,
  NativeCpuInfo,
  NativeDaemonHealth,
} from '@/types';

export const SystemMonitorPage: React.FC = () => {
  const host = getHostHardwareInfo();
  const [activeTab, setActiveTab] = useState('host');
  const [processes] = useState<SystemProcess[]>([]);

  const [daemonHealth, setDaemonHealth] = useState<NativeDaemonHealth | null>(null);
  const [nativeHost, setNativeHost] = useState<NativeHostInfo | null>(null);
  const [nativeCpu, setNativeCpu] = useState<NativeCpuInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    const pollState = async () => {
      const health = await fetchNativeHealth();
      if (!mounted) return;

      if (health.connected && health.data) {
        setIsConnected(true);
        setDaemonHealth(health.data);
        const [hostData, cpuData] = await Promise.all([
          fetchNativeHost(),
          fetchNativeCpu(),
        ]);
        if (!mounted) return;
        if (hostData) setNativeHost(hostData);
        if (cpuData) setNativeCpu(cpuData);
      } else {
        setIsConnected(false);
        setDaemonHealth(null);
        setNativeHost(null);
        setNativeCpu(null);
      }
    };

    pollState();
    const interval = setInterval(pollState, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const processColumns: Column<SystemProcess>[] = [
    { key: 'pid', header: 'PID', sortable: true },
    { key: 'name', header: 'Process Name', sortable: true, render: (p) => <span className="font-semibold text-gogreen-bright">{p.name}</span> },
    { key: 'user', header: 'User', sortable: true },
    { key: 'cpuPercent', header: 'CPU %', sortable: true },
    { key: 'memoryMb', header: 'RSS Memory', sortable: true, render: (p) => `${p.memoryMb} MB` },
    { key: 'threads', header: 'Threads', sortable: true },
    { key: 'state', header: 'State', render: (p) => <Badge size="sm" variant="neutral">{p.state}</Badge> },
  ];

  return (
    <div className="space-y-6">
      {/* Header Diagnostics Summary */}
      <Card noPadding>
        <div className="p-4 border-b border-gogreen-border bg-gogreen-bg-secondary/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <Activity className="w-5 h-5 text-gogreen-bright" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-gogreen-text-primary uppercase tracking-wide">
                System Diagnostics & Telemetry
              </h2>
              <p className="text-xs text-gogreen-text-secondary mt-0.5">
                Host silicon telemetry, memory subsystems, load averages & kernel substrate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-gogreen-bg-elevated border border-gogreen-border text-xs font-mono">
              <span className="text-gogreen-text-secondary">Host OS Sensor:</span>
              <StatusIndicator
                status={isConnected ? 'online' : 'standby'}
                label={isConnected ? `${nativeHost?.runtime_environment || 'LINUX'} LINKED` : 'AWAITING LINK'}
              />
            </div>
          </div>
        </div>

        <div className="p-3">
          <Tabs
            tabs={[
              { id: 'host', label: 'Host System Info' },
              { id: 'processes', label: 'Process Hierarchy', badge: processes.length },
              { id: 'disk', label: 'Disk Partition I/O' },
              { id: 'network', label: 'Network Sockets' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </Card>

      {/* Host Specs and Diagnostics */}
      {activeTab === 'host' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border space-y-1">
              <div className="text-[10px] text-gogreen-text-secondary uppercase">
                Hardware Concurrency
              </div>
              <div className="text-xl font-bold text-gogreen-text-primary">
                {nativeCpu ? `${nativeCpu.physical_cores}P / ${nativeCpu.logical_cores}L Cores` : `${host.cores} Cores`}
              </div>
              <div className="text-[11px] text-gogreen-text-secondary truncate">
                {nativeCpu ? nativeCpu.brand : 'Detected via navigator interface'}
              </div>
            </div>

            <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border space-y-1">
              <div className="text-[10px] text-gogreen-text-secondary uppercase">
                Host Operating System
              </div>
              <div className="text-xl font-bold text-gogreen-bright truncate">
                {nativeHost ? `${nativeHost.os_name} (${nativeHost.runtime_environment})` : host.platform}
              </div>
              <div className="text-[11px] text-gogreen-text-secondary truncate">
                {nativeHost ? `Kernel ${nativeHost.os_release}` : 'Host kernel substrate'}
              </div>
            </div>

            <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border space-y-1">
              <div className="text-[10px] text-gogreen-text-secondary uppercase">
                Target Architecture
              </div>
              <div className="text-xl font-bold text-gogreen-text-primary uppercase">
                {nativeCpu?.architecture || host.arch}
              </div>
              <div className="text-[11px] text-gogreen-text-secondary">
                {nativeCpu ? `Vendor: ${nativeCpu.vendor}` : 'Instruction set pipeline'}
              </div>
            </div>

            <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border space-y-1">
              <div className="text-[10px] text-gogreen-text-secondary uppercase">
                Direct Telemetry Daemon
              </div>
              <div className={`text-xl font-bold ${isConnected ? 'text-gogreen-bright' : 'text-gogreen-text-secondary'}`}>
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </div>
              <div className="text-[11px] text-gogreen-text-secondary">
                {isConnected ? `127.0.0.1:8080 (v${daemonHealth?.engine_version})` : 'Waiting for connection'}
              </div>
            </div>
          </div>

          {/* Genuine Host Subsystem Inspection Grid */}
          {isConnected && nativeHost && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                title="Subsystem Memory Telemetry (/proc/meminfo)"
                subtitle="Live kernel memory allocations reported by Linux daemon"
                headerAction={
                  <Badge variant="primary" size="sm">
                    {Math.round(nativeHost.memory.total_bytes / (1024 * 1024))} MB Total
                  </Badge>
                }
              >
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-gogreen-border/60">
                    <span className="text-gogreen-text-secondary">Total Subsystem RAM:</span>
                    <strong className="text-gogreen-text-primary">
                      {(nativeHost.memory.total_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB ({Math.round(nativeHost.memory.total_bytes / (1024 * 1024))} MB)
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gogreen-border/60">
                    <span className="text-gogreen-text-secondary">Available Memory:</span>
                    <strong className="text-gogreen-bright">
                      {(nativeHost.memory.available_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB ({Math.round(nativeHost.memory.available_bytes / (1024 * 1024))} MB)
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gogreen-border/60">
                    <span className="text-gogreen-text-secondary">Free Memory:</span>
                    <strong className="text-gogreen-text-primary">
                      {Math.round(nativeHost.memory.free_bytes / (1024 * 1024))} MB
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-gogreen-text-secondary">Swap Utilization:</span>
                    <strong className="text-gogreen-text-primary">
                      {Math.round((nativeHost.memory.swap_total_bytes - nativeHost.memory.swap_free_bytes) / (1024 * 1024))} / {Math.round(nativeHost.memory.swap_total_bytes / (1024 * 1024))} MB
                    </strong>
                  </div>
                </div>
              </Card>

              <Card
                title="Kernel Substrate & Performance Counters"
                subtitle="POSIX system information and hardware PMC paranoid level"
                headerAction={
                  <Badge variant={nativeHost.perf_event_supported ? 'primary' : 'warning'} size="sm">
                    {nativeHost.perf_event_supported ? 'PMC Allowed' : 'Restricted'}
                  </Badge>
                }
              >
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-gogreen-border/60">
                    <span className="text-gogreen-text-secondary">Hostname:</span>
                    <strong className="text-gogreen-text-primary">{nativeHost.hostname}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gogreen-border/60">
                    <span className="text-gogreen-text-secondary">Load Averages (1m, 5m, 15m):</span>
                    <strong className="text-gogreen-bright">
                      {nativeHost.load_avg['1m'].toFixed(2)}, {nativeHost.load_avg['5m'].toFixed(2)}, {nativeHost.load_avg['15m'].toFixed(2)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gogreen-border/60">
                    <span className="text-gogreen-text-secondary">System Uptime:</span>
                    <strong className="text-gogreen-text-primary">{nativeHost.uptime_seconds} seconds</strong>
                  </div>
                  <div className="py-1.5">
                    <span className="text-gogreen-text-secondary block mb-1">PMC / perf_event Status:</span>
                    <span className="text-[11px] text-gogreen-bright font-medium">
                      {nativeHost.perf_event_status}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <Card title="Client Hardware User Agent" subtitle="Host environment identification">
            <div className="p-3 bg-gogreen-bg-main border border-gogreen-border rounded font-mono text-xs text-gogreen-text-secondary break-all select-all">
              {host.userAgent}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'processes' && (
        <Card title="Active System Processes" subtitle="Process table extracted via host /proc or Windows kernel API">
          <DataTable
            columns={processColumns}
            data={processes}
            keyExtractor={(item) => String(item.pid)}
            emptyTitle="Not connected to system process monitor"
            emptyDescription="Live process inspection requires active connection to the GoGreen native background daemon."
          />
        </Card>
      )}

      {activeTab === 'disk' && (
        <Card title="Disk Volumes & I/O Subsystem" subtitle="Mounted storage volumes and NVMe/SATA performance">
          <EmptyState
            type="unavailable"
            title="Service unavailable"
            description="Disk partition geometry and block device stats require root or administrative privileges on the native daemon."
          />
        </Card>
      )}

      {activeTab === 'network' && (
        <Card title="Network Interfaces & Sockets" subtitle="Hardware network controllers and socket connections">
          <EmptyState
            type="unavailable"
            title="Service unavailable"
            description="Interface socket tables and raw packet capture require native daemon network capability."
          />
        </Card>
      )}
    </div>
  );
};
