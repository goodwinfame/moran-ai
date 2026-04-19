"use client";

import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import type { AnalysisData, RadarDataPoint, TrendDataPoint } from "@/stores/panel-store-types";

const DIMENSION_COLORS: Record<string, string> = {
  情节张力: "hsl(0 70% 55%)",
  角色塑造: "hsl(30 70% 55%)",
  对话质量: "hsl(60 70% 45%)",
  描写质量: "hsl(120 60% 45%)",
  原创性: "hsl(180 60% 45%)",
  主题呼应: "hsl(210 70% 55%)",
  伏笔管理: "hsl(240 60% 55%)",
  氛围营造: "hsl(270 60% 55%)",
  节奏控制: "hsl(300 60% 55%)",
};

function RadarView({ data }: { data: RadarDataPoint[] }) {
  return (
    <div className="border rounded-xl p-4 bg-card shadow-sm">
      <h4 className="text-sm font-bold text-muted-foreground mb-4">九维雷达图</h4>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
          />
          <Radar
            name="评分"
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendView({ data }: { data: TrendDataPoint[] }) {
  if (data.length === 0) return null;

  const firstPoint = data[0];
  if (!firstPoint) return null;

  // Extract dimension names from first data point (excluding 'chapter')
  const dimensions = Object.keys(firstPoint).filter((k) => k !== "chapter");

  return (
    <div className="border rounded-xl p-4 bg-card shadow-sm">
      <h4 className="text-sm font-bold text-muted-foreground mb-4">趋势变化</h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="chapter"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            label={{ value: "章节", position: "insideBottomRight", offset: -5, fontSize: 11 }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
          />
          {dimensions.map((dim) => (
            <Line
              key={dim}
              type="monotone"
              dataKey={dim}
              stroke={DIMENSION_COLORS[dim] || "hsl(var(--primary))"}
              strokeWidth={1.5}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AnalysisChartsInner({ analysis }: { analysis: AnalysisData | null }) {
  if (!analysis) return null;

  return (
    <div className="space-y-6">
      {analysis.radarData.length > 0 && <RadarView data={analysis.radarData} />}
      {analysis.trendData.length > 0 && <TrendView data={analysis.trendData} />}
    </div>
  );
}
