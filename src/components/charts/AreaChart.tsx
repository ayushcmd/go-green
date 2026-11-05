import React from 'react';
import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface AreaDataPoint {
  label: string;
  value: number;
  [key: string]: unknown;
}

export interface AreaChartProps {
  data: AreaDataPoint[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  unit?: string;
  height?: number;
}

export const AreaChart: React.FC<AreaChartProps> = ({
  data,
  dataKey = 'value',
  xKey = 'label',
  color = '#76FF03',
  unit = '',
  height = 200,
}) => {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-gogreen-text-secondary font-mono border border-dashed border-gogreen-border rounded"
      >
        No chart metrics recorded
      </div>
    );
  }

  const gradientId = `gradient-${dataKey}-${Math.random().toString(36).substring(7)}`;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#263629" strokeDasharray="3 3" opacity={0.4} />
          <XAxis
            dataKey={xKey}
            stroke="#92A096"
            fontSize={10}
            tickLine={false}
            fontFamily="JetBrains Mono"
          />
          <YAxis
            stroke="#92A096"
            fontSize={10}
            tickLine={false}
            fontFamily="JetBrains Mono"
            unit={unit}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18211B',
              borderColor: '#263629',
              fontSize: '11px',
              fontFamily: 'JetBrains Mono',
              borderRadius: '4px',
              color: '#E8F0EA',
            }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
};
