/** D1バインディングの型定義 */
export type Env = {
  DB: D1Database;
  FRONTEND_URL: string;
  ANTHROPIC_API_KEY: string;
};

/** ロト6抽選結果 */
export type Draw = {
  id: number;
  draw_number: number;
  draw_date: string;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  n6: number;
  bonus: number;
  prize1_winners: number | null;
  prize1_amount: number | null;
  created_at: string;
};

/** 番号の出現頻度情報 */
export type NumberFrequency = {
  number: number;
  count: number;
  rate: number;
  last_seen: number; // 最後に出てから何回経過したか
  bonus_count: number;
};

/** 出現頻度APIレスポンス */
export type FrequencyResponse = {
  total_draws: number;
  numbers: NumberFrequency[];
};

/** パターン分析APIレスポンス */
export type PatternResponse = {
  odd_even: Record<string, number>;
  consecutive_count: Record<string, number>;
  sum_distribution: { range: string; count: number }[];
  decade_distribution: Record<string, number>;
};

/** AI予想結果 */
export type Prediction = {
  numbers: number[];
  bonus: number;
  reason: string;
};

/** AI予想APIレスポンス */
export type PredictResponse = {
  predictions: Prediction[];
  analysis_summary: string;
};

/** 当選シミュレーション結果 */
export type SimulationResult = {
  draw_number: number;
  draw_date: string;
  matched_numbers: number[];
  matched_count: number;
  bonus_matched: boolean;
  prize_rank: string;
};

/** 当選シミュレーションAPIレスポンス */
export type SimulationResponse = {
  input: number[];
  results: {
    "1st": number;
    "2nd": number;
    "3rd": number;
    "4th": number;
    "5th": number;
    no_prize: number;
  };
  total_draws_checked: number;
  details: SimulationResult[];
};

/** 統一エラーレスポンス */
export type ErrorResponse = {
  error: string;
  code?: string;
};
