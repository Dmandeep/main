"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SkillGapChartProps {
  data: {
    domain: string;
    supply: number;
    demand: number;
  }[];
}

export function SkillGapChart({ data }: SkillGapChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 0,
            left: -20,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
          <XAxis 
            dataKey="domain" 
            tick={{ fill: '#A1A1AA', fontSize: 12 }}
            axisLine={{ stroke: '#27272A' }}
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: '#A1A1AA', fontSize: 12 }}
            axisLine={{ stroke: '#27272A' }}
            tickLine={false}
          />
          <Tooltip 
            cursor={{ fill: '#18181B' }}
            contentStyle={{ 
              backgroundColor: '#111113', 
              borderColor: '#27272A',
              borderRadius: '8px',
              color: '#FAFAFA'
            }}
            itemStyle={{ color: '#FAFAFA' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#A1A1AA' }} />
          <Bar dataKey="supply" name="Builder Supply" fill="#6366F1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="demand" name="Idea Demand" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
