"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const PIE_COLORS = [
  "#C5D634",
  "#a8b82c",
  "#8cc9a4",
  "#6fa686",
  "#4f7862",
  "#2D4A3E",
  "#344a41",
];

export { PIE_COLORS };

export default function AllocationDonut({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          innerRadius={45}
          outerRadius={80}
          paddingAngle={0.5}
          dataKey="value"
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "rgba(13, 38, 31, 0.9)",
            border: "1px solid rgba(197, 214, 52, 0.22)",
            borderRadius: 10,
            fontSize: 12,
            color: "#F3EFE8",
          }}
          formatter={(v) => `${Number(v).toFixed(1)}%`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
