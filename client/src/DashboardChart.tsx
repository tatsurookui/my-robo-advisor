import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DashboardAllocation } from "../../shared/dashboard";

export default function DashboardChart({
  allocations,
  formatCurrency,
}: {
  allocations: DashboardAllocation[];
  formatCurrency: (value: number) => string;
}) {
  const chartAllocations = allocations.filter(
    (allocation) => allocation.marketValue > 0,
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartAllocations}
          dataKey="marketValue"
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
          formatter={(value) => formatCurrency(Number(value ?? 0))}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
