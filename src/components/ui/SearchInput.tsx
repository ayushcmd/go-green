import React from 'react';
import { cn } from '@/utils/cn';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  onClear?: () => void;
  shortcut?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  shortcut,
  placeholder = 'Search...',
  className,
  ...props
}) => {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="w-3.5 h-3.5 absolute left-2.5 text-gogreen-text-secondary pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gogreen-bg-elevated border border-gogreen-border rounded pl-8 pr-12 py-1.5 text-xs font-mono text-gogreen-text-primary placeholder:text-gogreen-text-secondary/60 focus:outline-none focus:border-gogreen-primary/70 transition-colors"
        {...props}
      />
      <div className="absolute right-2 flex items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              if (onClear) onClear();
            }}
            className="text-gogreen-text-secondary hover:text-gogreen-text-primary p-0.5 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {shortcut && !value && (
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-gogreen-bg-panel border border-gogreen-border rounded text-gogreen-text-secondary">
            {shortcut}
          </kbd>
        )}
      </div>
    </div>
  );
};
