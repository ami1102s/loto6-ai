import { useState } from "react";
import { NumberBall } from "../components/NumberBall.tsx";
import type { PredictResponse } from "../types/index.ts";

type Style = "balanced" | "hot" | "cold";

const styleOptions: { value: Style; label: string; desc: string; icon: string }[] = [
  { value: "balanced", label: "バランス型", desc: "ホットとコールドをバランス良く", icon: "⚖️" },
  { value: "hot", label: "ホット重視", desc: "よく出る番号を優先", icon: "🔥" },
  { value: "cold", label: "コールド重視", desc: "しばらく出ていない番号を優先", icon: "❄️" },
];

export function PredictPage() {
  const [style, setStyle] = useState<Style>("balanced");
  const [sets, setSets] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    setLoading(true);
    setError(null);
    setResult(null);

    fetch("/api/predict/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sets, style }),
    })
      .then((r) => r.json())
      .then((d: PredictResponse & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setResult(d);
      })
      .catch((e: Error) => setError(e.message ?? "AI予想の生成に失敗しました"))
      .finally(() => setLoading(false));
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🤖 AI予想番号生成</h1>
      <p className="text-gray-500 text-sm mb-6">
        過去の抽選データをClaude AIが分析し、次回の予想番号を提案します
      </p>

      {/* 設定パネル */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        {/* 予想スタイル */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-3">予想スタイル</h3>
          <div className="grid grid-cols-3 gap-3">
            {styleOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStyle(opt.value)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  style === opt.value
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-xl mb-1">{opt.icon}</div>
                <div className="text-sm font-bold text-gray-800">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* セット数 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-3">生成セット数</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setSets(n)}
                className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${
                  sets === n
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-lg transition-colors"
        >
          {loading ? "AIが分析中..." : "🤖 AI予想を生成する"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-600 text-sm">{error}</p>
          <p className="text-red-400 text-xs mt-1">
            ANTHROPIC_API_KEYが設定されていない場合は、バックエンドのシークレットに設定してください。
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* 分析サマリー */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-indigo-800 mb-1">📋 AIの分析コメント</h3>
            <p className="text-sm text-indigo-700">{result.analysis_summary}</p>
          </div>

          {/* 予想セット */}
          {result.predictions.map((p, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">セット {i + 1}</h3>
              </div>

              {/* 番号ボール */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {p.numbers.map((n, j) => (
                  <NumberBall key={j} number={n} size="lg" />
                ))}
                <span className="text-gray-400 mx-1">+</span>
                <NumberBall number={p.bonus} size="lg" isBonus />
                <span className="text-xs text-gray-400 ml-1">(ボーナス)</span>
              </div>

              {/* 選択理由 */}
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">{p.reason}</p>
            </div>
          ))}

          <p className="text-xs text-gray-400 text-center">
            ※ AI予想は統計的分析に基づくものであり、当選を保証するものではありません
          </p>
        </div>
      )}
    </main>
  );
}
