'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart } from 'recharts';

interface PieChartData {
  name: string;
  value: number;
  color: string;
}

export function UsagePieChart({ 
  data, 
  title,
  centerText 
}: { 
  data: PieChartData[];
  title: string;
  centerText?: string;
}) {
  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          {centerText && (
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-white">
              {centerText}
            </text>
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface NetworkData {
  time: string;
  inbound: number;
  outbound: number;
}

export function NetworkKPIChart({ data }: { data: NetworkData[] }) {
  return (
    <div className="w-full h-full">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Network Traffic (Mbps)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
          <XAxis 
            dataKey="time" 
            stroke="#666"
            tick={{ fill: '#666', fontSize: 12 }}
          />
          <YAxis 
            stroke="#666"
            tick={{ fill: '#666', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#0a0a0a', 
              border: '1px solid #262626',
              borderRadius: '8px'
            }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend 
            wrapperStyle={{ color: '#fff' }}
          />
          <Area 
            type="monotone" 
            dataKey="inbound" 
            stroke="#3b82f6" 
            fillOpacity={1} 
            fill="url(#colorInbound)"
            strokeWidth={2}
            name="Inbound"
          />
          <Area 
            type="monotone" 
            dataKey="outbound" 
            stroke="#10b981" 
            fillOpacity={1} 
            fill="url(#colorOutbound)"
            strokeWidth={2}
            name="Outbound"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}