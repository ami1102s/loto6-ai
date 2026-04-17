import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Draw, PredictResponse, Prediction } from "../types.js";

const predict = new Hono<{ Bindings: Env }>();

/** AI予想番号生成（Claude API使用）*/
predict.post(
  "/ai",
  zValidator(
    "json",
    z.object({
      sets: z.number().int().min(1).max(5).default(3),
      style: z.enum(["balanced", "hot", "cold"]).default("balanced"),
    })
  ),
  async (c) => {
    const { sets, style } = c.req.valid("json");

    if (!c.env.ANTHROPIC_API_KEY) {
      return c.json({ error: "ANTHROPIC_API_KEYが設定されていません", code: "NO_API_KEY" }, 500);
    }

    // 直近100回のデータを取得
    const { results: draws } = await c.env.DB.prepare(
      "SELECT * FROM draws ORDER BY draw_number DESC LIMIT 100"
    ).all<Draw>();

    if (draws.length === 0) {
      return c.json({ error: "抽選データがありません。先にデータをインポートしてください。", code: "NO_DATA" }, 400);
    }

    // 頻度統計を計算
    const count = new Array<number>(44).fill(0);
    for (const d of draws) {
      for (const n of [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6]) {
        count[n]++;
      }
    }
    const totalDraws = draws.length;

    // ホット/コールドナンバーの計算
    const sortedByFreq = Array.from({ length: 43 }, (_, i) => ({
      number: i + 1,
      count: count[i + 1],
      rate: (count[i + 1] / totalDraws).toFixed(3),
    })).sort((a, b) => b.count - a.count);

    const hotNumbers = sortedByFreq.slice(0, 10).map((n) => n.number);
    const coldNumbers = sortedByFreq.slice(-10).map((n) => n.number);

    // 直近10回のデータを読みやすく整形
    const recentDrawsText = draws
      .slice(0, 10)
      .map(
        (d) =>
          `第${d.draw_number}回（${d.draw_date}）: ${d.n1}, ${d.n2}, ${d.n3}, ${d.n4}, ${d.n5}, ${d.n6} ボーナス:${d.bonus}`
      )
      .join("\n");

    // スタイルの説明
    const styleDesc: Record<string, string> = {
      balanced: "出現頻度のバランスを重視した予想（ホットとコールドをバランス良く含める）",
      hot: "出現頻度の高い番号（ホットナンバー）を重視した予想",
      cold: "しばらく出ていない番号（コールドナンバー）を重視した予想",
    };

    // システムプロンプト（プロンプトキャッシュ対象）
    const systemPrompt = `あなたはロト6の統計分析の専門家です。過去の抽選データを分析して予想番号を提示します。

【重要なルール】
- ロト6は1〜43の数字から6個を選ぶ宝くじです
- 予想はあくまで統計的分析に基づくものであり、当選を保証するものではありません
- 返答は必ず指定のJSON形式で返してください

【直近100回の出現頻度データ】
${sortedByFreq.map((n) => `${n.number}番: ${n.count}回 (${n.rate})`).join(", ")}

【ホットナンバー（出現頻度上位10個）】
${hotNumbers.join(", ")}

【コールドナンバー（出現頻度下位10個）】
${coldNumbers.join(", ")}

【直近10回の抽選結果】
${recentDrawsText}`;

    // ユーザープロンプト
    const userPrompt = `${styleDesc[style]}を行い、${sets}セット分の予想番号を生成してください。

以下のJSON形式で返してください（他の文章は不要）:
{
  "predictions": [
    {
      "numbers": [1, 2, 3, 4, 5, 6],
      "bonus": 7,
      "reason": "選択理由の説明（日本語、50文字以内）"
    }
  ],
  "analysis_summary": "直近データの傾向分析（日本語、100文字以内）"
}

注意: numbersは1〜43の範囲内で重複なし6個、bonusも1〜43の範囲でnumbersと重複しないこと。`;

    // Claude API呼び出し（プロンプトキャッシュ対応）
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": c.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error("Claude API error:", errText);
      return c.json({ error: "AI予想の生成に失敗しました", code: "AI_ERROR" }, 500);
    }

    const apiData = (await apiResponse.json()) as {
      content: { type: string; text: string }[];
    };

    const rawText = apiData.content.find((b) => b.type === "text")?.text ?? "";

    // JSON部分を抽出してパース
    let parsed: PredictResponse;
    try {
      // コードブロック内のJSONを抽出
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON not found");
      parsed = JSON.parse(jsonMatch[0]) as PredictResponse;

      // バリデーション
      for (const p of parsed.predictions) {
        if (p.numbers.length !== 6) throw new Error("Invalid numbers count");
        if (p.numbers.some((n: number) => n < 1 || n > 43)) throw new Error("Number out of range");
        if (p.bonus < 1 || p.bonus > 43) throw new Error("Bonus out of range");
      }
    } catch (e) {
      console.error("Parse error:", e, "Raw:", rawText);
      // フォールバック: ランダムな予想を返す
      const fallbackPredictions: Prediction[] = [];
      for (let i = 0; i < sets; i++) {
        const nums = shuffleAndPick(43, 6);
        const bonus = shuffleAndPick(43, 1, nums)[0];
        fallbackPredictions.push({
          numbers: nums.sort((a, b) => a - b),
          bonus,
          reason: "統計データに基づくランダム予想",
        });
      }
      return c.json<PredictResponse>({
        predictions: fallbackPredictions,
        analysis_summary: "AIの応答をパースできなかったため、統計ベースの予想を生成しました。",
      });
    }

    return c.json<PredictResponse>(parsed);
  }
);

/** 1〜maxからn個を重複なしでランダムに選ぶ */
function shuffleAndPick(max: number, n: number, exclude: number[] = []): number[] {
  const pool = Array.from({ length: max }, (_, i) => i + 1).filter(
    (v) => !exclude.includes(v)
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export default predict;
