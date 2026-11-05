import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CodeViewer } from '@/components/terminal/CodeViewer';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import {
  Cpu,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  getHostHardwareInfo,
  getInstructionSetFeatures,
  standardAssemblyRoutines,
} from '@/services/systemService';
import { AssemblyRoutine } from '@/types';

export const CoreEnginePage: React.FC = () => {
  const host = getHostHardwareInfo();
  const features = getInstructionSetFeatures(host.arch);
  const [selectedRoutine, setSelectedRoutine] = useState<AssemblyRoutine>(standardAssemblyRoutines[0]!);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const handleExecuteBenchmark = () => {
    setIsExecuting(true);
    setExecutionMessage(null);
    setTimeout(() => {
      setIsExecuting(false);
      setExecutionMessage(
        'Execution halted: Native engine daemon is not connected. Connect native daemon at ipc:///tmp/gogreen-native.sock to run bare-metal benchmarks.'
      );
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: CPU Architecture & Silicon Characteristics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card noPadding>
          <div className="p-4">
            <div className="text-[11px] font-mono text-gogreen-text-secondary uppercase">
              Host Architecture
            </div>
            <div className="text-xl font-mono font-bold text-gogreen-bright mt-1 uppercase flex items-center gap-2">
              <Cpu className="w-5 h-5 text-gogreen-primary" />
              {host.arch}
            </div>
            <div className="text-[11px] text-gogreen-text-secondary mt-1 truncate">
              {host.platform}
            </div>
          </div>
          <div className="px-4 py-2 bg-gogreen-bg-secondary/40 border-t border-gogreen-border/60 text-[11px] font-mono flex justify-between">
            <span className="text-gogreen-text-secondary">Execution Model</span>
            <span className="text-gogreen-text-primary">Out-of-Order Speculative</span>
          </div>
        </Card>

        <Card noPadding>
          <div className="p-4">
            <div className="text-[11px] font-mono text-gogreen-text-secondary uppercase">
              Logical Core Count
            </div>
            <div className="text-xl font-mono font-bold text-gogreen-text-primary mt-1">
              {host.cores} Threads
            </div>
            <div className="text-[11px] text-gogreen-text-secondary mt-1">
              Hardware concurrency level
            </div>
          </div>
          <div className="px-4 py-2 bg-gogreen-bg-secondary/40 border-t border-gogreen-border/60 text-[11px] font-mono flex justify-between">
            <span className="text-gogreen-text-secondary">Vector Register Width</span>
            <span className="text-gogreen-bright font-semibold">
              {host.arch === 'x86_64' ? '512-bit (AVX-512)' : '128/256-bit (NEON/SVE)'}
            </span>
          </div>
        </Card>

        <Card noPadding>
          <div className="p-4">
            <div className="text-[11px] font-mono text-gogreen-text-secondary uppercase">
              Native Daemon State
            </div>
            <div className="text-xl font-mono font-bold text-gogreen-text-secondary mt-1 flex items-center gap-2">
              <StatusIndicator status="offline" />
              NOT CONNECTED
            </div>
            <div className="text-[11px] text-gogreen-text-secondary mt-1">
              IPC socket offline
            </div>
          </div>
          <div className="px-4 py-2 bg-gogreen-bg-secondary/40 border-t border-gogreen-border/60 text-[11px] font-mono flex justify-between">
            <span className="text-gogreen-text-secondary">Socket Endpoint</span>
            <span className="text-gogreen-text-primary">ipc:///tmp/gogreen-native.sock</span>
          </div>
        </Card>
      </div>

      {/* Main Split: Supported Instruction Sets & Assembly Routine Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supported SIMD / Hardware Instruction Matrix */}
        <div className="space-y-4">
          <Card
            title="Instruction Set Architecture (ISA)"
            subtitle="Detected microarchitectural vector & crypto capabilities"
          >
            <div className="space-y-2.5 font-mono text-xs">
              {features.map((feat) => (
                <div
                  key={feat.name}
                  className="p-2.5 rounded bg-gogreen-bg-main border border-gogreen-border/60 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gogreen-text-primary">{feat.name}</span>
                      <Badge size="sm" variant="neutral">
                        {feat.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gogreen-text-secondary mt-1 font-sans leading-tight">
                      {feat.description}
                    </p>
                  </div>
                  <div>
                    {feat.supported ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gogreen-bright font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        SUPPORTED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gogreen-text-secondary">
                        <XCircle className="w-3.5 h-3.5" />
                        ABSENT
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Assembly Routine Inventory & Code Inspection */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title="Assembly Routine Inventory"
            subtitle="Native optimized microkernels targeting deep hardware execution"
            headerAction={
              <Badge variant="primary" dot>
                {standardAssemblyRoutines.length} Routines
              </Badge>
            }
          >
            {/* Selector list */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-4 border-b border-gogreen-border/60">
              {standardAssemblyRoutines.map((routine) => {
                const isSelected = routine.id === selectedRoutine.id;
                return (
                  <button
                    key={routine.id}
                    onClick={() => {
                      setSelectedRoutine(routine);
                      setExecutionMessage(null);
                    }}
                    className={`p-3 rounded border text-left transition-all font-mono ${
                      isSelected
                        ? 'bg-gogreen-bg-elevated border-gogreen-primary text-gogreen-bright shadow-glow-sm'
                        : 'bg-gogreen-bg-main border-gogreen-border text-gogreen-text-secondary hover:text-gogreen-text-primary hover:border-gogreen-border/80'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{routine.name}</div>
                    <div className="text-[10px] text-gogreen-text-secondary mt-0.5 uppercase">
                      {routine.targetArch} • {routine.isaRequirement}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Routine Details */}
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-mono text-sm font-bold text-gogreen-text-primary">
                    {selectedRoutine.name}
                  </h4>
                  <p className="text-xs text-gogreen-text-secondary mt-0.5">
                    {selectedRoutine.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Play className="w-3 h-3" />}
                    onClick={handleExecuteBenchmark}
                    disabled={isExecuting}
                  >
                    {isExecuting ? 'Dispatching...' : 'Dispatch to Daemon'}
                  </Button>
                </div>
              </div>

              {/* Technical Footprint Badges */}
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <span className="px-2 py-1 bg-gogreen-bg-elevated border border-gogreen-border rounded text-gogreen-text-secondary">
                  Instruction Count: <strong className="text-gogreen-text-primary">{selectedRoutine.instructionCount}</strong>
                </span>
                <span className="px-2 py-1 bg-gogreen-bg-elevated border border-gogreen-border rounded text-gogreen-text-secondary">
                  Register Pressure: <strong className="text-gogreen-text-primary">{selectedRoutine.registerFootprint}</strong>
                </span>
                <span className="px-2 py-1 bg-gogreen-bg-elevated border border-gogreen-border rounded text-gogreen-text-secondary">
                  Target ISA: <strong className="text-gogreen-bright">{selectedRoutine.isaRequirement}</strong>
                </span>
              </div>

              {/* Execution Feedback Banner if Attempted */}
              {executionMessage && (
                <div className="p-3 bg-gogreen-warning/10 border border-gogreen-warning/30 rounded text-xs font-mono text-gogreen-warning flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{executionMessage}</span>
                </div>
              )}

              {/* Code Viewer */}
              <CodeViewer
                code={selectedRoutine.codeSnippet}
                language="assembly"
                title={`${selectedRoutine.name}.s`}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
