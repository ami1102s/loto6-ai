#!/usr/bin/env node
/**
 * みずほ銀行公式CSVからロト6抽選データをD1にインポートするスクリプト
 *
 * 使い方:
 *   npx tsx scripts/import-csv.ts --file=./data/loto6.csv
 *
 * みずほ銀行CSVのダウンロード先:
 *   https://www.mizuhobank.co.jp/takarakuji/loto/loto6/result.html
 *   → 「全抽選結果CSV」をダウンロード
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// コマンドライン引数からファイルパスを取得
const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
if (!fileArg) {
  console.error("エラー: --file=<CSVファイルパス> を指定してください");
  process.exit(1);
}
const csvPath = fileArg.replace("--file=", "");

// CSVを読み込む（Shift-JIS → UTF-8変換はファイルが既にUTF-8の場合は不要）
const raw = readFileSync(csvPath);

// Shift-JISデコード（TextDecoderを使用）
let content: string;
try {
  content = new TextDecoder("shift-jis").decode(raw);
} catch {
  // UTF-8として読み込む
  content = raw.toString("utf-8");
}

const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");

const inserts: string[] = [];

for (const line of lines) {
  // ヘッダー行をスキップ（「第」から始まらない行）
  const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));

  // みずほ銀行CSVの形式:
  // 列0: 回号（例: 第1回 or 1）
  // 列1: 抽選日（例: 2000/10/05）
  // 列2〜7: 本数字1〜6
  // 列8: ボーナス数字
  // 列9: 1等当選者数
  // 列10: 1等賞金

  if (cols.length < 9) continue;

  // 回号を数値に変換
  const drawNumberRaw = cols[0].replace(/[^0-9]/g, "");
  if (!drawNumberRaw || isNaN(Number(drawNumberRaw))) continue;
  const drawNumber = Number(drawNumberRaw);

  // 日付をYYYY-MM-DD形式に変換
  const dateRaw = cols[1]; // 例: 2000/10/05
  if (!dateRaw || !dateRaw.includes("/")) continue;
  const dateParts = dateRaw.split("/");
  if (dateParts.length !== 3) continue;
  const drawDate = `${dateParts[0]}-${dateParts[1].padStart(2, "0")}-${dateParts[2].padStart(2, "0")}`;

  // 本数字1〜6を読み込んで昇順ソート
  const numbers: number[] = [];
  for (let i = 2; i <= 7; i++) {
    const n = Number(cols[i]);
    if (isNaN(n) || n < 1 || n > 43) break;
    numbers.push(n);
  }
  if (numbers.length !== 6) continue;
  numbers.sort((a, b) => a - b);

  // ボーナス数字
  const bonus = Number(cols[8]);
  if (isNaN(bonus) || bonus < 1 || bonus > 43) continue;

  // 1等当選者数・賞金（任意）
  const prize1Winners = cols[9] ? Number(cols[9].replace(/[^0-9]/g, "")) : null;
  const prize1Amount = cols[10] ? Number(cols[10].replace(/[^0-9]/g, "")) : null;

  const winnersVal = prize1Winners !== null && !isNaN(prize1Winners) ? prize1Winners : "NULL";
  const amountVal = prize1Amount !== null && !isNaN(prize1Amount) ? prize1Amount : "NULL";

  inserts.push(
    `INSERT OR IGNORE INTO draws (draw_number, draw_date, n1, n2, n3, n4, n5, n6, bonus, prize1_winners, prize1_amount) VALUES (${drawNumber}, '${drawDate}', ${numbers[0]}, ${numbers[1]}, ${numbers[2]}, ${numbers[3]}, ${numbers[4]}, ${numbers[5]}, ${bonus}, ${winnersVal}, ${amountVal});`
  );
}

if (inserts.length === 0) {
  console.error("インポートできるデータが見つかりませんでした。CSVのフォーマットを確認してください。");
  process.exit(1);
}

// SQLファイルに書き出す
const sqlPath = join(__dirname, "../data/import.sql");
writeFileSync(sqlPath, inserts.join("\n") + "\n", "utf-8");

console.log(`✅ ${inserts.length}件のデータをSQLファイルに出力しました: ${sqlPath}`);
console.log("");
console.log("次のコマンドでD1に取り込んでください:");
console.log("  npx wrangler d1 execute loto6-db --local --file=./data/import.sql");
console.log("  （本番環境の場合は --remote を使用）");
