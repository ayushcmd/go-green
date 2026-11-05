import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Dialog } from '@/components/ui/Dialog';
import {
  Network,
  Plus,
} from 'lucide-react';
import { WorkerNode, MeshJob } from '@/types';

export const DistributedMeshPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('workers');
  const [workers] = useState<WorkerNode[]>([]);
  const [jobs] = useState<MeshJob[]>([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header Mesh Controls */}
      <Card noPadding>
        <div className="p-4 border-b border-gogreen-border bg-gogreen-bg-secondary/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <Network className="w-5 h-5 text-gogreen-bright" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-gogreen-text-primary uppercase tracking-wide">
                Distributed Compute Mesh
              </h2>
              <p className="text-xs text-gogreen-text-secondary mt-0.5">
                Heterogeneous worker cluster orchestration via gRPC & mutual TLS (mTLS)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-gogreen-bg-elevated border border-gogreen-border text-xs font-mono">
              <span className="text-gogreen-text-secondary">Coordinator:</span>
              <StatusIndicator status="standby" label="LISTENING" />
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsRegisterModalOpen(true)}
            >
              Register Node
            </Button>
          </div>
        </div>

        <div className="p-3">
          <Tabs
            tabs={[
              { id: 'workers', label: 'Worker Node Registry', badge: workers.length },
              { id: 'topology', label: 'Network Mesh Topology' },
              { id: 'queue', label: 'Workload Scheduler Queue', badge: jobs.length },
              { id: 'history', label: 'Job Execution History' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </Card>

      {/* Main Tab Content */}
      {activeTab === 'workers' && (
        <div className="space-y-6">
          {workers.length === 0 ? (
            <Card>
              <EmptyState
                type="no_workers"
                title="No workers connected"
                description="There are currently no distributed worker nodes registered with the mesh coordinator on grpc://localhost:50051."
                actionLabel="Worker Connection Instructions"
                onAction={() => setIsRegisterModalOpen(true)}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Connected worker cards */}
            </div>
          )}
        </div>
      )}

      {activeTab === 'topology' && (
        <Card title="Mesh Network Topology" subtitle="Dynamic cluster node interconnection map">
          <div className="p-8 border border-dashed border-gogreen-border rounded bg-gogreen-bg-main flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gogreen-bg-elevated border border-gogreen-border flex items-center justify-center">
              <Network className="w-8 h-8 text-gogreen-text-secondary/50" />
            </div>
            <div>
              <div className="font-mono text-sm font-semibold text-gogreen-text-primary uppercase">
                Coordinator Standby
              </div>
              <p className="text-xs text-gogreen-text-secondary max-w-sm mt-1">
                The mesh coordinator is actively listening on port 50051. Once worker nodes establish mutual TLS handshakes, dynamic latency routing will appear here.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setIsRegisterModalOpen(true)}>
              Join a Worker Node
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'queue' && (
        <Card title="Workload Queue" subtitle="Priority-based task dispatcher">
          <EmptyState
            type="no_data"
            title="Workload queue empty"
            description="No distributed tasks are waiting for scheduling. Submit a parallel compilation or benchmarking job to dispatch."
          />
        </Card>
      )}

      {activeTab === 'history' && (
        <Card title="Execution History" subtitle="Audit trail of distributed runs">
          <EmptyState
            type="no_data"
            title="No execution history"
            description="Completed distributed jobs and resource allocation traces will be logged here."
          />
        </Card>
      )}

      {/* Register Worker Instruction Modal */}
      <Dialog
        open={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Connect Distributed Mesh Worker"
        subtitle="Command-line daemon registration instructions"
        maxWidth="lg"
      >
        <div className="space-y-4 font-mono text-xs">
          <p className="text-gogreen-text-secondary font-sans leading-relaxed">
            Run the GoGreen worker daemon on any target x86_64 or ARM64 host. The worker will automatically register its hardware topology with the coordinator:
          </p>

          <div className="p-3 bg-gogreen-bg-main border border-gogreen-border rounded select-all text-gogreen-bright text-[11px] leading-relaxed">
            # Start worker daemon on target node<br />
            ./gogreen-worker --coordinator=grpc://127.0.0.1:50051 \<br />
            &nbsp;&nbsp;--tls-cert=/etc/gogreen/worker.crt \<br />
            &nbsp;&nbsp;--tls-key=/etc/gogreen/worker.key \<br />
            &nbsp;&nbsp;--cores=16 --affinity=pinned
          </div>

          <div className="p-3 bg-gogreen-bg-panel border border-gogreen-border rounded space-y-2">
            <div className="text-[11px] font-bold text-gogreen-text-primary uppercase">
              Coordinator Network Parameters
            </div>
            <div className="flex justify-between text-[11px] text-gogreen-text-secondary border-b border-gogreen-border/50 pb-1">
              <span>Binding Interface</span>
              <span className="text-gogreen-text-primary">0.0.0.0:50051</span>
            </div>
            <div className="flex justify-between text-[11px] text-gogreen-text-secondary border-b border-gogreen-border/50 pb-1">
              <span>Protocol</span>
              <span className="text-gogreen-text-primary">HTTP/2 (gRPC)</span>
            </div>
            <div className="flex justify-between text-[11px] text-gogreen-text-secondary">
              <span>Heartbeat Interval</span>
              <span className="text-gogreen-text-primary">1,000 ms</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsRegisterModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
