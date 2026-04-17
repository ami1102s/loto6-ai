import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DrawRow } from "../components/DrawRow.tsx";
import type { Draw } from "../types/index.ts";

export function HomePage() {
  const [latestDraws, setLatestDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/draws/latest?n=5")
      .then((r) => r.json())
      .then((data: { draws: Draw[] }) => {
        setLatestDraws(data.draws);
      })
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-800 mb-3">🎱 ロト6 予想分析AI</h1>
        <p className="text-gray-500">過去の抽選データをAIが分析して予想番号を提案します</p>
      </div>

      {/* ナビゲーションカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <FeatureCard to="/frequency" icon="📊" title="頻度分析" desc="各番号の出現頻度" />
        <FeatureCard to="/patterns" icon="🔍" title="パターン分析" desc="奇偶・連番・合計値" />
        <FeatureCard to="/predict" icon="🤖" title="AI予想" desc="Claude AIが番号を提案" />
        <FeatureCard to="/simulation" icon="🎯" title="シミュレーション" desc="番号の過去当選確認" />
      </div>

      {/* 最新抽選結果 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">最新の抽選結果</h2>
          <Link to="/draws" className="text-sm text-indigo-600 hover:underline">
            全件見る →
          </Link>
        </div>

        {loading && <p className="text-gray-400 text-center py-8">読み込み中...</p>}
        {error && <p className="text-red-500 text-center py-8">{error}</p>}
        {!loading && !error && latestDraws.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>データがありません</p>
            <p className="text-sm mt-2">
              みずほ銀行の公式CSVをダウンロードしてインポートしてください
            </p>
          </div>
        )}
        {latestDraws.map((d) => (
          <DrawRow key={d.id} draw={d} />
        ))}
      </section>
    </main>
  );
}

function FeatureCard({ to, icon, title, desc }: { to: string; icon: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="block bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-indigo-300 transition-all text-center"
    >
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-bold text-gray-800 text-sm">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{desc}</div>
    </Link>
  );
}
