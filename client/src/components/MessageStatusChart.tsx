import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

interface MessageStatusChartProps {
  userId?: string;
}

export function MessageStatusChart({ userId }: MessageStatusChartProps) {
  const { t } = useLanguage();

  const { data: statsData } = useQuery({
    queryKey: ["/api/message-status-stats", userId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = userId 
        ? `/api/message-status-stats?userId=${userId}`
        : '/api/message-status-stats';
      const response = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Failed to fetch message status stats');
      return response.json();
    }
  });

  const stats = statsData?.stats || { sent: 0, delivered: 0, failed: 0 };
  const total = stats.sent + stats.delivered + stats.failed;

  const data = [
    { name: "Delivered", value: stats.delivered, color: "#10b981" }, // green
    { name: "Sent", value: stats.sent, color: "#3b82f6" }, // blue
    { name: "Failed", value: stats.failed, color: "#ef4444" }, // red
  ].filter(item => item.value > 0);

  // If no data, show a placeholder
  if (total === 0) {
    data.push({ name: "No Data", value: 1, color: "#e5e7eb" });
  }

  const getPercentage = (value: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <Card className="flex flex-col" data-testid="card-message-status-chart">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Message Status</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <div className="flex items-center justify-center h-full">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                labelLine
                label={({ cx, cy, midAngle, outerRadius, value, index }) => {
                  if (total === 0) return null;
                  const RADIAN = Math.PI / 180;
                  const labelRadius = outerRadius + 12;
                  const x = cx + labelRadius * Math.cos(-midAngle * RADIAN);
                  const y = cy + labelRadius * Math.sin(-midAngle * RADIAN);
                  const color = data[index]?.color || '#000';
                  return (
                    <text 
                      x={x} 
                      y={y} 
                      fill={color}
                      textAnchor={x > cx ? 'start' : 'end'} 
                      dominantBaseline="central"
                      className="text-xs font-semibold"
                    >
                      {`${getPercentage(value)}%`}
                    </text>
                  );
                }}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length && total > 0) {
                    return (
                      <div className="bg-card border rounded-lg p-2 shadow-lg">
                        <p className="text-sm font-medium">{payload[0].name}</p>
                        <p className="text-sm text-muted-foreground">
                          {payload[0].value} ({getPercentage(payload[0].value as number)}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Center text showing total */}
              <text 
                x="50%" 
                y="48%" 
                textAnchor="middle" 
                dominantBaseline="middle"
                className="text-3xl font-bold fill-foreground"
              >
                {total}
              </text>
              <text 
                x="50%" 
                y="58%" 
                textAnchor="middle" 
                dominantBaseline="middle"
                className="text-xs fill-muted-foreground"
              >
                Total
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        {total > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#10b981" }} />
              <span className="text-xs text-muted-foreground">Delivered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
              <span className="text-xs text-muted-foreground">Sent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }} />
              <span className="text-xs text-muted-foreground">Failed</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
