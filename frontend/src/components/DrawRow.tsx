import { NumberBall } from "./NumberBall.tsx";
import type { Draw } from "../types/index.ts";

type DrawRowProps = {
  draw: Draw;
};

/** 抽選結果1行コンポーネント */
export function DrawRow({ draw }: DrawRowProps) {
  const numbers = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6];

  return (
    <div className="flex items-center gap-3 p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      {/* 回号 */}
      <div className="w-16 text-right">
        <span className="text-xs text-gray-500">第</span>
        <span className="font-bold text-gray-800">{draw.draw_number}</span>
        <span className="text-xs text-gray-500">回</span>
      </div>

      {/* 抽選日 */}
      <div className="w-24 text-xs text-gray-500">{draw.draw_date}</div>

      {/* 本数字 */}
      <div className="flex items-center gap-1">
        {numbers.map((n, i) => (
          <NumberBall key={i} number={n} size="sm" />
        ))}
      </div>

      {/* ボーナス */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">B</span>
        <NumberBall number={draw.bonus} size="sm" isBonus />
      </div>

      {/* 1等情報（任意） */}
      {draw.prize1_amount !== null && (
        <div className="ml-auto text-xs text-gray-500">
          1等: {draw.prize1_winners}名 / {(draw.prize1_amount / 100_000_000).toFixed(2)}億円
        </div>
      )}
    </div>
  );
}
