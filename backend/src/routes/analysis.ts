import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Draw, FrequencyResponse, NumberFrequency, PatternResponse } from "../types.js";

const analysis = new Hono<{ Bindings: Env }>();

/** 出現頻度分析
 * ?recent=N で直近N回に絞り込める
 */
analysis.get(
  "/frequency",
  zValidator(
    "query",
    z.object({
      recent: z.string().optional().transform((v) => (v ? Number(v) : undefined)),
    })
  ),
  async (c) => {
    const { recent } = c.req.valid("query");

    // 対象データ取得
    let rows: Draw[];
    if (recent && recent > 0) {
      const { results } = await c.env.DB.prepare(
        "SELECT * FROM draws ORDER BY draw_number DESC LIMIT ?"
      )
        .bind(recent)
        .all<Draw>();
      rows = results;
    } else {
      const { results } = await c.env.DB.prepare(
        "SELECT * FROM draws ORDER BY draw_number DESC"
      ).all<Draw>();
      rows = results;
    }

    const totalDraws = rows.length;
    if (totalDraws === 0) {
      return c.json<FrequencyResponse>({ total_draws: 0, numbers: [] });
    }

    // 各番号のカウント
    const count = new Array<number>(44).fill(0); // index 1〜43を使用
    const bonusCount = new Array<number>(44).fill(0);
    const lastSeen = new Array<number>(44).fill(-1); // 最後に出た回のindex（0=最新）

    for (let i = 0; i < rows.length; i++) {
      const d = rows[i];
      const nums = [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6];
      for (const n of nums) {
        count[n]++;
        if (lastSeen[n] === -1) lastSeen[n] = i; // 最初に見つけたindex
      }
      bonusCount[d.bonus]++;
      if (lastSeen[d.bonus] === -1) lastSeen[d.bonus] = i;
    }

    const numbers: NumberFrequency[] = [];
    for (let n = 1; n <= 43; n++) {
      numbers.push({
        number: n,
        count: count[n],
        rate: totalDraws > 0 ? count[n] / totalDraws : 0,
        last_seen: lastSeen[n] === -1 ? totalDraws : lastSeen[n], // -1は一度も出ていない
        bonus_count: bonusCount[n],
      });
    }

    return c.json<FrequencyResponse>({ total_draws: totalDraws, numbers });
  }
);

/** パターン分析
 * 奇偶比・連番・合計値分布・十の位分布を分析
 */
analysis.get(
  "/patterns",
  zValidator(
    "query",
    z.object({
      recent: z.string().optional().transform((v) => (v ? Number(v) : undefined)),
    })
  ),
  async (c) => {
    const { recent } = c.req.valid("query");

    let rows: Draw[];
    if (recent && recent > 0) {
      const { results } = await c.env.DB.prepare(
        "SELECT * FROM draws ORDER BY draw_number DESC LIMIT ?"
      )
        .bind(recent)
        .all<Draw>();
      rows = results;
    } else {
      const { results } = await c.env.DB.prepare(
        "SELECT * FROM draws ORDER BY draw_number DESC"
      ).all<Draw>();
      rows = results;
    }

    if (rows.length === 0) {
      return c.json<PatternResponse>({
        odd_even: {},
        consecutive_count: {},
        sum_distribution: [],
        decade_distribution: {},
      });
    }

    // 奇数・偶数のカウント
    const oddEven: Record<string, number> = {};
    // 連番のカウント
    const consecutiveCount: Record<string, number> = {};
    // 合計値の分布（10刻み）
    const sumBuckets: Record<string, number> = {};
    // 十の位ごとの合計出現数
    const decadeTotal: Record<string, number> = {
      "1-9": 0,
      "10-19": 0,
      "20-29": 0,
      "30-39": 0,
      "40-43": 0,
    };
    let totalDecadeNumbers = 0;

    for (const d of rows) {
      const nums = [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6];

      // 奇偶比
      const oddCount = nums.filter((n) => n % 2 !== 0).length;
      const evenCount = 6 - oddCount;
      const key = `${oddCount}奇${evenCount}偶`;
      oddEven[key] = (oddEven[key] ?? 0) + 1;

      // 連番カウント（隣接する数字のペア数を数える）
      const sortedNums = [...nums].sort((a, b) => a - b);
      let pairs = 0;
      for (let i = 0; i < sortedNums.length - 1; i++) {
        if (sortedNums[i + 1] - sortedNums[i] === 1) pairs++;
      }
      const cKey = pairs === 0 ? "連番なし" : `連番${pairs}ペア`;
      consecutiveCount[cKey] = (consecutiveCount[cKey] ?? 0) + 1;

      // 合計値分布
      const sum = nums.reduce((a, b) => a + b, 0);
      const bucketMin = Math.floor(sum / 20) * 20;
      const bucketMax = bucketMin + 19;
      const sKey = `${bucketMin}-${bucketMax}`;
      sumBuckets[sKey] = (sumBuckets[sKey] ?? 0) + 1;

      // 十の位分布
      for (const n of nums) {
        if (n <= 9) decadeTotal["1-9"]++;
        else if (n <= 19) decadeTotal["10-19"]++;
        else if (n <= 29) decadeTotal["20-29"]++;
        else if (n <= 39) decadeTotal["30-39"]++;
        else decadeTotal["40-43"]++;
        totalDecadeNumbers++;
      }
    }

    // 合計値分布をソートして返す
    const sumDistribution = Object.entries(sumBuckets)
      .map(([range, count]) => ({ range, count }))
      .sort((a, b) => {
        const aMin = Number(a.range.split("-")[0]);
        const bMin = Number(b.range.split("-")[0]);
        return aMin - bMin;
      });

    // 十の位は平均出現数/回に変換
    const decadeDistribution: Record<string, number> = {};
    for (const [k, v] of Object.entries(decadeTotal)) {
      decadeDistribution[k] = rows.length > 0 ? v / rows.length : 0;
    }

    return c.json<PatternResponse>({
      odd_even: oddEven,
      consecutive_count: consecutiveCount,
      sum_distribution: sumDistribution,
      decade_distribution: decadeDistribution,
    });
  }
);

export default analysis;
