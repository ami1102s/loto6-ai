"""ロト6分析ロジック"""
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
