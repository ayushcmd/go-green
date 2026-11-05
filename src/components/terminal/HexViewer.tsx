import React, { useState, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface HexViewerProps {
  data: Uint8Array;
  bytesPerRow?: number;
  rowsPerPage?: number;
  highlightOffset?: number;
  className?: string;
}

export const HexViewer: React.FC<HexViewerProps> = ({
  data,
  bytesPerRow = 16,
  rowsPerPage = 16,
  highlightOffset,
  className,
}) => {
  const [page, setPage] = useState(0);
  const [jumpOffset, setJumpOffset] = useState('');
  const [selectedByte, setSelectedByte] = useState<number | null>(null);

  const totalBytes = data.length;
  const bytesPerPage = bytesPerRow * rowsPerPage;
  const totalPages = Math.max(1, Math.ceil(totalBytes / bytesPerPage));

  const startOffset = page * bytesPerPage;
  const endOffset = Math.min(startOffset + bytesPerPage, totalBytes);

  const currentSlice = useMemo(() => {
    return data.slice(startOffset, endOffset);
  }, [data, startOffset, endOffset]);

  const rows = useMemo(() => {
    const r = [];
    for (let i = 0; i < currentSlice.length; i += bytesPerRow) {
      const rowBytes = Array.from(currentSlice.slice(i, i + bytesPerRow));
      const rowOffset = startOffset + i;
      r.push({ offset: rowOffset, bytes: rowBytes });
    }
    return r;
  }, [currentSlice, bytesPerRow, startOffset]);

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = jumpOffset.trim().toLowerCase();
    let offset = 0;
    if (clean.startsWith('0x')) {
      offset = parseInt(clean.slice(2), 16);
    } else {
      offset = parseInt(clean, 10);
    }
    if (!isNaN(offset) && offset >= 0 && offset < totalBytes) {
      const targetPage = Math.floor(offset / bytesPerPage);
      setPage(targetPage);
      setSelectedByte(offset);
    }
  };

  return (
    <div className={cn('bg-gogreen-bg-main border border-gogreen-border rounded font-mono text-xs', className)}>
      {/* Hex Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 border-b border-gogreen-border bg-gogreen-bg-secondary/70">
        <div className="flex items-center gap-2">
          <span className="text-gogreen-text-secondary text-[11px] uppercase tracking-wider">
            Total: <span className="text-gogreen-primary font-semibold">{totalBytes.toLocaleString()} bytes</span>
          </span>
          {selectedByte !== null && (
            <span className="text-gogreen-text-secondary text-[11px] ml-2">
              Selected: <span className="text-gogreen-bright">0x{selectedByte.toString(16).toUpperCase().padStart(8, '0')}</span> (Val: 0x{data[selectedByte]?.toString(16).toUpperCase().padStart(2, '0')})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <form onSubmit={handleJump} className="flex items-center gap-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Jump (0x... or dec)"
                value={jumpOffset}
                onChange={(e) => setJumpOffset(e.target.value)}
                className="bg-gogreen-bg-elevated border border-gogreen-border rounded px-2 py-0.5 text-[11px] text-gogreen-text-primary w-28 focus:outline-none focus:border-gogreen-primary"
              />
            </div>
            <Button size="sm" type="submit" variant="secondary" className="px-2 py-0.5 text-[10px]">
              <Search className="w-2.5 h-2.5" />
            </Button>
          </form>

          <div className="flex items-center gap-1 border-l border-gogreen-border pl-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded text-gogreen-text-secondary hover:text-gogreen-primary disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-gogreen-text-secondary">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded text-gogreen-text-secondary hover:text-gogreen-primary disabled:opacity-30"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Hex Grid Header */}
      <div className="grid grid-cols-[80px_1fr_160px] gap-4 px-3 py-1.5 border-b border-gogreen-border/50 text-[10px] text-gogreen-text-secondary bg-gogreen-bg-panel/40 select-none">
        <div>OFFSET</div>
        <div className="flex justify-between max-w-[340px]">
          {Array.from({ length: bytesPerRow }).map((_, i) => (
            <span key={i} className="w-4 text-center">
              {i.toString(16).toUpperCase()}
            </span>
          ))}
        </div>
        <div>ASCII TEXT</div>
      </div>

      {/* Hex Dump Rows */}
      <div className="p-3 space-y-1 overflow-x-auto select-text">
        {rows.length === 0 ? (
          <div className="text-center py-6 text-gogreen-text-secondary text-xs">
            No bytes in binary buffer
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.offset}
              className="grid grid-cols-[80px_1fr_160px] gap-4 items-center hover:bg-gogreen-bg-elevated/40 rounded px-1 -mx-1"
            >
              {/* Offset */}
              <span className="text-gogreen-text-secondary/70 text-[11px]">
                {row.offset.toString(16).padStart(8, '0').toUpperCase()}
              </span>

              {/* Hex bytes */}
              <div className="flex justify-between max-w-[340px] text-[11px]">
                {row.bytes.map((byte, idx) => {
                  const currentByteOffset = row.offset + idx;
                  const isSelected = selectedByte === currentByteOffset;
                  const isHighlighted = highlightOffset === currentByteOffset;
                  return (
                    <span
                      key={idx}
                      onClick={() => setSelectedByte(currentByteOffset)}
                      className={cn(
                        'w-4 text-center cursor-pointer transition-colors',
                        byte === 0 ? 'text-gogreen-text-secondary/30' : 'text-gogreen-text-primary',
                        isSelected && 'bg-gogreen-bright text-gogreen-bg-main font-bold rounded-sm',
                        isHighlighted && !isSelected && 'bg-gogreen-warning/30 text-gogreen-warning rounded-sm'
                      )}
                    >
                      {byte.toString(16).padStart(2, '0').toUpperCase()}
                    </span>
                  );
                })}
                {Array.from({ length: bytesPerRow - row.bytes.length }).map((_, i) => (
                  <span key={`pad-${i}`} className="w-4 text-center opacity-0">
                    00
                  </span>
                ))}
              </div>

              {/* ASCII interpretation */}
              <div className="text-gogreen-text-secondary text-[11px] tracking-wider truncate">
                {row.bytes.map((byte, idx) => {
                  const char = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
                  const isSelected = selectedByte === row.offset + idx;
                  return (
                    <span
                      key={idx}
                      className={cn(
                        isSelected && 'text-gogreen-bright font-bold underline',
                        char !== '.' ? 'text-gogreen-text-primary' : 'text-gogreen-text-secondary/30'
                      )}
                    >
                      {char}
                    </span>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
