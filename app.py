"""ロト6 予想分析AI - Flask アプリ"""
import json
import os
import requests
from flask import Flask, render_template, request, jsonify

from db import get_db, init_db
from analysis import calc_frequency, calc_patterns, calc_simulation

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
# AI予想（Claude API）
# ─────────────────────────────────────────
@app.route("/predict", methods=["GET", "POST"])
def predict():
    result = None
    error = None

    if request.method == "POST":
        sets = int(request.form.get("sets", 3))
        style = request.form.get("style", "balanced")
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")

        if not api_key:
            error = "環境変数 ANTHROPIC_API_KEY が設定されていません。"
        else:
            conn = get_db()
            rows = conn.execute(
                "SELECT * FROM draws ORDER BY draw_number DESC LIMIT 100"
            ).fetchall()
            conn.close()
            draws_list = [dict(r) for r in rows]

            if not draws_list:
                error = "抽選データがありません。先にCSVをインポートしてください。"
            else:
                result, error = _call_claude(api_key, draws_list, sets, style)

    return render_template("predict.html", result=result, error=error)


def _call_claude(api_key: str, draws: list[dict], sets: int, style: str):
    """Claude APIを呼び出してAI予想を取得する"""
    numbers_freq = calc_frequency(draws)
    total = len(draws)

    sorted_freq = sorted(numbers_freq, key=lambda x: -x["count"])
    hot = [n["number"] for n in sorted_freq[:10]]
    cold = [n["number"] for n in sorted_freq[-10:]]

    freq_text = ", ".join(
        f"{n['number']}番:{n['count']}回({n['rate']*100:.1f}%)"
        for n in numbers_freq
    )
    recent_text = "\n".join(
        f"第{d['draw_number']}回({d['draw_date']}): "
        f"{d['n1']},{d['n2']},{d['n3']},{d['n4']},{d['n5']},{d['n6']} ボーナス:{d['bonus']}"
        for d in draws[:10]
    )
    style_desc = {
        "balanced": "ホットとコールドをバランス良く組み合わせた予想",
        "hot": "出現頻度の高いホットナンバーを重視した予想",
        "cold": "しばらく出ていないコールドナンバーを重視した予想",
    }

    system_prompt = f"""あなたはロト6の統計分析専門家です。

【直近{total}回の出現頻度】
{freq_text}

【ホットナンバー上位10個】{hot}
【コールドナンバー下位10個】{cold}

【直近10回の抽選結果】
{recent_text}"""

    user_prompt = f"""{style_desc[style]}を{sets}セット生成してください。

必ず以下のJSON形式のみで返してください（説明文不要）:
{{
  "predictions": [
    {{"numbers": [1,2,3,4,5,6], "bonus": 7, "reason": "選択理由（30文字以内）"}}
  ],
  "analysis_summary": "直近データの傾向（60文字以内）"
}}

ルール: numbersは1〜43の範囲で重複なし6個、bonusはnumbersと重複しない1〜43の整数。"""

    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "prompt-caching-2024-07-31",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 1024,
                "system": [
                    {"type": "text", "text": system_prompt,
                     "cache_control": {"type": "ephemeral"}}
                ],
                "messages": [{"role": "user", "content": user_prompt}],
            },
            timeout=30,
        )
        resp.raise_for_status()
        text = resp.json()["content"][0]["text"]

        # JSONを抽出してパース
        import re
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return None, "AIの応答からJSONを取得できませんでした。"
        data = json.loads(match.group())
        return data, None

    except requests.Timeout:
        return None, "タイムアウトしました。もう一度試してください。"
    except Exception as e:
        return None, f"エラーが発生しました: {str(e)}"


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
