import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/utils/cn';
import { Terminal as TerminalIcon, Trash2 } from 'lucide-react';

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: string;
}

export interface TerminalPanelProps {
  initialLines?: TerminalLine[];
  onExecuteCommand?: (cmd: string) => Promise<string | void> | string | void;
  className?: string;
  promptPrefix?: string;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  initialLines = [],
  onExecuteCommand,
  className,
  promptPrefix = 'gogreen@host:~$',
}) => {
  const [lines, setLines] = useState<TerminalLine[]>(initialLines);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;

      const now = new Date().toLocaleTimeString();
      const inputLine: TerminalLine = {
        id: Math.random().toString(36).substring(7),
        type: 'input',
        content: trimmed,
        timestamp: now,
      };

      setLines((prev) => [...prev, inputLine]);
      setHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);
      setInput('');

      if (trimmed === 'clear') {
        setLines([]);
        return;
      }

      if (onExecuteCommand) {
        try {
          const result = await onExecuteCommand(trimmed);
          if (result) {
            setLines((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(7),
                type: 'output',
                content: result,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setLines((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(7),
              type: 'error',
              content: `Error: ${msg}`,
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }
      } else {
        // Default built-in command interpreter
        let reply = '';
        if (trimmed === 'help') {
          reply = 'Available commands: help, status, arch, memory, version, clear';
        } else if (trimmed === 'status') {
          reply = 'Native Engine: STANDBY | Gateway: ONLINE | Workers: 0 active';
        } else if (trimmed === 'arch') {
          reply = `Hardware Target: ${navigator.platform || 'x86_64'} | Concurrency: ${navigator.hardwareConcurrency || 8} logical cores`;
        } else if (trimmed === 'version') {
          reply = 'GoGreen Studio v1.0.0 (Polyglot Systems Engineering Laboratory)';
        } else {
          reply = `gogreen: command not found: ${trimmed}. Type 'help' for instructions.`;
        }
        setLines((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            type: 'output',
            content: reply,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        const item = history[nextIdx];
        if (item) setInput(item);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const nextIdx = historyIndex + 1;
        if (nextIdx >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(nextIdx);
          const item = history[nextIdx];
          if (item) setInput(item);
        }
      }
    }
  };

  return (
    <div className={cn('flex flex-col bg-gogreen-bg-main border border-gogreen-border rounded font-mono text-xs overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gogreen-border bg-gogreen-bg-secondary/70">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-gogreen-bright" />
          <span className="text-[11px] font-semibold text-gogreen-text-primary uppercase tracking-wider">
            Interactive Diagnostics Terminal
          </span>
        </div>
        <button
          onClick={() => setLines([])}
          className="text-gogreen-text-secondary hover:text-gogreen-primary p-1 rounded"
          title="Clear console"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-1.5 min-h-[160px] max-h-[300px]">
        {lines.map((line) => (
          <div key={line.id} className="leading-relaxed">
            {line.type === 'input' ? (
              <div className="flex items-start gap-2">
                <span className="text-gogreen-bright font-semibold select-none">{promptPrefix}</span>
                <span className="text-gogreen-text-primary">{line.content}</span>
              </div>
            ) : line.type === 'error' ? (
              <div className="text-gogreen-error pl-4">{line.content}</div>
            ) : line.type === 'system' ? (
              <div className="text-gogreen-warning/80 pl-4">{line.content}</div>
            ) : (
              <div className="text-gogreen-text-secondary pl-4 whitespace-pre-wrap">{line.content}</div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-gogreen-border/60 bg-gogreen-bg-panel/40">
        <span className="text-gogreen-bright font-semibold select-none shrink-0">{promptPrefix}</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type 'help', 'status', 'arch'..."
          className="w-full bg-transparent border-none text-gogreen-text-primary text-xs font-mono focus:outline-none placeholder:text-gogreen-text-secondary/40"
        />
      </div>
    </div>
  );
};
