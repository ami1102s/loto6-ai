"""データベース初期化・接続ユーティリティ"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "instance" / "loto6.db"


def get_db() -> sqlite3.Connection:
    """DBに接続してRowFactoryをdictに設定して返す"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """DBとテーブルを初期化する"""
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS draws (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            draw_number    INTEGER UNIQUE NOT NULL,
            draw_date      TEXT NOT NULL,
            n1             INTEGER NOT NULL,
            n2             INTEGER NOT NULL,
            n3             INTEGER NOT NULL,
            n4             INTEGER NOT NULL,
            n5             INTEGER NOT NULL,
            n6             INTEGER NOT NULL,
            bonus          INTEGER NOT NULL,
            prize1_winners INTEGER,
            prize1_amount  INTEGER,
            created_at     TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_draws_number ON draws(draw_number);
        CREATE INDEX IF NOT EXISTS idx_draws_date   ON draws(draw_date);
    """)
    conn.commit()
    conn.close()
