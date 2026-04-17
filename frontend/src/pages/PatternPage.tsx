import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { PatternResponse } from "../types/index.ts";

const PIE_COLORS = ["#6366f1", "#f97316", "#22c55e", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6"];

export function PatternPage() {
  const [data, setData] = useState<PatternResponse | null>(null);
  const [recent, setRecent] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = (recentN: number) => {
    setLoading(true);
    setError(null);
    const url = recentN > 0 ? `/api/analysis/patterns?recent=${recentN}` : "/api/analysis/patterns";
    fetch(url)
      .then((r) => r.json())
      .then((d: PatternResponse) => setData(d))
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData(0);
  }, []);

  const handleRecentChange = (n: number) => {
    setRecent(n);
    fetchData(n);
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🔍 パターン分析</h1>
      <p className="text-gray-500 text-sm mb-6">奇数・偶数のバランス、連番、合計値の分布を分析します</p>

      {/* フィルター */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[0, 50, 100, 200, 500].map((n) => (
          <button
            key={n}
            onClick={() => handleRecentChange(n)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              recent === n ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {n === 0 ? "全期間" : `直近${n}回`}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-center py-16">読み込み中...</p>}
      {error && <p className="text-red-500 text-center py-16">{error}</p>}

      {data && !loading && (
        <div className="space-y-6">
          {/* 奇偶比 */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-4">奇数・偶数の組み合わせ比率</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={Object.entries(data.odd_even)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => ({ name: k, value: v }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {Object.keys(data.odd_even).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Tooltip formatter={(v: number) => [`${v}回`, "出現回数"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 連番パターン */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-4">連番パターン</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={Object.entries(data.consecutive_count)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => ({ name: k, count: v }))}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${v}回`, "出現回数"]} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 合計値分布 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-sm font-bold text-gray-700 mb-4">本数字6個の合計値分布</h2>
            <p className="text-xs text-gray-400 mb-3">
              理論上の中央値: 132 / 最小: 21（1+2+3+4+5+6）/ 最大: 243（38+39+40+41+42+43）
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data.sum_distribution}
                margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`${v}回`, "出現回数"]} />
                <Bar dataKey="count" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 十の位分布 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-sm font-bold text-gray-700 mb-4">十の位ごとの平均出現数（1回あたり）</h2>
            <p className="text-xs text-gray-400 mb-3">
              1回の抽選で各帯域から何個の番号が出ているかの平均値
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={Object.entries(data.decade_distribution).map(([k, v]) => ({
                  range: k,
                  avg: v.toFixed(2),
                }))}
                margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 3]} />
                <Tooltip formatter={(v: number) => [`${v}個`, "平均出現数"]} />
                <Bar dataKey="avg" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </main>
  );
}
