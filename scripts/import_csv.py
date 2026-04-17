"""
みずほ銀行公式CSVをロト6DBにインポートするスクリプト

使い方:
    python scripts/import_csv.py data/loto6.csv

みずほ銀行CSVのダウンロード先:
    https://www.mizuhobank.co.jp/takarakuji/loto/loto6/result.html
    → 「全回抽選結果一覧」のCSVをダウンロード
"""

import sys
import csv
import json
import urllib.request
from pathlib import Path

# プロジェクトルートからの実行を想定
sys.path.insert(0, str(Path(__file__).parent.parent))

from db import get_db, init_db


def parse_row(row: list[str]) -> dict | None:
    """CSVの1行をパースしてdictに変換する。不正行はNoneを返す"""
    # 空行・ヘッダー行をスキップ
    if len(row) < 9:
        return None

    # 回号（数字以外を除去）
    draw_number_str = "".join(c for c in row[0] if c.isdigit())
    if not draw_number_str:
        return None
    draw_number = int(draw_number_str)

    # 抽選日（YYYY/MM/DD → YYYY-MM-DD）
    date_raw = row[1].strip()
    if "/" not in date_raw:
        return None
    parts = date_raw.split("/")
    if len(parts) != 3:
        return None
    draw_date = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"

    # 本数字6個
    numbers = []
    for i in range(2, 8):
        val = "".join(c for c in row[i] if c.isdigit())
        if not val:
            return None
        n = int(val)
        if n < 1 or n > 43:
            return None
        numbers.append(n)
    if len(numbers) != 6:
        return None
    numbers.sort()

    # ボーナス数字
    bonus_str = "".join(c for c in row[8] if c.isdigit())
    if not bonus_str:
        return None
    bonus = int(bonus_str)
    if bonus < 1 or bonus > 43:
        return None

    # 1等当選者数・賞金（任意）
    prize1_winners = None
    prize1_amount = None
    if len(row) > 9:
        w = "".join(c for c in row[9] if c.isdigit())
        if w:
            prize1_winners = int(w)
    if len(row) > 10:
        a = "".join(c for c in row[10] if c.isdigit())
        if a:
            prize1_amount = int(a)

    return {
        "draw_number": draw_number,
        "draw_date": draw_date,
        "n1": numbers[0],
        "n2": numbers[1],
        "n3": numbers[2],
        "n4": numbers[3],
        "n5": numbers[4],
        "n6": numbers[5],
        "bonus": bonus,
        "prize1_winners": prize1_winners,
        "prize1_amount": prize1_amount,
    }


def import_csv(filepath: str) -> tuple[int, int]:
    """CSVファイルをDBに取り込む。(imported, skipped)を返す"""
    init_db()
    path = Path(filepath)
    if not path.exists():
        print(f"エラー: ファイルが見つかりません: {filepath}")
        sys.exit(1)

    # Shift-JISとUTF-8を両方試みる
    for encoding in ("shift-jis", "utf-8", "utf-8-sig"):
        try:
            with open(path, encoding=encoding, errors="strict") as f:
                rows = list(csv.reader(f))
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        print("エラー: ファイルのエンコーディングを判定できませんでした")
        sys.exit(1)

    conn = get_db()
    imported = skipped = 0

    for row in rows:
        record = parse_row(row)
        if record is None:
            continue
        try:
            conn.execute(
                """INSERT OR IGNORE INTO draws
                   (draw_number, draw_date, n1, n2, n3, n4, n5, n6, bonus,
                    prize1_winners, prize1_amount)
                   VALUES (:draw_number, :draw_date,
                           :n1, :n2, :n3, :n4, :n5, :n6,
                           :bonus, :prize1_winners, :prize1_amount)""",
                record,
            )
            if conn.execute("SELECT changes()").fetchone()[0] > 0:
                imported += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"警告: 第{record.get('draw_number')}回のインポートに失敗: {e}")
            skipped += 1

    conn.commit()
    conn.close()
    return imported, skipped


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使い方: python scripts/import_csv.py <CSVファイルパス>")
        print("例:     python scripts/import_csv.py data/loto6.csv")
        sys.exit(1)

    csv_file = sys.argv[1]
    print(f"インポート中: {csv_file}")
    imported, skipped = import_csv(csv_file)
    print(f"✅ 完了: {imported}件インポート、{skipped}件スキップ（重複）")
