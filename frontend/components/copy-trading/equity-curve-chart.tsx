'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCurrency, formatNumber } from '@/lib/utils';
import { ProviderEquityCurvePoint } from '@/types/copy-trading';

interface EquityCurveChartProps {
  data: ProviderEquityCurvePoint[];
}

export function EquityCurveChart({ data }: EquityCurveChartProps) {
  return (
    <div className="h-[260px] w-full rounded-3xl border border-border bg-page p-3 sm:h-[320px] sm:p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#334155" strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#9CA3AF"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            stroke="#9CA3AF"
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value) => formatNumber(value, 0)}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), 'Equity']}
            labelFormatter={(label) => `Date: ${label}`}
            contentStyle={{
              borderRadius: '16px',
              border: '1px solid #1F2937',
              background: '#111827',
              color: '#F9FAFB',
              boxShadow: '0 18px 50px rgba(2,6,23,0.28)',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#F5A623"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: '#F9FAFB' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
