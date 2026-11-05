import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable, Column } from '@/components/ui/DataTable';
import {
  Activity,
} from 'lucide-react';
import { getHostHardwareInfo } from '@/services/systemService';
import { SystemProcess } from '@/types';

export const SystemMonitorPage: React.FC = () => {
  const host = getHostHardwareInfo();
  const [activeTab, setActiveTab] = useState('host');
  const [processes] = useState<SystemProcess[]>([]);

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
                Host silicon telemetry, memory subsystems, disk I/O & process table
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-gogreen-bg-elevated border border-gogreen-border text-xs font-mono">
              <span className="text-gogreen-text-secondary">Host OS Sensor:</span>
              <StatusIndicator status="standby" label="AWAITING LINK" />
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
                {host.cores} Cores
              </div>
              <div className="text-[11px] text-gogreen-text-secondary">
                Detected via navigator interface
              </div>
            </div>

            <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border space-y-1">
              <div className="text-[10px] text-gogreen-text-secondary uppercase">
                Host Operating System
              </div>
              <div className="text-xl font-bold text-gogreen-bright truncate">
                {host.platform}
              </div>
              <div className="text-[11px] text-gogreen-text-secondary">
                Host kernel substrate
              </div>
            </div>

            <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border space-y-1">
              <div className="text-[10px] text-gogreen-text-secondary uppercase">
                Target Architecture
              </div>
              <div className="text-xl font-bold text-gogreen-text-primary uppercase">
                {host.arch}
              </div>
              <div className="text-[11px] text-gogreen-text-secondary">
                Instruction set pipeline
              </div>
            </div>

            <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border space-y-1">
              <div className="text-[10px] text-gogreen-text-secondary uppercase">
                Direct Telemetry Daemon
              </div>
              <div className="text-xl font-bold text-gogreen-text-secondary">
                OFFLINE
              </div>
              <div className="text-[11px] text-gogreen-text-secondary">
                Waiting for connection
              </div>
            </div>
          </div>

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
