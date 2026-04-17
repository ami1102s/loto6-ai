/** ロト6の番号ボールコンポーネント
 * ロト6の番号（1〜43）を色分けして丸いボールとして表示する
 */

type NumberBallProps = {
  number: number;
  /** ボーナス数字かどうか */
  isBonus?: boolean;
  /** カスタムサイズ（デフォルト: md） */
  size?: "sm" | "md" | "lg";
  /** ホット（高頻出）/ コールド（低頻出）の強調 */
  highlight?: "hot" | "cold" | "normal";
};

// ロト6の番号帯ごとの色（公式に近い色分け）
function getBallColor(num: number): string {
  if (num <= 9) return "#f87171"; // 赤 (1-9)
  if (num <= 18) return "#fb923c"; // オレンジ (10-18)
  if (num <= 27) return "#facc15"; // 黄 (19-27)
  if (num <= 36) return "#4ade80"; // 緑 (28-36)
  return "#60a5fa"; // 青 (37-43)
}

const sizeStyles: Record<string, string> = {
  sm: "w-7 h-7 text-xs font-bold",
  md: "w-10 h-10 text-sm font-bold",
  lg: "w-14 h-14 text-lg font-bold",
};

export function NumberBall({ number, isBonus = false, size = "md", highlight = "normal" }: NumberBallProps) {
  const baseColor = getBallColor(number);
  const ballSize = sizeStyles[size];

  // ボーナス数字は白抜き（枠線のみ）
  const style: React.CSSProperties = isBonus
    ? {
        border: `3px solid ${baseColor}`,
        color: baseColor,
        backgroundColor: "white",
      }
    : {
        backgroundColor: baseColor,
        color: "white",
        border: "3px solid transparent",
      };

  // ホット/コールドの強調
  let extraClass = "";
  if (highlight === "hot") extraClass = "ring-2 ring-red-500 ring-offset-1";
  if (highlight === "cold") extraClass = "ring-2 ring-blue-500 ring-offset-1";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shadow-md ${ballSize} ${extraClass}`}
      style={style}
      title={isBonus ? `ボーナス数字: ${number}` : `${number}番`}
    >
      {number}
    </span>
  );
}
