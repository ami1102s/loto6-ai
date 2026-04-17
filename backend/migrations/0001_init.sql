-- ロト6抽選結果テーブル
CREATE TABLE IF NOT EXISTS draws (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  draw_number    INTEGER UNIQUE NOT NULL,  -- 回号
  draw_date      TEXT NOT NULL,            -- 抽選日 (YYYY-MM-DD)
  n1             INTEGER NOT NULL,         -- 本数字1（昇順）
  n2             INTEGER NOT NULL,         -- 本数字2
  n3             INTEGER NOT NULL,         -- 本数字3
  n4             INTEGER NOT NULL,         -- 本数字4
  n5             INTEGER NOT NULL,         -- 本数字5
  n6             INTEGER NOT NULL,         -- 本数字6
  bonus          INTEGER NOT NULL,         -- ボーナス数字
  prize1_winners INTEGER,                  -- 1等当選者数
  prize1_amount  INTEGER,                  -- 1等賞金（円）
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 回号でのソートを高速化するインデックス
CREATE INDEX IF NOT EXISTS idx_draws_draw_number ON draws(draw_number);
-- 抽選日での検索を高速化するインデックス
CREATE INDEX IF NOT EXISTS idx_draws_draw_date ON draws(draw_date);
