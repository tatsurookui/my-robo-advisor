import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DashboardChartAllocation } from "../../shared/dashboard";

export default function DashboardChart({
  allocations,
  formatValue,
}: {
  allocations: DashboardChartAllocation[];
  formatValue: (value: number) => string;
}) {
  const chartAllocations = allocations.filter(
    (allocation) => allocation.value > 0,
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartAllocations}
          dataKey="value"
          nameKey="assetClassName"
          innerRadius="59%"
          outerRadius="86%"
          paddingAngle={2}
          stroke="#ffffff"
          strokeWidth={3}
        >
          {chartAllocations.map((allocation) => (
            <Cell key={allocation.assetClassId} fill={allocation.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatValue(Number(value ?? 0))}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
