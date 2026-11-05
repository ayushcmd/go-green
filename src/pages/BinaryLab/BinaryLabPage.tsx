import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, Column } from '@/components/ui/DataTable';
import { HexViewer } from '@/components/terminal/HexViewer';
import {
  BinaryAnalysisResult,
  BinarySection,
  BinarySymbol,
  DisassemblyInstruction,
} from '@/types';
import {
  parseBinaryBuffer,
  generateSpecimenElf,
  calculateSha256,
} from '@/services/binaryParser';
import {
  Upload,
  RefreshCw,
} from 'lucide-react';
import { formatBytes } from '@/utils/cn';

export const BinaryLabPage: React.FC = () => {
  const [analysis, setAnalysis] = useState<BinaryAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState('sections');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<string[]>(['gogreen-core-x86_64.elf']);

  // Load standard specimen on first mount
  useEffect(() => {
    const specimen = generateSpecimenElf();
    const result = parseBinaryBuffer(specimen, 'gogreen-core-x86_64.elf');
    calculateSha256(specimen).then((hash) => {
      setAnalysis({ ...result, sha256: hash });
    });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseBinaryBuffer(buffer, file.name);
      const hash = await calculateSha256(buffer);
      setAnalysis({ ...result, sha256: hash });
      setAnalysisHistory((prev) => [file.name, ...prev.filter((n) => n !== file.name)].slice(0, 5));
    } catch (err) {
      console.error('Binary parse error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSampleElf = async () => {
    setIsProcessing(true);
    const specimen = generateSpecimenElf();
    const result = parseBinaryBuffer(specimen, 'gogreen-core-x86_64.elf');
    const hash = await calculateSha256(specimen);
    setAnalysis({ ...result, sha256: hash });
    setIsProcessing(false);
  };

  const sectionColumns: Column<BinarySection>[] = [
    { key: 'name', header: 'Section Name', sortable: true, render: (s) => <span className="font-semibold text-gogreen-bright">{s.name}</span> },
    { key: 'virtualAddress', header: 'Virtual Address', sortable: true },
    { key: 'virtualSize', header: 'Virtual Size', sortable: true, render: (s) => formatBytes(s.virtualSize) },
    { key: 'rawSize', header: 'Raw Size', sortable: true, render: (s) => formatBytes(s.rawSize) },
    { key: 'entropy', header: 'Entropy', sortable: true, render: (s) => (
      <span className={s.entropy > 7.0 ? 'text-gogreen-warning font-semibold' : 'text-gogreen-text-primary'}>
        {s.entropy.toFixed(2)}
      </span>
    )},
    { key: 'flags', header: 'Flags', render: (s) => (
      <div className="flex gap-1">
        {s.isExecutable && <Badge variant="primary" size="sm">EXEC</Badge>}
        {s.isWritable && <Badge variant="warning" size="sm">WRITE</Badge>}
        {!s.isExecutable && !s.isWritable && <Badge variant="neutral" size="sm">RO</Badge>}
      </div>
    )},
  ];

  const symbolColumns: Column<BinarySymbol>[] = [
    { key: 'name', header: 'Symbol Identifier', sortable: true, render: (s) => <span className="font-semibold text-gogreen-text-primary">{s.name}</span> },
    { key: 'address', header: 'Address', sortable: true },
    { key: 'size', header: 'Size (Bytes)', sortable: true },
    { key: 'type', header: 'Type', sortable: true, render: (s) => (
      <Badge size="sm" variant={s.type === 'FUNC' ? 'primary' : 'neutral'}>{s.type}</Badge>
    )},
    { key: 'binding', header: 'Binding', sortable: true },
    { key: 'section', header: 'Section' },
  ];

  const disassemblyColumns: Column<DisassemblyInstruction>[] = [
    { key: 'address', header: 'Address', width: '120px' },
    { key: 'bytes', header: 'Opcode Bytes', width: '150px', render: (d) => <span className="text-gogreen-text-secondary">{d.bytes}</span> },
    { key: 'mnemonic', header: 'Instruction', width: '120px', render: (d) => <span className="text-gogreen-bright font-bold">{d.mnemonic}</span> },
    { key: 'operands', header: 'Operands', render: (d) => <span className="text-gogreen-text-primary">{d.operands}</span> },
    { key: 'comment', header: 'Disassembly Analysis', render: (d) => d.comment ? <span className="text-gogreen-text-secondary/70 italic">// {d.comment}</span> : null },
  ];

  return (
    <div className="space-y-6">
      {/* File Upload and Specimen Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Upload box */}
        <div className="lg:col-span-3">
          <label className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gogreen-bg-panel border border-dashed border-gogreen-border hover:border-gogreen-primary/60 rounded cursor-pointer transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gogreen-bg-elevated border border-gogreen-border group-hover:border-gogreen-primary/50 rounded">
                <Upload className="w-5 h-5 text-gogreen-bright" />
              </div>
              <div>
                <div className="font-mono text-xs font-semibold text-gogreen-text-primary uppercase tracking-wide group-hover:text-gogreen-bright">
                  Load Executable Binary (ELF, PE, Mach-O or Raw)
                </div>
                <div className="text-[11px] text-gogreen-text-secondary mt-0.5">
                  Select a local binary for client-side structure decoding and hex inspection
                </div>
              </div>
            </div>
            <div className="mt-3 sm:mt-0">
              <span className="px-3 py-1 bg-gogreen-bg-elevated border border-gogreen-border rounded text-xs font-mono text-gogreen-text-primary group-hover:bg-gogreen-primary group-hover:text-gogreen-bg-main transition-colors">
                Browse File
              </span>
            </div>
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Specimen preset & history */}
        <Card noPadding>
          <div className="p-3 border-b border-gogreen-border bg-gogreen-bg-secondary/40 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-gogreen-text-secondary">
              Specimen Presets
            </span>
            <Button size="sm" variant="ghost" onClick={handleLoadSampleElf} disabled={isProcessing}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
          <div className="p-2 space-y-1 font-mono text-xs">
            {analysisHistory.map((name) => (
              <button
                key={name}
                onClick={handleLoadSampleElf}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-gogreen-bg-elevated text-gogreen-text-secondary hover:text-gogreen-bright flex items-center justify-between transition-colors truncate"
              >
                <span className="truncate">{name}</span>
                <span className="text-[9px] uppercase px-1 rounded bg-gogreen-bg-main text-gogreen-text-secondary">
                  Active
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Binary Metadata Header Cards */}
      {analysis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-gogreen-bg-panel border border-gogreen-border rounded p-3 font-mono">
            <div className="text-[10px] text-gogreen-text-secondary uppercase">Binary File</div>
            <div className="text-xs font-bold text-gogreen-text-primary mt-1 truncate" title={analysis.fileName}>
              {analysis.fileName}
            </div>
          </div>

          <div className="bg-gogreen-bg-panel border border-gogreen-border rounded p-3 font-mono">
            <div className="text-[10px] text-gogreen-text-secondary uppercase">Format</div>
            <div className="text-xs font-bold text-gogreen-bright mt-1">{analysis.format}</div>
          </div>

          <div className="bg-gogreen-bg-panel border border-gogreen-border rounded p-3 font-mono">
            <div className="text-[10px] text-gogreen-text-secondary uppercase">Architecture</div>
            <div className="text-xs font-bold text-gogreen-text-primary mt-1 uppercase">
              {analysis.architecture}
            </div>
          </div>

          <div className="bg-gogreen-bg-panel border border-gogreen-border rounded p-3 font-mono">
            <div className="text-[10px] text-gogreen-text-secondary uppercase">Entry Point</div>
            <div className="text-xs font-bold text-gogreen-primary mt-1">{analysis.entryPoint}</div>
          </div>

          <div className="bg-gogreen-bg-panel border border-gogreen-border rounded p-3 font-mono">
            <div className="text-[10px] text-gogreen-text-secondary uppercase">File Size</div>
            <div className="text-xs font-bold text-gogreen-text-primary mt-1">
              {formatBytes(analysis.fileSize)}
            </div>
          </div>

          <div className="bg-gogreen-bg-panel border border-gogreen-border rounded p-3 font-mono">
            <div className="text-[10px] text-gogreen-text-secondary uppercase">Magic Signature</div>
            <div className="text-xs font-bold text-gogreen-bright mt-1">{analysis.magicBytes}</div>
          </div>
        </div>
      )}

      {/* Main Analysis Inspection Tabs */}
      {analysis && (
        <Card noPadding>
          <div className="p-3 border-b border-gogreen-border bg-gogreen-bg-secondary/40">
            <Tabs
              tabs={[
                { id: 'sections', label: 'Section Headers', badge: analysis.sections.length },
                { id: 'hex', label: 'Hex & ASCII Viewer' },
                { id: 'disasm', label: 'Disassembly Stream', badge: analysis.disassembly.length },
                { id: 'symbols', label: 'Symbol Table', badge: analysis.symbols.length },
                { id: 'hash', label: 'Cryptographic Hash' },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </div>

          <div className="p-4">
            {activeTab === 'sections' && (
              <DataTable
                columns={sectionColumns}
                data={analysis.sections}
                keyExtractor={(item) => item.name}
              />
            )}

            {activeTab === 'hex' && (
              <HexViewer
                data={new Uint8Array(analysis.rawBuffer || generateSpecimenElf())}
                bytesPerRow={16}
                rowsPerPage={16}
              />
            )}

            {activeTab === 'disasm' && (
              <DataTable
                columns={disassemblyColumns}
                data={analysis.disassembly}
                keyExtractor={(item) => item.address}
              />
            )}

            {activeTab === 'symbols' && (
              <DataTable
                columns={symbolColumns}
                data={analysis.symbols}
                keyExtractor={(item) => item.name}
                emptyTitle="No symbols in binary"
                emptyDescription="The binary symbol table may be stripped or unpopulated."
              />
            )}

            {activeTab === 'hash' && (
              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 rounded bg-gogreen-bg-main border border-gogreen-border">
                  <div className="text-gogreen-text-secondary text-[11px] uppercase mb-1">
                    SHA-256 Digest
                  </div>
                  <div className="text-gogreen-bright font-bold text-sm break-all select-all">
                    {analysis.sha256}
                  </div>
                </div>
                <div className="text-xs text-gogreen-text-secondary leading-relaxed">
                  Cryptographic verification seals binary provenance for deterministic laboratory reproducibility.
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
