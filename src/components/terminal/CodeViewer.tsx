import React, { useState } from 'react';
import { cn } from '@/utils/cn';
import { Copy, Check } from 'lucide-react';

export interface CodeViewerProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  language = 'asm',
  title,
  showLineNumbers = true,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.trim().split('\n');

  return (
    <div className={cn('bg-gogreen-bg-main border border-gogreen-border rounded font-mono text-xs overflow-hidden', className)}>
      {(title || language) && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gogreen-border bg-gogreen-bg-secondary/70">
          <div className="flex items-center gap-2">
            {language && (
              <span className="text-[10px] uppercase font-bold text-gogreen-bright tracking-wider">
                {language}
              </span>
            )}
            {title && <span className="text-gogreen-text-secondary text-[11px]">{title}</span>}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-gogreen-text-secondary hover:text-gogreen-primary transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-gogreen-bright" />
                <span className="text-gogreen-bright">COPIED</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>COPY</span>
              </>
            )}
          </button>
        </div>
      )}

      <div className="p-3 overflow-x-auto text-[11px] leading-relaxed">
        {lines.map((line, idx) => {
          const isComment = line.trim().startsWith(';') || line.trim().startsWith('//') || line.trim().startsWith('#');
          const isLabel = line.trim().endsWith(':');

          return (
            <div key={idx} className="flex gap-3 hover:bg-gogreen-bg-elevated/30 px-1 -mx-1 rounded">
              {showLineNumbers && (
                <span className="w-8 text-right text-gogreen-text-secondary/40 select-none shrink-0">
                  {idx + 1}
                </span>
              )}
              <span
                className={cn(
                  'flex-1 whitespace-pre',
                  isComment && 'text-gogreen-text-secondary/60 italic',
                  isLabel && 'text-gogreen-bright font-bold',
                  !isComment && !isLabel && 'text-gogreen-text-primary'
                )}
              >
                {line}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
