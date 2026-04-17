import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Draw, SimulationResponse, SimulationResult } from "../types.js";

const simulation = new Hono<{ Bindings: Env }>();

/** 当選シミュレーション
 * 指定した6個の番号が過去の抽選結果でどのくらい当選していたか確認する
 */
simulation.get(
  "/",
  zValidator(
    "query",
    z.object({
      n1: z.string().transform(Number),
      n2: z.string().transform(Number),
      n3: z.string().transform(Number),
      n4: z.string().transform(Number),
      n5: z.string().transform(Number),
      n6: z.string().transform(Number),
    })
  ),
  async (c) => {
    const q = c.req.valid("query");
    const inputNumbers = [q.n1, q.n2, q.n3, q.n4, q.n5, q.n6];

    // バリデーション
    for (const n of inputNumbers) {
      if (isNaN(n) || n < 1 || n > 43) {
        return c.json({ error: "番号は1〜43の整数を指定してください" }, 400);
      }
    }
    const uniqueNums = new Set(inputNumbers);
    if (uniqueNums.size !== 6) {
      return c.json({ error: "6個の番号は重複なしで指定してください" }, 400);
    }

    // 全抽選データを取得
    const { results: draws } = await c.env.DB.prepare(
      "SELECT * FROM draws ORDER BY draw_number DESC"
    ).all<Draw>();

    if (draws.length === 0) {
      return c.json({ error: "抽選データがありません" }, 400);
    }

    const sortedInput = [...inputNumbers].sort((a, b) => a - b);
    const results: SimulationResult[] = [];
    const prizeCounts = { "1st": 0, "2nd": 0, "3rd": 0, "4th": 0, "5th": 0, no_prize: 0 };

    for (const d of draws) {
      const drawnNums = [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6];
      const matchedNumbers = sortedInput.filter((n) => drawnNums.includes(n));
      const matchedCount = matchedNumbers.length;
      const bonusMatched = sortedInput.includes(d.bonus);

      // ロト6の当選判定
      // 1等: 本数字6個一致
      // 2等: 本数字5個一致 + ボーナス数字一致
      // 3等: 本数字5個一致
      // 4等: 本数字4個一致
      // 5等: 本数字3個一致
      let prizeRank = "落選";
      if (matchedCount === 6) {
        prizeRank = "1等";
        prizeCounts["1st"]++;
      } else if (matchedCount === 5 && bonusMatched) {
        prizeRank = "2等";
        prizeCounts["2nd"]++;
      } else if (matchedCount === 5) {
        prizeRank = "3等";
        prizeCounts["3rd"]++;
      } else if (matchedCount === 4) {
        prizeRank = "4等";
        prizeCounts["4th"]++;
      } else if (matchedCount === 3) {
        prizeRank = "5等";
        prizeCounts["5th"]++;
      } else {
        prizeCounts.no_prize++;
      }

      // 3個以上一致した結果のみ詳細に記録
      if (matchedCount >= 3) {
        results.push({
          draw_number: d.draw_number,
          draw_date: d.draw_date,
          matched_numbers: matchedNumbers,
          matched_count: matchedCount,
          bonus_matched: bonusMatched,
          prize_rank: prizeRank,
        });
      }
    }

    // マッチ数の多い順にソート
    results.sort((a, b) => b.matched_count - a.matched_count || b.draw_number - a.draw_number);

    return c.json<SimulationResponse>({
      input: sortedInput,
      results: prizeCounts,
      total_draws_checked: draws.length,
      details: results.slice(0, 50), // 詳細は最大50件
    });
  }
);

export default simulation;
