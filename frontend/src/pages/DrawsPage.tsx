import { useEffect, useState } from "react";
import { DrawRow } from "../components/DrawRow.tsx";
import type { Draw, DrawsResponse } from "../types/index.ts";

const PAGE_SIZE = 50;

export function DrawsPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = (p: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/draws?limit=${PAGE_SIZE}&offset=${p * PAGE_SIZE}`)
      .then((r) => r.json())
      .then((d: DrawsResponse) => {
        setDraws(d.draws);
        setTotal(d.total);
        setPage(p);
      })
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPage(0);
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">📋 過去抽選結果一覧</h1>
      <p className="text-gray-500 text-sm mb-6">
        全{total}回分の抽選結果
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading && <p className="text-gray-400 text-center py-16">読み込み中...</p>}
        {error && <p className="text-red-500 text-center py-16">{error}</p>}

        {!loading && draws.length === 0 && !error && (
          <div className="text-center py-16 text-gray-500">
            <p>データがありません</p>
            <p className="text-sm mt-2">CSVをインポートしてください</p>
          </div>
        )}

        {draws.map((d) => (
          <DrawRow key={d.id} draw={d} />
        ))}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => fetchPage(page - 1)}
            disabled={page === 0}
            className="px-4 py-2 rounded bg-gray-100 text-gray-700 disabled:opacity-30 hover:bg-gray-200 text-sm"
          >
            前へ
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => fetchPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 rounded bg-gray-100 text-gray-700 disabled:opacity-30 hover:bg-gray-200 text-sm"
          >
            次へ
          </button>
        </div>
      )}
    </main>
  );
}
