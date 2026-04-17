"""ロト6 予想分析AI - Flask アプリ"""
import json
from flask import Flask, render_template, request, jsonify

from db import get_db, init_db
from analysis import calc_frequency, calc_patterns, calc_simulation, calc_prediction

app = Flask(__name__)

# 起動時にDBを初期化
with app.app_context():
    init_db()


# ─────────────────────────────────────────
# ホーム
# ─────────────────────────────────────────
@app.route("/")
def index():
    conn = get_db()
    draws = conn.execute(
        "SELECT * FROM draws ORDER BY draw_number DESC LIMIT 10"
    ).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM draws").fetchone()[0]
    conn.close()
    return render_template("index.html", draws=draws, total=total)


# ─────────────────────────────────────────
# 過去結果一覧
# ─────────────────────────────────────────
@app.route("/draws")
def draws():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = 50
    offset = (page - 1) * per_page

    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM draws ORDER BY draw_number DESC LIMIT ? OFFSET ?",
        (per_page, offset)
    ).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM draws").fetchone()[0]
    conn.close()

    total_pages = (total + per_page - 1) // per_page
    return render_template("draws.html", draws=rows, page=page,
                           total_pages=total_pages, total=total)


# ─────────────────────────────────────────
# 出現頻度分析
# ─────────────────────────────────────────
@app.route("/frequency")
def frequency():
    recent = request.args.get("recent", type=int, default=0)
    conn = get_db()
    if recent and recent > 0:
        rows = conn.execute(
            "SELECT * FROM draws ORDER BY draw_number DESC LIMIT ?", (recent,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM draws ORDER BY draw_number DESC"
        ).fetchall()
    conn.close()

    draws_list = [dict(r) for r in rows]
    numbers = calc_frequency(draws_list)
    total_draws = len(draws_list)

    # ホット/コールド判定（上位20%=ホット、下位20%=コールド）
    sorted_by_count = sorted(numbers, key=lambda x: -x["count"])
    top_n = max(1, len(numbers) // 5)
    hot_set = {n["number"] for n in sorted_by_count[:top_n]}
    cold_set = {n["number"] for n in sorted_by_count[-top_n:]}
    for n in numbers:
        if n["number"] in hot_set:
            n["highlight"] = "hot"
        elif n["number"] in cold_set:
            n["highlight"] = "cold"
        else:
            n["highlight"] = "normal"

    # テンプレートで使うホット/コールドランキング（Python側でソート済み）
    hot_ranking = sorted(numbers, key=lambda x: -x["count"])[:10]
    cold_ranking = sorted(numbers, key=lambda x: x["count"])[:10]

    return render_template("frequency.html",
                           numbers=numbers,
                           hot_ranking=hot_ranking,
                           cold_ranking=cold_ranking,
                           total_draws=total_draws,
                           recent=recent,
                           numbers_json=json.dumps(numbers))


# ─────────────────────────────────────────
# パターン分析
# ─────────────────────────────────────────
@app.route("/patterns")
def patterns():
    recent = request.args.get("recent", type=int, default=0)
    conn = get_db()
    if recent and recent > 0:
        rows = conn.execute(
            "SELECT * FROM draws ORDER BY draw_number DESC LIMIT ?", (recent,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM draws ORDER BY draw_number DESC"
        ).fetchall()
    conn.close()

    draws_list = [dict(r) for r in rows]
    data = calc_patterns(draws_list)

    return render_template("patterns.html",
                           data=data,
                           total_draws=len(draws_list),
                           recent=recent,
                           data_json=json.dumps(data))


# ─────────────────────────────────────────
# 統計予想（外部API不使用）
# ─────────────────────────────────────────
@app.route("/predict", methods=["GET", "POST"])
def predict():
    result = None
    error = None

    if request.method == "POST":
        sets = int(request.form.get("sets", 3))
        style = request.form.get("style", "balanced")

        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM draws ORDER BY draw_number DESC LIMIT 200"
        ).fetchall()
        conn.close()
        draws_list = [dict(r) for r in rows]

        if not draws_list:
            error = "抽選データがありません。先にExcelファイルをインポートしてください。"
        else:
            result = calc_prediction(draws_list, sets=sets, style=style)

    return render_template("predict.html", result=result, error=error)


# ─────────────────────────────────────────
# 当選シミュレーション
# ─────────────────────────────────────────
@app.route("/simulation", methods=["GET", "POST"])
def simulation():
    result = None
    error = None
    input_numbers = []

    if request.method == "POST":
        try:
            nums_str = request.form.get("numbers", "")
            input_numbers = [int(x.strip()) for x in nums_str.split(",") if x.strip()]

            if len(input_numbers) != 6:
                error = "6個の番号をカンマ区切りで入力してください（例: 3,12,22,31,38,43）"
            elif any(n < 1 or n > 43 for n in input_numbers):
                error = "番号は1〜43の範囲で入力してください"
            elif len(set(input_numbers)) != 6:
                error = "重複しない6個の番号を入力してください"
            else:
                conn = get_db()
                rows = conn.execute(
                    "SELECT * FROM draws ORDER BY draw_number DESC"
                ).fetchall()
                conn.close()
                draws_list = [dict(r) for r in rows]

                if not draws_list:
                    error = "抽選データがありません。先にCSVをインポートしてください。"
                else:
                    sim = calc_simulation(draws_list, sorted(input_numbers))
                    result = {
                        "input": sorted(input_numbers),
                        "total": len(draws_list),
                        **sim,
                    }
        except ValueError:
            error = "番号は数字で入力してください"

    return render_template("simulation.html",
                           result=result,
                           error=error,
                           input_numbers=",".join(map(str, input_numbers)))


# ─────────────────────────────────────────
# CSV インポート API（スクリプトからPOSTで呼ぶ）
# ─────────────────────────────────────────
@app.route("/api/import", methods=["POST"])
def api_import():
    data = request.get_json()
    if not data or "draws" not in data:
        return jsonify({"error": "drawsキーが必要です"}), 400

    conn = get_db()
    imported = skipped = 0
    for d in data["draws"]:
        try:
            conn.execute(
                """INSERT OR IGNORE INTO draws
                   (draw_number, draw_date, n1, n2, n3, n4, n5, n6, bonus,
                    prize1_winners, prize1_amount)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (d["draw_number"], d["draw_date"],
                 d["n1"], d["n2"], d["n3"], d["n4"], d["n5"], d["n6"],
                 d["bonus"],
                 d.get("prize1_winners"), d.get("prize1_amount"))
            )
            imported += 1
        except Exception:
            skipped += 1
    conn.commit()
    conn.close()
    return jsonify({"imported": imported, "skipped": skipped})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
