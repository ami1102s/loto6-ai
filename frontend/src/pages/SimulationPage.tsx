import { useState } from "react";
import { NumberBall } from "../components/NumberBall.tsx";
import type { SimulationResponse } from "../types/index.ts";

const ALL_NUMBERS = Array.from({ length: 43 }, (_, i) => i + 1);

export function SimulationPage() {
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleNumber = (n: number) => {
    setSelected((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= 6) return prev; // 6個選んだ後は追加しない
      return [...prev, n].sort((a, b) => a - b);
    });
  };

  const handleSimulate = () => {
    if (selected.length !== 6) {
      setError("6個の番号を選択してください");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const params = new URLSearchParams();
    selected.forEach((n, i) => params.set(`n${i + 1}`, String(n)));

    fetch(`/api/simulation?${params.toString()}`)
      .then((r) => r.json())
      .then((d: SimulationResponse & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setResult(d);
      })
      .catch((e: Error) => setError(e.message ?? "シミュレーションに失敗しました"))
      .finally(() => setLoading(false));
  };

  const prizeLabels: Record<string, string> = {
    "1st": "1等（6個一致）",
    "2nd": "2等（5個+ボーナス一致）",
    "3rd": "3等（5個一致）",
    "4th": "4等（4個一致）",
    "5th": "5等（3個一致）",
    no_prize: "落選",
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🎯 当選シミュレーション</h1>
      <p className="text-gray-500 text-sm mb-6">
        6個の番号を選んで、過去の抽選結果でどれだけ当たっていたか確認します
      </p>

      {/* 番号選択 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700">番号を選択（6個）</h3>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <button
                onClick={() => setSelected([])}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                クリア
              </button>
            )}
            <span className="text-xs text-gray-400">{selected.length}/6</span>
          </div>
        </div>

        {/* 選択済み番号 */}
        <div className="flex items-center gap-2 mb-4 min-h-[44px] p-2 bg-gray-50 rounded-lg flex-wrap">
          {selected.length === 0 ? (
            <span className="text-xs text-gray-400">番号をクリックして選択してください</span>
          ) : (
            selected.map((n) => (
              <button key={n} onClick={() => toggleNumber(n)}>
                <NumberBall number={n} size="md" />
              </button>
            ))
          )}
        </div>

        {/* 番号グリッド */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5">
          {ALL_NUMBERS.map((n) => (
            <button
              key={n}
              onClick={() => toggleNumber(n)}
              className={`transition-transform hover:scale-110 ${
                selected.includes(n) ? "opacity-100" : selected.length >= 6 ? "opacity-30" : "opacity-80"
              }`}
            >
              <NumberBall
                number={n}
                size="sm"
                highlight={selected.includes(n) ? "hot" : "normal"}
              />
            </button>
          ))}
        </div>

        <button
          onClick={handleSimulate}
          disabled={loading || selected.length !== 6}
          className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-lg transition-colors"
        >
          {loading ? "シミュレーション中..." : "🎯 シミュレーション実行"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* サマリー */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 mb-4">
              過去 {result.total_draws_checked}回 の結果
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(result.results).map(([key, count]) => (
                <div
                  key={key}
                  className={`rounded-lg p-3 ${
                    key === "no_prize"
                      ? "bg-gray-50"
                      : count > 0
                      ? "bg-yellow-50 border border-yellow-200"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="text-xs text-gray-500 mb-1">{prizeLabels[key]}</div>
                  <div className={`text-2xl font-bold ${count > 0 && key !== "no_prize" ? "text-yellow-600" : "text-gray-700"}`}>
                    {count}回
                  </div>
                  <div className="text-xs text-gray-400">
                    {result.total_draws_checked > 0
                      ? `${((count / result.total_draws_checked) * 100).toFixed(2)}%`
                      : "0%"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 詳細（3個以上一致した回） */}
          {result.details.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4">
                3個以上一致した回（{result.details.length}件）
              </h3>
              <div className="space-y-2">
                {result.details.map((d) => (
                  <div
                    key={d.draw_number}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <div className="w-16 text-right text-xs text-gray-500">第{d.draw_number}回</div>
                    <div className="w-24 text-xs text-gray-400">{d.draw_date}</div>
                    <div className="flex gap-1">
                      {d.matched_numbers.map((n) => (
                        <NumberBall key={n} number={n} size="sm" highlight="hot" />
                      ))}
                    </div>
                    {d.bonus_matched && (
                      <span className="text-xs text-purple-600">+ボーナス</span>
                    )}
                    <span
                      className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                        d.prize_rank === "落選"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {d.prize_rank}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
