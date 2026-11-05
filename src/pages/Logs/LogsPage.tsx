import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Tabs } from '@/components/ui/Tabs';
import {
  ScrollText,
  Download,
  Trash2,
} from 'lucide-react';
import { systemLogsSeed } from '@/services/systemService';
import { LogEntry } from '@/types';

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>(systemLogsSeed);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState('logs');

  const services = useMemo(() => {
    const s = new Set(logs.map((l) => l.service));
    return ['ALL', ...Array.from(s)];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchQuery =
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.service.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSeverity = severityFilter === 'ALL' || log.level === severityFilter;
      const matchService = serviceFilter === 'ALL' || log.service === serviceFilter;
      return matchQuery && matchSeverity && matchService;
    });
  }, [logs, searchQuery, severityFilter, serviceFilter]);

  const handleExport = () => {
    const content = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gogreen-logs-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Logs Controls Header */}
      <Card noPadding>
        <div className="p-4 border-b border-gogreen-border bg-gogreen-bg-secondary/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <ScrollText className="w-5 h-5 text-gogreen-bright" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-gogreen-text-primary uppercase tracking-wide">
                Structured Telemetry Logs & Traces
              </h2>
              <p className="text-xs text-gogreen-text-secondary mt-0.5">
                Real-time daemon events, binary parser traces & kernel audit streams
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExport}
            >
              Export JSON
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setLogs([])}
            >
              Clear Log
            </Button>
          </div>
        </div>

        <div className="p-3">
          <Tabs
            tabs={[
              { id: 'logs', label: 'Structured Log Stream', badge: filteredLogs.length },
              { id: 'traces', label: 'Distributed Tracing Spans' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </Card>

      {/* Main Tab Content */}
      {activeTab === 'logs' && (
        <Card noPadding>
          {/* Filters Bar */}
          <div className="p-3 border-b border-gogreen-border bg-gogreen-bg-main/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[200px] max-w-sm">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search log messages or services..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="text-[11px] text-gogreen-text-secondary uppercase">Severity:</span>
              {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSeverityFilter(lvl)}
                  className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                    severityFilter === lvl
                      ? 'bg-gogreen-bg-elevated border-gogreen-primary text-gogreen-bright'
                      : 'border-gogreen-border text-gogreen-text-secondary hover:text-gogreen-text-primary'
                  }`}
                >
                  {lvl}
                </button>
              ))}

              <div className="border-l border-gogreen-border pl-2 flex items-center gap-1">
                <span className="text-[11px] text-gogreen-text-secondary uppercase">Service:</span>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="bg-gogreen-bg-elevated border border-gogreen-border rounded px-2 py-1 text-[11px] text-gogreen-text-primary focus:outline-none"
                >
                  {services.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Log List View */}
          <div className="divide-y divide-gogreen-border/40 font-mono text-xs max-h-[550px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-gogreen-text-secondary">
                No log entries match the selected filters.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 hover:bg-gogreen-bg-elevated/40 transition-colors flex items-start gap-3"
                >
                  <span className="text-gogreen-text-secondary text-[11px] shrink-0 select-none">
                    {log.timestamp}
                  </span>

                  <Badge
                    size="sm"
                    variant={
                      log.level === 'WARN'
                        ? 'warning'
                        : log.level === 'ERROR'
                        ? 'error'
                        : 'primary'
                    }
                    className="shrink-0"
                  >
                    {log.level}
                  </Badge>

                  <span className="text-gogreen-text-secondary text-[11px] shrink-0 font-semibold px-1 rounded bg-gogreen-bg-elevated border border-gogreen-border">
                    {log.service}
                  </span>

                  <span className="text-gogreen-text-primary flex-1 break-words">
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {activeTab === 'traces' && (
        <Card title="Distributed Trace Waterfall" subtitle="Microsecond span analysis across services">
          <div className="p-6 border border-dashed border-gogreen-border rounded bg-gogreen-bg-main font-mono text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gogreen-border/60">
              <span className="font-bold text-gogreen-text-primary">
                Span: laboratory_boot_sequence (Total: 42.8 ms)
              </span>
              <Badge variant="primary">COMPLETE</Badge>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-gogreen-text-secondary">
                  <span>1. hardware_concurrency_probe</span>
                  <span>1.2 ms</span>
                </div>
                <div className="h-2 rounded bg-gogreen-bg-elevated overflow-hidden">
                  <div className="h-full bg-gogreen-primary w-[8%]" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-gogreen-text-secondary">
                  <span>2. binary_vector_decoder_init</span>
                  <span>12.4 ms</span>
                </div>
                <div className="h-2 rounded bg-gogreen-bg-elevated overflow-hidden pl-[8%]">
                  <div className="h-full bg-gogreen-bright w-[28%]" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-gogreen-text-secondary">
                  <span>3. coordinator_socket_poll (ipc:///tmp/gogreen-native.sock)</span>
                  <span>29.2 ms</span>
                </div>
                <div className="h-2 rounded bg-gogreen-bg-elevated overflow-hidden pl-[36%]">
                  <div className="h-full bg-gogreen-warning w-[64%]" />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
