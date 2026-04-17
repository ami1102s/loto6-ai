import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { NumberBall } from "../components/NumberBall.tsx";
import type { FrequencyResponse, NumberFrequency } from "../types/index.ts";

/** ホット/コールドの閾値（上位20% = ホット、下位20% = コールド） */
function getHighlight(num: NumberFrequency, all: NumberFrequency[]): "hot" | "cold" | "normal" {
  const sorted = [...all].sort((a, b) => b.count - a.count);
  const top = Math.ceil(sorted.length * 0.2);
  const bottom = Math.floor(sorted.length * 0.8);
  const rank = sorted.findIndex((n) => n.number === num.number);
  if (rank < top) return "hot";
  if (rank >= bottom) return "cold";
  return "normal";
}

function getBarColor(num: NumberFrequency, all: NumberFrequency[]): string {
  const h = getHighlight(num, all);
  if (h === "hot") return "#ef4444";
  if (h === "cold") return "#60a5fa";
  return "#94a3b8";
}

export function FrequencyPage() {
  const [data, setData] = useState<FrequencyResponse | null>(null);
  const [recent, setRecent] = useState<number>(0); // 0 = 全期間
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = (recentN: number) => {
    setLoading(true);
    setError(null);
    const url = recentN > 0 ? `/api/analysis/frequency?recent=${recentN}` : "/api/analysis/frequency";
    fetch(url)
      .then((r) => r.json())
      .then((d: FrequencyResponse) => setData(d))
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
      <h1 className="text-2xl font-bold text-gray-800 mb-2">📊 出現頻度分析</h1>
      <p className="text-gray-500 text-sm mb-6">各番号が過去の抽選で何回出現したかを表示します</p>

      {/* フィルター */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[0, 50, 100, 200, 500].map((n) => (
          <button
            key={n}
            onClick={() => handleRecentChange(n)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              recent === n
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {n === 0 ? "全期間" : `直近${n}回`}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-center py-16">読み込み中...</p>}
      {error && <p className="text-red-500 text-center py-16">{error}</p>}

      {data && !loading && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">
              集計対象: <span className="font-bold text-gray-800">{data.total_draws}回分</span>
            </p>

            {/* 凡例 */}
            <div className="flex gap-4 text-xs text-gray-500 mt-2">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-red-400 rounded-sm inline-block"></span> ホット（上位20%）
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-blue-400 rounded-sm inline-block"></span> コールド（下位20%）
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-slate-400 rounded-sm inline-block"></span> 普通
              </span>
            </div>
          </div>

          {/* 棒グラフ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <h2 className="text-sm font-bold text-gray-600 mb-4">本数字の出現回数</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.numbers} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="number" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: number, _name: string, props: { payload?: NumberFrequency }) => [
                    `${value}回 (${((props.payload?.rate ?? 0) * 100).toFixed(1)}%)`,
                    "出現回数",
                  ]}
                  labelFormatter={(label) => `${label}番`}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {data.numbers.map((entry) => (
                    <Cell key={entry.number} fill={getBarColor(entry, data.numbers)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ランキング */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* ホットナンバー */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-red-600 mb-3">🔥 ホットナンバー（上位10）</h2>
              <div className="space-y-2">
                {[...data.numbers]
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                  .map((n, i) => (
                    <div key={n.number} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                      <NumberBall number={n.number} size="sm" highlight="hot" />
                      <div className="flex-1">
                        <div className="h-2 bg-red-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 rounded-full"
                            style={{ width: `${(n.rate * 100 * 3).toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 w-16 text-right">
                        {n.count}回 ({(n.rate * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* コールドナンバー */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-blue-600 mb-3">❄️ コールドナンバー（下位10）</h2>
              <div className="space-y-2">
                {[...data.numbers]
                  .sort((a, b) => a.count - b.count)
                  .slice(0, 10)
                  .map((n, i) => (
                    <div key={n.number} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                      <NumberBall number={n.number} size="sm" highlight="cold" />
                      <div className="flex-1">
                        <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${(n.rate * 100 * 3).toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 w-16 text-right">
                        {n.count}回 ({(n.rate * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* 全番号ボール表示 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mt-4">
            <h2 className="text-sm font-bold text-gray-600 mb-3">全番号 不在回数（最後に出てから何回経過したか）</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
              {data.numbers.map((n) => (
                <div key={n.number} className="text-center">
                  <NumberBall number={n.number} size="sm" highlight={getHighlight(n, data.numbers)} />
                  <div className="text-xs text-gray-400 mt-0.5">{n.last_seen}回前</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
