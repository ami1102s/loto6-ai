"""
ロト6抽選データをDBにインポートするスクリプト
CSV(.csv)とExcel(.xlsx)の両方に対応

使い方:
    python scripts/import_csv.py data/1601.xlsx
    python scripts/import_csv.py data/loto6.csv
"""

import sys
import csv
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from db import get_db, init_db


def parse_row(row: list) -> dict | None:
    """1行をパースしてdictに変換する。不正行はNoneを返す"""
    if len(row) < 9:
        return None

    # 回号（数字以外を除去）
    draw_number_str = "".join(c for c in str(row[0]) if c.isdigit())
    if not draw_number_str:
        return None
    draw_number = int(draw_number_str)

    # 抽選日（YYYY/MM/DD → YYYY-MM-DD、datetimeオブジェクトも対応）
    date_raw = row[1]
    if hasattr(date_raw, "strftime"):
        # openpyxlがdatetimeで返す場合
        draw_date = date_raw.strftime("%Y-%m-%d")
    else:
        date_str = str(date_raw).strip()
        if "/" not in date_str:
            return None
        parts = date_str.split("/")
        if len(parts) != 3:
            return None
        draw_date = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"

    # 本数字6個
    numbers = []
    for i in range(2, 8):
        try:
            n = int(str(row[i]).strip().replace(",", ""))
        except (ValueError, TypeError):
            return None
        if n < 1 or n > 43:
            return None
        numbers.append(n)
    if len(numbers) != 6:
        return None
    numbers.sort()

    # ボーナス数字
    try:
        bonus = int(str(row[8]).strip().replace(",", ""))
    except (ValueError, TypeError):
        return None
    if bonus < 1 or bonus > 43:
        return None

    # 1等当選者数・賞金（列があれば取得）
    prize1_winners = None
    prize1_amount = None
    if len(row) > 9 and row[9] not in (None, "", "None"):
        try:
            prize1_winners = int(str(row[9]).replace(",", "").strip())
        except ValueError:
            pass
    if len(row) > 10 and row[10] not in (None, "", "None"):
        try:
            prize1_amount = int(str(row[10]).replace(",", "").strip())
        except ValueError:
            pass

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


def load_rows(filepath: Path) -> list[list]:
    """CSV または xlsx を行のリストとして読み込む"""
    suffix = filepath.suffix.lower()

    if suffix == ".xlsx":
        import openpyxl
        wb = openpyxl.load_workbook(filepath, data_only=True)
        ws = wb.active
        return [list(row) for row in ws.iter_rows(values_only=True)]

    # CSV（Shift-JIS / UTF-8 を自動判定）
    for encoding in ("shift-jis", "utf-8", "utf-8-sig"):
        try:
            with open(filepath, encoding=encoding, errors="strict") as f:
                return list(csv.reader(f))
        except (UnicodeDecodeError, LookupError):
            continue

    print("エラー: ファイルのエンコーディングを判定できませんでした")
    sys.exit(1)


def import_file(filepath: str) -> tuple[int, int]:
    """ファイルをDBに取り込む。(imported, skipped)を返す"""
    init_db()
    path = Path(filepath)
    if not path.exists():
        print(f"エラー: ファイルが見つかりません: {filepath}")
        sys.exit(1)

    rows = load_rows(path)
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
            print(f"警告: 第{record.get('draw_number')}回 インポート失敗: {e}")
            skipped += 1

    conn.commit()
    conn.close()
    return imported, skipped


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使い方: python scripts/import_csv.py <ファイルパス>")
        print("例:     python scripts/import_csv.py data/1601.xlsx")
        sys.exit(1)

    target = sys.argv[1]
    print(f"インポート中: {target}")
    imported, skipped = import_file(target)
    print(f"完了: {imported}件インポート、{skipped}件スキップ（重複）")
