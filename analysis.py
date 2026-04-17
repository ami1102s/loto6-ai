"""ロト6分析ロジック"""
import random
from typing import Any


def calc_frequency(draws: list[dict]) -> list[dict]:
    """各番号（1〜43）の出現頻度を計算する"""
    count = [0] * 44        # index 1〜43
    bonus_count = [0] * 44
    last_seen = [-1] * 44   # 最後に出た回のindex（0=最新）

    for i, d in enumerate(draws):
        nums = [d["n1"], d["n2"], d["n3"], d["n4"], d["n5"], d["n6"]]
        for n in nums:
            count[n] += 1
            if last_seen[n] == -1:
                last_seen[n] = i
        bonus = d["bonus"]
        bonus_count[bonus] += 1
        if last_seen[bonus] == -1:
            last_seen[bonus] = i

    total = len(draws)
    result = []
    for n in range(1, 44):
        result.append({
            "number": n,
            "count": count[n],
            "rate": round(count[n] / total, 4) if total > 0 else 0,
            "last_seen": last_seen[n] if last_seen[n] != -1 else total,
            "bonus_count": bonus_count[n],
        })
    return result


def calc_patterns(draws: list[dict]) -> dict[str, Any]:
    """奇偶比・連番・合計値分布・十の位分布を計算する"""
    odd_even: dict[str, int] = {}
    consecutive_count: dict[str, int] = {}
    sum_buckets: dict[str, int] = {}
    decade_total: dict[str, int] = {"1-9": 0, "10-19": 0, "20-29": 0, "30-39": 0, "40-43": 0}

    for d in draws:
        nums = sorted([d["n1"], d["n2"], d["n3"], d["n4"], d["n5"], d["n6"]])

        # 奇偶比
        odd = sum(1 for n in nums if n % 2 != 0)
        key = f"{odd}奇{6 - odd}偶"
        odd_even[key] = odd_even.get(key, 0) + 1

        # 連番ペア数
        pairs = sum(1 for i in range(len(nums) - 1) if nums[i + 1] - nums[i] == 1)
        ckey = "連番なし" if pairs == 0 else f"連番{pairs}ペア"
        consecutive_count[ckey] = consecutive_count.get(ckey, 0) + 1

        # 合計値分布（20刻み）
        total_sum = sum(nums)
        bucket_min = (total_sum // 20) * 20
        skey = f"{bucket_min}-{bucket_min + 19}"
        sum_buckets[skey] = sum_buckets.get(skey, 0) + 1

        # 十の位分布
        for n in nums:
            if n <= 9:
                decade_total["1-9"] += 1
            elif n <= 19:
                decade_total["10-19"] += 1
            elif n <= 29:
                decade_total["20-29"] += 1
            elif n <= 39:
                decade_total["30-39"] += 1
            else:
                decade_total["40-43"] += 1

    total = len(draws)

    # 合計値分布をソート
    sum_distribution = sorted(
        [{"range": k, "count": v} for k, v in sum_buckets.items()],
        key=lambda x: int(x["range"].split("-")[0])
    )

    # 十の位は1回あたり平均出現数
    decade_avg = {k: round(v / total, 3) if total > 0 else 0 for k, v in decade_total.items()}

    return {
        "odd_even": dict(sorted(odd_even.items(), key=lambda x: -x[1])),
        "consecutive_count": dict(sorted(consecutive_count.items(), key=lambda x: -x[1])),
        "sum_distribution": sum_distribution,
        "decade_distribution": decade_avg,
    }


def calc_simulation(draws: list[dict], input_numbers: list[int]) -> dict[str, Any]:
    """指定した6個の番号が過去どれだけ当選していたか計算する"""
    prize_counts = {"1st": 0, "2nd": 0, "3rd": 0, "4th": 0, "5th": 0, "no_prize": 0}
    details = []

    for d in draws:
        drawn = {d["n1"], d["n2"], d["n3"], d["n4"], d["n5"], d["n6"]}
        matched = [n for n in input_numbers if n in drawn]
        matched_count = len(matched)
        bonus_matched = d["bonus"] in input_numbers

        if matched_count == 6:
            rank = "1等"
            prize_counts["1st"] += 1
        elif matched_count == 5 and bonus_matched:
            rank = "2等"
            prize_counts["2nd"] += 1
        elif matched_count == 5:
            rank = "3等"
            prize_counts["3rd"] += 1
        elif matched_count == 4:
            rank = "4等"
            prize_counts["4th"] += 1
        elif matched_count == 3:
            rank = "5等"
            prize_counts["5th"] += 1
        else:
            rank = "落選"
            prize_counts["no_prize"] += 1

        if matched_count >= 3:
            details.append({
                "draw_number": d["draw_number"],
                "draw_date": d["draw_date"],
                "matched_numbers": sorted(matched),
                "matched_count": matched_count,
                "bonus_matched": bonus_matched,
                "prize_rank": rank,
            })

    details.sort(key=lambda x: (-x["matched_count"], -x["draw_number"]))
    return {
        "results": prize_counts,
        "details": details[:50],
    }


def calc_prediction(draws: list[dict], sets: int = 3, style: str = "balanced") -> dict[str, Any]:
    """
    統計データに基づいて予想番号を生成する（外部API不使用）

    style:
      "balanced" - 出現頻度の中央付近を重視（バランス型）
      "hot"      - 出現頻度の高い番号を重視
      "cold"     - しばらく出ていない番号（不在回数が多い）を重視
    """
    if not draws:
        return {"predictions": [], "analysis_summary": "データがありません"}

    freq = calc_frequency(draws)
    total = len(draws)

    # 各番号のスコアを計算
    counts = [f["count"] for f in freq]
    max_count = max(counts) or 1
    min_count = min(counts) or 1
    max_absent = max(f["last_seen"] for f in freq) or 1

    weights: list[float] = []
    for f in freq:
        if style == "hot":
            # 出現回数が多いほど高スコア
            w = (f["count"] / max_count) ** 2 + 0.1
        elif style == "cold":
            # 不在回数が多いほど高スコア（長く出ていない番号を優先）
            w = (f["last_seen"] / max_absent) ** 2 + 0.1
        else:  # balanced
            # 出現頻度が平均に近いほど高スコア（極端な偏りを避ける）
            avg = total * 6 / 43
            deviation = abs(f["count"] - avg) / (max_count - min_count + 1)
            w = (1 - deviation) + 0.2
        weights.append(max(w, 0.01))

    numbers_pool = [f["number"] for f in freq]  # 1〜43

    # 統計サマリーを生成
    sorted_by_freq = sorted(freq, key=lambda x: -x["count"])
    hot_top3 = [n["number"] for n in sorted_by_freq[:3]]
    cold_top3 = [n["number"] for n in sorted_by_freq[-3:]]
    avg_count = round(total * 6 / 43, 1)
    summary = (
        f"直近{total}回の分析: "
        f"ホット上位3({hot_top3})、"
        f"コールド下位3({cold_top3})、"
        f"平均出現{avg_count}回"
    )

    predictions = []
    used_sets: list[set] = []  # 重複セットを避けるために記録

    attempt = 0
    while len(predictions) < sets and attempt < sets * 20:
        attempt += 1

        # 重み付きランダムサンプリングで6個選ぶ
        chosen = weighted_sample(numbers_pool, weights, 6)
        if chosen is None:
            continue
        chosen_set = frozenset(chosen)

        # 同じセットが既に出ていたらスキップ
        if chosen_set in [frozenset(s) for s in used_sets]:
            continue

        sorted_chosen = sorted(chosen)

        # ボーナス数字（選ばれた6個以外からランダム）
        remaining = [n for n in numbers_pool if n not in chosen_set]
        remaining_weights = [weights[n - 1] for n in remaining]
        bonus_list = weighted_sample(remaining, remaining_weights, 1)
        bonus = bonus_list[0] if bonus_list else random.choice(remaining)

        # 選択理由を生成
        reason = _make_reason(sorted_chosen, freq, style, total)

        predictions.append({
            "numbers": sorted_chosen,
            "bonus": bonus,
            "reason": reason,
        })
        used_sets.append(sorted_chosen)

    return {
        "predictions": predictions,
        "analysis_summary": summary,
    }


def weighted_sample(population: list, weights: list[float], k: int) -> list | None:
    """重み付きランダムサンプリング（重複なし）"""
    if k > len(population):
        return None
    pool = list(zip(population, weights))
    result = []
    for _ in range(k):
        if not pool:
            break
        total_w = sum(w for _, w in pool)
        r = random.uniform(0, total_w)
        cumulative = 0.0
        for i, (item, w) in enumerate(pool):
            cumulative += w
            if r <= cumulative:
                result.append(item)
                pool.pop(i)
                break
    return result if len(result) == k else None


def _make_reason(numbers: list[int], freq: list[dict], style: str, total: int) -> str:
    """選択番号の統計的な特徴を簡潔に説明する"""
    freq_map = {f["number"]: f for f in freq}
    counts = [freq_map[n]["count"] for n in numbers]
    avg_count = round(total * 6 / 43, 1)
    chosen_avg = round(sum(counts) / len(counts), 1)

    odd_count = sum(1 for n in numbers if n % 2 != 0)
    total_sum = sum(numbers)

    # 連番チェック
    pairs = sum(1 for i in range(len(numbers) - 1) if numbers[i + 1] - numbers[i] == 1)

    parts = []
    if style == "hot":
        parts.append(f"高頻度番号中心（平均{chosen_avg}回）")
    elif style == "cold":
        absent_avg = round(sum(freq_map[n]["last_seen"] for n in numbers) / len(numbers), 1)
        parts.append(f"平均{absent_avg}回不在の番号を選択")
    else:
        parts.append(f"出現頻度バランス型（平均{chosen_avg}回）")

    parts.append(f"奇{odd_count}偶{6 - odd_count}")
    parts.append(f"合計{total_sum}")
    if pairs > 0:
        parts.append(f"連番{pairs}ペア含む")

    return " / ".join(parts)
