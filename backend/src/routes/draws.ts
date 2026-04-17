import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Draw } from "../types.js";

const draws = new Hono<{ Bindings: Env }>();

/** 抽選結果一覧 (ページング付き) */
draws.get(
  "/",
  zValidator(
    "query",
    z.object({
      limit: z.string().optional().transform((v) => Math.min(Number(v ?? "50"), 200)),
      offset: z.string().optional().transform((v) => Number(v ?? "0")),
    })
  ),
  async (c) => {
    const { limit, offset } = c.req.valid("query");
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM draws ORDER BY draw_number DESC LIMIT ? OFFSET ?"
    )
      .bind(limit, offset)
      .all<Draw>();

    const countRow = await c.env.DB.prepare("SELECT COUNT(*) as count FROM draws").first<{ count: number }>();
    const total = countRow?.count ?? 0;

    return c.json({ draws: results, total, limit, offset });
  }
);

/** 最新N回の抽選結果 */
draws.get(
  "/latest",
  zValidator(
    "query",
    z.object({
      n: z.string().optional().transform((v) => Math.min(Number(v ?? "10"), 50)),
    })
  ),
  async (c) => {
    const { n } = c.req.valid("query");
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM draws ORDER BY draw_number DESC LIMIT ?"
    )
      .bind(n)
      .all<Draw>();

    return c.json({ draws: results });
  }
);

/** 特定回の抽選結果 */
draws.get("/:number", async (c) => {
  const drawNumber = Number(c.req.param("number"));
  if (isNaN(drawNumber)) {
    return c.json({ error: "無効な回号です" }, 400);
  }

  const draw = await c.env.DB.prepare(
    "SELECT * FROM draws WHERE draw_number = ?"
  )
    .bind(drawNumber)
    .first<Draw>();

  if (!draw) {
    return c.json({ error: "指定された回号のデータが見つかりません" }, 404);
  }

  return c.json({ draw });
});

/** CSV一括インポート（管理用） */
draws.post(
  "/import",
  zValidator(
    "json",
    z.object({
      draws: z.array(
        z.object({
          draw_number: z.number().int().min(1),
          draw_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          n1: z.number().int().min(1).max(43),
          n2: z.number().int().min(1).max(43),
          n3: z.number().int().min(1).max(43),
          n4: z.number().int().min(1).max(43),
          n5: z.number().int().min(1).max(43),
          n6: z.number().int().min(1).max(43),
          bonus: z.number().int().min(1).max(43),
          prize1_winners: z.number().int().nullable().optional(),
          prize1_amount: z.number().int().nullable().optional(),
        })
      ).max(2000),
    })
  ),
  async (c) => {
    const { draws: data } = c.req.valid("json");

    let imported = 0;
    let skipped = 0;

    // バッチINSERT
    const stmt = c.env.DB.prepare(
      "INSERT OR IGNORE INTO draws (draw_number, draw_date, n1, n2, n3, n4, n5, n6, bonus, prize1_winners, prize1_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    const batch = data.map((d) =>
      stmt.bind(
        d.draw_number,
        d.draw_date,
        d.n1,
        d.n2,
        d.n3,
        d.n4,
        d.n5,
        d.n6,
        d.bonus,
        d.prize1_winners ?? null,
        d.prize1_amount ?? null
      )
    );

    const results = await c.env.DB.batch(batch);
    for (const r of results) {
      if ((r.meta.changes ?? 0) > 0) {
        imported++;
      } else {
        skipped++;
      }
    }

    return c.json({ imported, skipped, total: data.length });
  }
);

export default draws;
