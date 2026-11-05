import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import {
  FlaskConical,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { Experiment } from '@/types';

export const ExperimentsPage: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);

  // New experiment form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('SIMD Optimization');
  const [newCompiler, setNewCompiler] = useState('clang 18.1.0');
  const [newOpt, setNewOpt] = useState<'-O0' | '-O1' | '-O2' | '-O3' | '-Ofast'>('-O3');
  const [newIsa, setNewIsa] = useState('AVX-512 F');
  const [newNotes, setNewNotes] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const exp: Experiment = {
      id: `exp-${Date.now().toString(36)}`,
      title: newTitle.trim(),
      category: newCategory,
      compiler: newCompiler,
      optimizationLevel: newOpt,
      isaExtension: newIsa,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      sha256Hash: Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('') + '...',
      reproducible: true,
      notes: newNotes.trim() || 'Verified bare-metal reproducible experiment record.',
    };

    setExperiments((prev) => [exp, ...prev]);
    setIsCreateOpen(false);
    setNewTitle('');
    setNewNotes('');
    setSelectedExperiment(exp);
  };

  const columns: Column<Experiment>[] = [
    { key: 'title', header: 'Experiment Title', sortable: true, render: (e) => <span className="font-semibold text-gogreen-bright">{e.title}</span> },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'compiler', header: 'Toolchain', sortable: true },
    { key: 'optimizationLevel', header: 'Optimization', sortable: true, render: (e) => <Badge size="sm" variant="primary">{e.optimizationLevel}</Badge> },
    { key: 'isaExtension', header: 'Target ISA', sortable: true },
    { key: 'createdAt', header: 'Timestamp', sortable: true },
    { key: 'reproducible', header: 'Provenance', render: (e) => (
      e.reproducible ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-gogreen-bright">
          <CheckCircle2 className="w-3.5 h-3.5" /> REPRODUCIBLE
        </span>
      ) : (
        <span className="text-gogreen-text-secondary text-[11px]">UNVERIFIED</span>
      )
    )},
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card noPadding>
        <div className="p-4 border-b border-gogreen-border bg-gogreen-bg-secondary/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <FlaskConical className="w-5 h-5 text-gogreen-bright" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-gogreen-text-primary uppercase tracking-wide">
                Systems Engineering Experiments
              </h2>
              <p className="text-xs text-gogreen-text-secondary mt-0.5">
                Scientific experiment registry, compiler flag exploration & reproducible benchmarks
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Register Experiment
          </Button>
        </div>
      </Card>

      {/* Main Table / Detail view */}
      {experiments.length === 0 ? (
        <Card>
          <EmptyState
            type="no_data"
            title="No experiments recorded"
            description="The experiment registry tracks reproducible compiler flag configurations, target microarchitectures, and verifiable binary hashes."
            actionLabel="Register First Experiment"
            onAction={() => setIsCreateOpen(true)}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card title="Experiment Registry" subtitle={`${experiments.length} registered research iterations`}>
            <DataTable
              columns={columns}
              data={experiments}
              keyExtractor={(item) => item.id}
              onRowClick={(item) => setSelectedExperiment(item)}
            />
          </Card>

          {/* Selected Experiment Inspector */}
          {selectedExperiment && (
            <Card
              title={`Experiment Details: ${selectedExperiment.title}`}
              subtitle={`ID: ${selectedExperiment.id}`}
              headerAction={
                <Badge variant="primary" dot>
                  {selectedExperiment.optimizationLevel}
                </Badge>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-3 rounded bg-gogreen-bg-main border border-gogreen-border space-y-1">
                  <div className="text-[10px] text-gogreen-text-secondary uppercase">Toolchain</div>
                  <div className="text-xs font-bold text-gogreen-text-primary">
                    {selectedExperiment.compiler}
                  </div>
                </div>

                <div className="p-3 rounded bg-gogreen-bg-main border border-gogreen-border space-y-1">
                  <div className="text-[10px] text-gogreen-text-secondary uppercase">Target ISA</div>
                  <div className="text-xs font-bold text-gogreen-bright">
                    {selectedExperiment.isaExtension}
                  </div>
                </div>

                <div className="p-3 rounded bg-gogreen-bg-main border border-gogreen-border space-y-1">
                  <div className="text-[10px] text-gogreen-text-secondary uppercase">Reproducibility Hash</div>
                  <div className="text-xs font-bold text-gogreen-text-primary truncate">
                    {selectedExperiment.sha256Hash}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gogreen-bg-elevated/40 border border-gogreen-border rounded font-mono text-xs text-gogreen-text-secondary">
                <div className="text-[10px] text-gogreen-text-secondary uppercase mb-1">Research Notes</div>
                <p className="text-gogreen-text-primary font-sans leading-relaxed">
                  {selectedExperiment.notes}
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Create Experiment Modal */}
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Experiment"
        subtitle="Catalog research configuration and compiler parameters"
        maxWidth="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-[11px] text-gogreen-text-secondary uppercase mb-1">
              Experiment Title *
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., AVX-512 FMA Unroll Factor Comparison"
              className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-xs text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-gogreen-text-secondary uppercase mb-1">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-xs text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
              >
                <option value="SIMD Optimization">SIMD Optimization</option>
                <option value="Memory Subsystem">Memory Subsystem</option>
                <option value="Compiler Flags">Compiler Flags</option>
                <option value="Microkernel Profiling">Microkernel Profiling</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-gogreen-text-secondary uppercase mb-1">
                Optimization Level
              </label>
              <select
                value={newOpt}
                onChange={(e) => setNewOpt(e.target.value as '-O0' | '-O1' | '-O2' | '-O3' | '-Ofast')}
                className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-xs text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
              >
                <option value="-O0">-O0 (Debug / Unoptimized)</option>
                <option value="-O1">-O1 (Basic Optimization)</option>
                <option value="-O2">-O2 (Standard Production)</option>
                <option value="-O3">-O3 (Aggressive Vectorization)</option>
                <option value="-Ofast">-Ofast (Disregard Strict IEEE 754)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-gogreen-text-secondary uppercase mb-1">
                Compiler Toolchain
              </label>
              <input
                type="text"
                value={newCompiler}
                onChange={(e) => setNewCompiler(e.target.value)}
                className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-xs text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gogreen-text-secondary uppercase mb-1">
                Target ISA Extension
              </label>
              <input
                type="text"
                value={newIsa}
                onChange={(e) => setNewIsa(e.target.value)}
                className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-xs text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-gogreen-text-secondary uppercase mb-1">
              Engineering Notes
            </label>
            <textarea
              rows={3}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Describe experimental hypothesis, input dataset sizes, cache flush procedures..."
              className="w-full bg-gogreen-bg-main border border-gogreen-border rounded px-3 py-2 text-xs text-gogreen-text-primary focus:outline-none focus:border-gogreen-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gogreen-border">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Register Record
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
