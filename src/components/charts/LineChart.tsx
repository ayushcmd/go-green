import React from 'react';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface DataPoint {
  label: string;
  value: number;
  [key: string]: unknown;
}

export interface LineChartProps {
  data: DataPoint[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  unit?: string;
  height?: number;
}

export const LineChart: React.FC<LineChartProps> = ({
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

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2, fill: color }}
            activeDot={{ r: 4, stroke: '#39FF14', strokeWidth: 1 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};
