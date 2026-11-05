import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import {
  Gauge,
  Play,
} from 'lucide-react';
import { BenchmarkResult } from '@/types';

export const ProfilerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('benchmarks');
  const [benchmarks] = useState<BenchmarkResult[]>([]);
  const [benchmarkStatus, setBenchmarkStatus] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleRunSuite = () => {
    setIsExecuting(true);
    setBenchmarkStatus(null);
    setTimeout(() => {
      setIsExecuting(false);
      setBenchmarkStatus(
        'Execution blocked: Native engine daemon is not connected. Connect the daemon to access cycle-accurate performance counters (PMC).'
      );
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Profiler Controls Header */}
      <Card noPadding>
        <div className="p-4 border-b border-gogreen-border bg-gogreen-bg-secondary/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <Gauge className="w-5 h-5 text-gogreen-bright" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-gogreen-text-primary uppercase tracking-wide">
                Microarchitectural Profiler
              </h2>
              <p className="text-xs text-gogreen-text-secondary mt-0.5">
                Bare-metal cycle measurement, instruction retirement & memory bus saturation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-gogreen-bg-elevated border border-gogreen-border text-xs font-mono">
              <span className="text-gogreen-text-secondary">PMC Probes:</span>
              <StatusIndicator status="offline" label="OFFLINE" />
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="w-3.5 h-3.5" />}
              onClick={handleRunSuite}
              disabled={isExecuting}
            >
              {isExecuting ? 'Querying...' : 'Run Benchmark Suite'}
            </Button>
          </div>
        </div>

        {benchmarkStatus && (
          <div className="p-3 bg-gogreen-warning/10 border-b border-gogreen-warning/30 text-xs font-mono text-gogreen-warning flex items-center justify-between">
            <span>{benchmarkStatus}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBenchmarkStatus(null)}
              className="text-gogreen-warning hover:text-gogreen-primary"
            >
              Dismiss
            </Button>
          </div>
        )}

        <div className="p-3">
          <Tabs
            tabs={[
              { id: 'benchmarks', label: 'Benchmark Suite', badge: benchmarks.length },
              { id: 'latency', label: 'Execution Latency' },
              { id: 'memory', label: 'Memory Bus Saturation' },
              { id: 'comparison', label: 'Compiler Delta Comparison' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </Card>

      {/* Main Content Area */}
      {benchmarks.length === 0 ? (
        <Card>
          <EmptyState
            type="no_data"
            title="No benchmark results available"
            description="No benchmark runs have been executed or imported yet. Connect the GoGreen native engine or launch a test workload."
            actionLabel="Dispatch Microbenchmark"
            onAction={handleRunSuite}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active charts and results if available */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Instruction Retirement Rate (IPC)">
              <LineChart data={[]} unit=" IPC" height={220} />
            </Card>
            <Card title="L1/L2 Cache Miss Distribution">
              <BarChart data={[]} unit=" %" height={220} />
            </Card>
          </div>
        </div>
      )}

      {/* Benchmark Specimen Profiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gogreen-text-primary">AVX-512 GEMM Test</span>
            <Badge size="sm" variant="neutral">CPU</Badge>
          </div>
          <p className="text-[11px] text-gogreen-text-secondary font-sans leading-tight">
            Measures 512-bit vector FMA instruction pipeline efficiency and port contention.
          </p>
          <div className="text-[10px] text-gogreen-text-secondary pt-1 border-t border-gogreen-border/50 flex justify-between">
            <span>Target Loop</span>
            <span className="text-gogreen-bright">10,000,000 Iterations</span>
          </div>
        </div>

        <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gogreen-text-primary">Non-Temporal Memcpy</span>
            <Badge size="sm" variant="neutral">Memory</Badge>
          </div>
          <p className="text-[11px] text-gogreen-text-secondary font-sans leading-tight">
            Evaluates stream-store DDR bus write bandwidth bypassing L1/L2 cache lines.
          </p>
          <div className="text-[10px] text-gogreen-text-secondary pt-1 border-t border-gogreen-border/50 flex justify-between">
            <span>Buffer Size</span>
            <span className="text-gogreen-bright">1,024 MB Streaming</span>
          </div>
        </div>

        <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gogreen-text-primary">Branch Predictor Pressure</span>
            <Badge size="sm" variant="neutral">Microarch</Badge>
          </div>
          <p className="text-[11px] text-gogreen-text-secondary font-sans leading-tight">
            Assesses branch target buffer (BTB) recovery latency under pseudo-random jump sequences.
          </p>
          <div className="text-[10px] text-gogreen-text-secondary pt-1 border-t border-gogreen-border/50 flex justify-between">
            <span>Jump Table</span>
            <span className="text-gogreen-bright">65,536 Unpredictable Branches</span>
          </div>
        </div>
      </div>
    </div>
  );
};
