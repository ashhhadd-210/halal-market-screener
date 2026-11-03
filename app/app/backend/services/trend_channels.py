# services/trend_channels.py

from collections import defaultdict

import numpy as np

from services.utils import detect_touch, confirm_if_needed


MIN_TREND_HISTORY = 40
VOLUME_BREAK_MULTIPLIER = 1.15
RANGE_BREAK_MULTIPLIER = 1.2


# =========================================================
# COMPUTE TREND CHANNEL
# =========================================================

def required_trend_channel_history(length=8):
    normalized_length = max(2, int(length or 8))
    # Pivot/liquidity channels need more runway than the regression fallback
    # so the screener can confirm enough swings before evaluating the latest bar.
    return min(500, max(normalized_length * 9, normalized_length * 2 + 5, MIN_TREND_HISTORY))


def compute_trend_channel(candles, length=8, wait_for_break=True, show_last_channel=True):
    normalized_length = max(2, int(length or 8))
    confirmed_pivots = _collect_confirmed_pivots(candles, normalized_length)

    pivot_channel = _compute_pivot_liquidity_channel(
        candles,
        normalized_length,
        confirmed_pivots=confirmed_pivots,
        wait_for_break=bool(wait_for_break),
        show_last_channel=bool(show_last_channel),
    )
    if pivot_channel is not None:
        return pivot_channel

    high_pivots = sum(1 for pivot in confirmed_pivots if pivot["type"] == "high")
    low_pivots = sum(1 for pivot in confirmed_pivots if pivot["type"] == "low")
    if high_pivots < 2 or low_pivots < 2:
        return _compute_regression_fallback_channel(candles, normalized_length)

    return None


def _compute_pivot_liquidity_channel(
    candles,
    length,
    confirmed_pivots=None,
    wait_for_break=True,
    show_last_channel=True,
):
    if len(candles) < max(length * 2 + 1, 5):
        return None

    pivots_by_confirm_index = defaultdict(list)
    for pivot in confirmed_pivots or _collect_confirmed_pivots(candles, length):
        pivots_by_confirm_index[pivot["confirm_index"]].append(pivot)

    recent_highs = []
    recent_lows = []
    active_channel = None
    last_channel = None

    for current_index in range(len(candles)):
        for pivot in pivots_by_confirm_index.get(current_index, []):
            if pivot["type"] == "high":
                recent_highs.append(pivot)
            else:
                recent_lows.append(pivot)

        if active_channel is None:
            candidate = _best_channel_candidate(
                recent_highs,
                recent_lows,
                candles,
                current_index,
                length,
            )
            if candidate is not None:
                active_channel = candidate
                last_channel = dict(candidate)
            continue

        break_event = _detect_liquidity_break(
            candles,
            active_channel,
            current_index,
            length,
        )
        if break_event is not None:
            active_channel["broken"] = True
            active_channel["break_index"] = current_index
            active_channel["break_direction"] = break_event["direction"]
            active_channel["liquidity_break"] = break_event["liquidity"]
            last_channel = dict(active_channel)
            active_channel = None
            recent_highs = [pivot for pivot in recent_highs if pivot["index"] > current_index]
            recent_lows = [pivot for pivot in recent_lows if pivot["index"] > current_index]
            continue

        if not wait_for_break:
            replacement = _best_channel_candidate(
                recent_highs,
                recent_lows,
                candles,
                current_index,
                length,
            )
            if replacement is not None and _replacement_channel_is_better(replacement, active_channel):
                active_channel = replacement
                last_channel = dict(replacement)

    channel_state = active_channel or (last_channel if show_last_channel else None)
    if channel_state is None:
        return None

    return _build_rendered_channel(channel_state, len(candles) - 1)


def _collect_confirmed_pivots(candles, pivot_span):
    pivots = []

    if len(candles) < pivot_span * 2 + 1:
        return pivots

    for index in range(pivot_span, len(candles) - pivot_span):
        if _is_pivot_high(candles, index, pivot_span):
            pivots.append(
                {
                    "type": "high",
                    "index": index,
                    "price": float(candles[index]["high"]),
                    "confirm_index": index + pivot_span,
                }
            )
        if _is_pivot_low(candles, index, pivot_span):
            pivots.append(
                {
                    "type": "low",
                    "index": index,
                    "price": float(candles[index]["low"]),
                    "confirm_index": index + pivot_span,
                }
            )

    return sorted(
        pivots,
        key=lambda pivot: (
            pivot["confirm_index"],
            pivot["index"],
            0 if pivot["type"] == "low" else 1,
        ),
    )


def _is_pivot_high(candles, index, span):
    highs = [float(candle["high"]) for candle in candles[index - span:index + span + 1]]
    current = highs[span]
    left = highs[:span]
    right = highs[span + 1:]

    return (
        current == max(highs)
        and current > max(left)
        and current >= max(right)
    )


def _is_pivot_low(candles, index, span):
    lows = [float(candle["low"]) for candle in candles[index - span:index + span + 1]]
    current = lows[span]
    left = lows[:span]
    right = lows[span + 1:]

    return (
        current == min(lows)
        and current < min(left)
        and current <= min(right)
    )


def _best_channel_candidate(recent_highs, recent_lows, candles, current_index, length):
    high_candidates = recent_highs[-4:]
    low_candidates = recent_lows[-4:]
    best = None

    if len(high_candidates) < 2 or len(low_candidates) < 2:
        return None

    for high_start in range(len(high_candidates) - 1):
        for high_end in range(high_start + 1, len(high_candidates)):
            high_pair = (high_candidates[high_start], high_candidates[high_end])
            for low_start in range(len(low_candidates) - 1):
                for low_end in range(low_start + 1, len(low_candidates)):
                    low_pair = (low_candidates[low_start], low_candidates[low_end])
                    candidate = _build_channel_candidate(
                        high_pair,
                        low_pair,
                        candles,
                        current_index,
                        length,
                    )
                    if candidate is None:
                        continue

                    if best is None or _candidate_sort_key(candidate) > _candidate_sort_key(best):
                        best = candidate

    return best


def _build_channel_candidate(high_pair, low_pair, candles, current_index, length):
    high_first, high_second = high_pair
    low_first, low_second = low_pair

    top_span = high_second["index"] - high_first["index"]
    bottom_span = low_second["index"] - low_first["index"]
    if top_span <= 0 or bottom_span <= 0:
        return None

    top_slope = (high_second["price"] - high_first["price"]) / float(top_span)
    bottom_slope = (low_second["price"] - low_first["price"]) / float(bottom_span)
    direction = _trend_direction(top_slope, bottom_slope, candles[current_index])
    if direction is None:
        return None

    slope = 0.0 if direction == "flat" else (top_slope + bottom_slope) / 2.0
    if not _slopes_are_compatible(top_slope, bottom_slope, candles[current_index], length):
        return None

    top_intercept = np.mean(
        [high_first["price"] - slope * high_first["index"], high_second["price"] - slope * high_second["index"]]
    )
    bottom_intercept = np.mean(
        [low_first["price"] - slope * low_first["index"], low_second["price"] - slope * low_second["index"]]
    )

    start_index = min(high_first["index"], high_second["index"], low_first["index"], low_second["index"])
    anchor_end_index = max(high_second["index"], low_second["index"])
    if anchor_end_index - start_index < max(2, length):
        return None

    channel_width = _channel_width(slope, top_intercept, bottom_intercept, anchor_end_index)
    if channel_width <= 1e-9:
        return None

    hard_breaches, touch_score = _channel_fit_stats(
        candles,
        slope,
        top_intercept,
        bottom_intercept,
        start_index,
        current_index,
        anchor_pivot_indexes={
            high_first["index"],
            high_second["index"],
            low_first["index"],
            low_second["index"],
        },
    )

    allowed_hard_breaches = max(2, int((current_index - start_index + 1) * 0.12))
    if hard_breaches > allowed_hard_breaches:
        return None

    return {
        "slope": slope,
        "top_intercept": float(top_intercept),
        "bottom_intercept": float(bottom_intercept),
        "start_index": start_index,
        "anchor_end_index": anchor_end_index,
        "created_at": current_index,
        "direction": direction,
        "broken": False,
        "break_index": None,
        "break_direction": None,
        "liquidity_break": False,
        "score": touch_score - hard_breaches * 3,
    }


def _trend_direction(top_slope, bottom_slope, reference_candle):
    price_scale = max(abs(float(reference_candle["close"])), 1.0)
    slope_epsilon = price_scale * 0.00025

    top_flat = abs(top_slope) <= slope_epsilon
    bottom_flat = abs(bottom_slope) <= slope_epsilon

    if top_flat and bottom_flat:
        return "flat"

    if top_slope >= -slope_epsilon and bottom_slope >= -slope_epsilon:
        return "up"

    if top_slope <= slope_epsilon and bottom_slope <= slope_epsilon:
        return "down"

    return None


def _slopes_are_compatible(top_slope, bottom_slope, reference_candle, length):
    price_scale = max(abs(float(reference_candle["close"])), 1.0)
    slope_epsilon = max(price_scale * 0.00025, 1e-9)
    average_slope = max((abs(top_slope) + abs(bottom_slope)) / 2.0, slope_epsilon)
    max_gap = average_slope * 0.85 + (price_scale / max(2, int(length or 2))) * 0.001
    return abs(top_slope - bottom_slope) <= max_gap


def _channel_fit_stats(
    candles,
    slope,
    top_intercept,
    bottom_intercept,
    start_index,
    end_index,
    anchor_pivot_indexes,
):
    channel_width = _channel_width(slope, top_intercept, bottom_intercept, end_index)
    touch_tolerance = max(channel_width * 0.12, abs(float(candles[end_index]["close"])) * 0.002)
    hard_breach_tolerance = max(channel_width * 0.28, abs(float(candles[end_index]["close"])) * 0.004)

    hard_breaches = 0
    touches = 0

    for candle_index in range(start_index, end_index + 1):
        candle = candles[candle_index]
        top_value = _line_value_at_index(slope, top_intercept, candle_index)
        bottom_value = _line_value_at_index(slope, bottom_intercept, candle_index)
        high_value = float(candle["high"])
        low_value = float(candle["low"])

        upper_excess = max(0.0, high_value - top_value)
        lower_excess = max(0.0, bottom_value - low_value)
        if candle_index not in anchor_pivot_indexes and (
            upper_excess > hard_breach_tolerance or lower_excess > hard_breach_tolerance
        ):
            hard_breaches += 1

        if abs(high_value - top_value) <= touch_tolerance:
            touches += 1
        if abs(low_value - bottom_value) <= touch_tolerance:
            touches += 1

    return hard_breaches, touches


def _detect_liquidity_break(candles, channel_state, current_index, length):
    if current_index <= channel_state["anchor_end_index"]:
        return None

    candle = candles[current_index]
    top_value = _line_value_at_index(channel_state["slope"], channel_state["top_intercept"], current_index)
    bottom_value = _line_value_at_index(channel_state["slope"], channel_state["bottom_intercept"], current_index)
    channel_width = max(top_value - bottom_value, 1e-9)

    close_value = float(candle["close"])
    high_value = float(candle["high"])
    low_value = float(candle["low"])
    close_buffer = max(channel_width * 0.05, abs(close_value) * 0.0015)
    wick_buffer = max(channel_width * 0.12, abs(close_value) * 0.0025)

    direction = None
    if close_value > top_value + close_buffer or high_value > top_value + wick_buffer:
        direction = "up"
    elif close_value < bottom_value - close_buffer or low_value < bottom_value - wick_buffer:
        direction = "down"

    if direction is None:
        return None

    liquidity = (
        _volume_is_elevated(candles, current_index, window=max(length * 2, 10))
        or _range_is_elevated(candles, current_index, window=max(length, 5))
    )
    if liquidity:
        return {
            "direction": direction,
            "liquidity": True,
        }

    if current_index <= 0:
        return None

    previous_candle = candles[current_index - 1]
    previous_top = _line_value_at_index(channel_state["slope"], channel_state["top_intercept"], current_index - 1)
    previous_bottom = _line_value_at_index(channel_state["slope"], channel_state["bottom_intercept"], current_index - 1)

    if direction == "up" and float(previous_candle["close"]) > previous_top + close_buffer:
        return {
            "direction": direction,
            "liquidity": False,
        }

    if direction == "down" and float(previous_candle["close"]) < previous_bottom - close_buffer:
        return {
            "direction": direction,
            "liquidity": False,
        }

    return None


def _volume_is_elevated(candles, current_index, window):
    current_volume = _candle_float(candles[current_index], "volume")
    if current_volume is None or current_volume <= 0:
        return False

    volumes = [
        volume
        for volume in (
            _candle_float(candle, "volume")
            for candle in candles[max(0, current_index - window):current_index]
        )
        if volume is not None and volume > 0
    ]
    if len(volumes) < 3:
        return False

    average_volume = sum(volumes) / float(len(volumes))
    return current_volume >= average_volume * VOLUME_BREAK_MULTIPLIER


def _range_is_elevated(candles, current_index, window):
    current_range = _candle_range(candles[current_index])
    historical_ranges = [
        _candle_range(candle)
        for candle in candles[max(0, current_index - window):current_index]
    ]
    if len(historical_ranges) < 3:
        return False

    average_range = sum(historical_ranges) / float(len(historical_ranges))
    return current_range >= average_range * RANGE_BREAK_MULTIPLIER


def _candle_range(candle):
    return max(float(candle["high"]) - float(candle["low"]), 1e-9)


def _candle_float(candle, key):
    try:
        return float(candle[key])
    except (KeyError, TypeError, ValueError):
        return None


def _candidate_sort_key(candidate):
    return (
        candidate["created_at"],
        candidate["score"],
        candidate["anchor_end_index"],
        -candidate["start_index"],
    )


def _replacement_channel_is_better(replacement, active_channel):
    return _candidate_sort_key(replacement) > _candidate_sort_key(active_channel)


def _build_rendered_channel(channel_state, current_index):
    x = np.arange(channel_state["start_index"], current_index + 1)
    top = channel_state["top_intercept"] + channel_state["slope"] * x
    bottom = channel_state["bottom_intercept"] + channel_state["slope"] * x
    middle = (top + bottom) / 2.0

    width = np.maximum(top - bottom, 1e-9)
    zone_buffer = np.maximum(width * 0.2, np.mean(width) * 0.05)

    return {
        "middle": middle,
        "top": top,
        "bottom": bottom,
        "top_zone_upper": top + zone_buffer,
        "top_zone_lower": top,
        "bottom_zone_upper": bottom,
        "bottom_zone_lower": bottom - zone_buffer,
        "length": len(x),
        "model": "pivot_liquidity",
        "direction": channel_state["direction"],
        "start_index": channel_state["start_index"],
        "broken": bool(channel_state.get("broken")),
        "break_index": channel_state.get("break_index"),
        "break_direction": channel_state.get("break_direction"),
        "liquidity_break": bool(channel_state.get("liquidity_break")),
    }


def _line_value_at_index(slope, intercept, candle_index):
    return float(intercept) + float(slope) * float(candle_index)


def _channel_width(slope, top_intercept, bottom_intercept, candle_index):
    return _line_value_at_index(slope, top_intercept, candle_index) - _line_value_at_index(
        slope,
        bottom_intercept,
        candle_index,
    )


def _compute_regression_fallback_channel(candles, length):
    if len(candles) < length:
        return None

    highs = np.array([c["high"] for c in candles[-length:]], dtype=float)
    lows = np.array([c["low"] for c in candles[-length:]], dtype=float)

    x = np.arange(length)

    try:
        top_slope, top_intercept = np.polyfit(x, highs, 1)
        bottom_slope, bottom_intercept = np.polyfit(x, lows, 1)
    except Exception:
        return None

    mid_slope = (top_slope + bottom_slope) / 2.0
    mid_intercept = (top_intercept + bottom_intercept) / 2.0
    mid = mid_intercept + mid_slope * x

    top_dev = max(float(np.max(highs - mid)), 1e-9)
    bottom_dev = max(float(np.max(mid - lows)), 1e-9)
    top = mid + top_dev
    bottom = mid - bottom_dev

    width = np.maximum(top - bottom, 1e-9)
    zone_buffer = np.maximum(width * 0.2, np.mean(width) * 0.05)

    return {
        "middle": mid,
        "top": top,
        "bottom": bottom,
        "top_zone_upper": top + zone_buffer,
        "top_zone_lower": top,
        "bottom_zone_upper": bottom,
        "bottom_zone_lower": bottom - zone_buffer,
        "length": length,
        "model": "regression_fallback",
        "direction": "unknown",
        "start_index": len(candles) - length,
        "broken": False,
        "break_index": None,
        "break_direction": None,
        "liquidity_break": False,
    }


# =========================================================
# EVALUATE RULES
# =========================================================

def evaluate_trend_channel_rules(candles, tc, config):

    selected_areas = config.get("areas", [])

    if not selected_areas:
        return False

    for area_rule in selected_areas:

        if not evaluate_single_area(
            candles,
            tc,
            area_rule
        ):
            return False

    return True


# =========================================================
# SINGLE AREA EVALUATION
# =========================================================

def evaluate_single_area(candles, tc, rule):

    area = rule.get("area")
    window = int(rule.get("window", 1) or 1)

    length = tc["length"]
    start_index = len(candles) - length
    action = str(rule.get("action") or "").strip().lower()

    if action in {"closed_above", "closed_below", "on_line"}:
        line_series, direction = _line_series_for_area(tc, area)
        if line_series is None:
            return False

        signal_start_index = _current_line_signal_start_index(
            candles,
            line_series,
            start_index,
            rule,
            direction,
        )
        if signal_start_index is None:
            return False

        if (len(candles) - signal_start_index) > window:
            return False

        return confirm_if_needed(candles, signal_start_index, rule)

    recent_candles = candles[-window:]

    for i in range(window):

        candle = recent_candles[i]

        candle_index = len(candles) - window + i
        regression_index = candle_index - start_index

        if regression_index < 0 or regression_index >= length:
            continue

        # -----------------------------
        # LINE AREAS
        # -----------------------------

        if area == "top_line":

            line_value = tc["top"][regression_index]

            if evaluate_line_action(candle, line_value, rule, "up"):
                if confirm_if_needed(candles, candle_index, rule):
                    return True

        elif area == "bottom_line":

            line_value = tc["bottom"][regression_index]

            if evaluate_line_action(candle, line_value, rule, "down"):
                if confirm_if_needed(candles, candle_index, rule):
                    return True

        elif area == "middle_line":

            line_value = tc["middle"][regression_index]

            if evaluate_line_action(candle, line_value, rule):
                if confirm_if_needed(candles, candle_index, rule):
                    return True

        # -----------------------------
        # ZONE AREAS
        # -----------------------------

        elif area == "top_zone":

            lower = tc["top_zone_lower"][regression_index]
            upper = tc["top_zone_upper"][regression_index]

            if evaluate_zone_action(candle, lower, upper, rule, "up"):
                if confirm_if_needed(candles, candle_index, rule):
                    return True

        elif area == "bottom_zone":

            lower = tc["bottom_zone_lower"][regression_index]
            upper = tc["bottom_zone_upper"][regression_index]

            if evaluate_zone_action(candle, lower, upper, rule, "down"):
                if confirm_if_needed(candles, candle_index, rule):
                    return True

    return False


def _line_series_for_area(tc, area):
    if area == "top_line":
        return tc.get("top"), "up"

    if area == "bottom_line":
        return tc.get("bottom"), "down"

    if area == "middle_line":
        return tc.get("middle"), None

    return None, None


def _current_line_signal_start_index(
    candles,
    line_series,
    start_index,
    rule,
    direction=None,
):
    latest_index = len(candles) - 1

    if latest_index < 0:
        return None

    if not _line_action_matches_index(
        candles,
        line_series,
        latest_index,
        start_index,
        rule,
        direction,
    ):
        return None

    signal_start_index = latest_index

    while signal_start_index - 1 >= 0:
        previous_index = signal_start_index - 1
        if not _line_action_matches_index(
            candles,
            line_series,
            previous_index,
            start_index,
            rule,
            direction,
        ):
            break
        signal_start_index = previous_index

    return signal_start_index


def _line_action_matches_index(
    candles,
    line_series,
    candle_index,
    start_index,
    rule,
    direction=None,
):
    regression_index = candle_index - start_index

    if regression_index < 0 or regression_index >= len(line_series):
        return False

    return evaluate_line_action(
        candles[candle_index],
        line_series[regression_index],
        rule,
        direction,
    )


# =========================================================
# LINE ACTIONS
# =========================================================

def evaluate_line_action(candle, line_value, rule, direction=None):

    action = rule.get("action")
    lower_tol, upper_tol = _line_tolerance_bounds(line_value, rule)

    if action == "touched":
        return detect_touch(candle, lower_tol, upper_tol, rule, direction=direction)

    if action == "closed_above":
        return candle["close"] > upper_tol

    if action == "closed_below":
        return candle["close"] < lower_tol

    if action == "on_line":
        on_line_lower, on_line_upper = _line_tolerance_bounds(line_value, rule, default_pct=0.1)
        return on_line_lower <= candle["close"] <= on_line_upper

    if action == "breach":
        return detect_breach(candle, line_value, rule, direction)

    return False


def _line_tolerance_bounds(line_value, rule, default_pct=0.0):
    tolerance_pct = float(rule.get("tolerance", default_pct) or default_pct)
    tolerance = abs(float(line_value)) * (tolerance_pct / 100.0)
    return float(line_value) - tolerance, float(line_value) + tolerance


# =========================================================
# ZONE ACTIONS
# =========================================================

def evaluate_zone_action(candle, lower, upper, rule, direction=None):

    action = rule.get("action")

    # candle intersects zone
    wick_entry = candle["low"] <= upper and candle["high"] >= lower

    if action == "entered":
        return wick_entry

    if action == "rejected":

        if not wick_entry:
            return False

        if direction == "up":
            return candle["close"] < lower

        if direction == "down":
            return candle["close"] > upper

    if action == "breach":
        breach_direction = rule.get("breach_direction", "any")
        if breach_direction == "up":
            direction = "up"
        elif breach_direction == "down":
            direction = "down"

        breach_type = rule.get("breach_type", rule.get("touch_type", "wick"))
        if breach_type in {"body", "both"}:
            if direction == "up":
                body_high = max(candle["open"], candle["close"])
                if body_high > upper:
                    return True
            if direction == "down":
                body_low = min(candle["open"], candle["close"])
                if body_low < lower:
                    return True
            if direction is None and (
                max(candle["open"], candle["close"]) > upper
                or min(candle["open"], candle["close"]) < lower
            ):
                return True

        if breach_type in {"wick", "both"}:
            if direction == "up":
                return candle["high"] > upper
            if direction == "down":
                return candle["low"] < lower
            return candle["high"] > upper or candle["low"] < lower

    return False


# =========================================================
# BREACH DETECTION
# =========================================================

def detect_breach(candle, line_value, rule, direction=None):
    breach_type = rule.get("breach_type", rule.get("touch_type", "wick"))
    breach_direction = rule.get("breach_direction", "any")

    if breach_direction == "up":
        direction = "up"
    elif breach_direction == "down":
        direction = "down"

    wick_up = candle["high"] > line_value
    wick_down = candle["low"] < line_value
    body_up = max(candle["open"], candle["close"]) > line_value
    body_down = min(candle["open"], candle["close"]) < line_value

    if breach_type == "body":
        if direction == "up":
            return body_up
        if direction == "down":
            return body_down
        return body_up or body_down

    if breach_type == "both":
        if direction == "up":
            return wick_up or body_up
        if direction == "down":
            return wick_down or body_down
        return wick_up or wick_down or body_up or body_down

    if direction == "up":
        return wick_up
    if direction == "down":
        return wick_down
    return wick_up or wick_down
