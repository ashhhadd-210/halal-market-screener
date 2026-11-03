# services/linear_regression_candles.py
import numpy as np
from services.utils import build_indicator_sticker, confirm_if_needed, format_price_value


# -------------------------------------------------
# LINEAR REGRESSION CANDLES
# -------------------------------------------------

def compute_linreg_candles(candles, lr_length=11, signal_smoothing=7):

    n = len(candles)

    if n < lr_length + signal_smoothing:
        return None

    closes = np.array([c["close"] for c in candles])

    x = np.arange(lr_length)

    lr_values = []

    for i in range(lr_length, n + 1):

        window = closes[i - lr_length:i]

        slope, intercept = np.polyfit(x, window, 1)

        value = intercept + slope * (lr_length - 1)

        lr_values.append(value)

    lr_values = np.array(lr_values)

    kernel = np.ones(signal_smoothing) / signal_smoothing

    smoothed = np.convolve(
        lr_values,
        kernel,
        mode="valid"
    )

    return smoothed


# -------------------------------------------------
# RULE EVALUATION
# -------------------------------------------------

def evaluate_linreg_candle_rules(candles, lr_line, config):

    window = int(config.get("window", 1) or 1)

    if window <= 0:
        window = 1

    if len(lr_line) < window:
        return False

    position_rule = config.get("price_position")

    if not position_rule:
        return False

    close_rule = config.get("close_location")
    tolerance_pct = abs(float(config.get("tolerance_pct", 0) or 0))
    start_lr_idx = len(lr_line) - window
    candle_offset = len(candles) - len(lr_line)

    for lr_idx in range(start_lr_idx, len(lr_line)):
        candle_idx = candle_offset + lr_idx

        if candle_idx < 0 or candle_idx >= len(candles):
            continue

        candle = candles[candle_idx]
        line = float(lr_line[lr_idx])

        if not check_price_position(candle, line, position_rule, tolerance_pct):
            continue

        if close_rule and not check_close_location(candle, line, close_rule, tolerance_pct):
            continue

        if config.get("confirmation") and not confirm_if_needed(candles, candle_idx, config):
            continue

        return True

    return False


# -------------------------------------------------
# PRICE POSITION LOGIC
# -------------------------------------------------

def check_price_position(candle, line, rule, tolerance_pct=0):
    tolerance = abs(line) * (float(tolerance_pct) / 100.0)

    if rule == "above":
        return candle["low"] >= (line - tolerance)

    if rule == "below":
        return candle["high"] <= (line + tolerance)

    if rule == "on":
        return candle["low"] <= (line + tolerance) and candle["high"] >= (line - tolerance)

    if rule == "piercing_from_below":
        return candle["open"] <= (line + tolerance) and candle["close"] >= (line - tolerance)

    if rule == "piercing_from_above":
        return candle["open"] >= (line - tolerance) and candle["close"] <= (line + tolerance)

    return False


# -------------------------------------------------
# CLOSE LOCATION LOGIC
# -------------------------------------------------

def check_close_location(candle, line, rule, tolerance_pct=0):
    configured_tolerance = abs(line) * (float(tolerance_pct) / 100.0)

    if rule == "close_above":
        return candle["close"] >= (line - configured_tolerance)

    if rule == "close_below":
        return candle["close"] <= (line + configured_tolerance)

    if rule == "close_on":
        tolerance = max(abs(line) * 0.001, configured_tolerance)
        return abs(candle["close"] - line) <= tolerance

    return False


# -------------------------------------------------
# STICKER
# -------------------------------------------------

def build_linreg_candle_sticker(candles, lr_line, config):
    match = _latest_matching_linreg_index(candles, lr_line, config)
    candle_idx = match["candle_idx"]
    lr_idx = match["lr_idx"]
    candle = candles[candle_idx] if candles and candle_idx < len(candles) else {}
    line_value = float(lr_line[lr_idx]) if len(lr_line) else 0.0
    candle_close = float(candles[candle_idx]["close"]) if candles and candle_idx < len(candles) else 0.0
    pos = config.get("price_position")
    close = config.get("close_location")

    return build_indicator_sticker(
        "LinReg Candles",
        f"Close {format_price_value(candle_close)} vs line {format_price_value(line_value)}",
        config,
        length=config.get("lr_length", 11),
        decision=_linreg_decision(candle, pos, close),
    )


def _latest_matching_linreg_index(candles, lr_line, config):
    if not candles or len(lr_line) == 0:
        return {"candle_idx": 0, "lr_idx": 0}

    window = max(1, int(config.get("window", 1) or 1))
    start_lr_idx = max(0, len(lr_line) - window)
    candle_offset = len(candles) - len(lr_line)
    latest_match = None
    tolerance_pct = abs(float(config.get("tolerance_pct", 0) or 0))

    for lr_idx in range(start_lr_idx, len(lr_line)):
        candle_idx = candle_offset + lr_idx
        if candle_idx < 0 or candle_idx >= len(candles):
            continue

        candle = candles[candle_idx]
        line = float(lr_line[lr_idx])

        if not check_price_position(candle, line, config.get("price_position"), tolerance_pct):
            continue
        close_rule = config.get("close_location")
        if close_rule and not check_close_location(candle, line, close_rule, tolerance_pct):
            continue

        latest_match = {"candle_idx": candle_idx, "lr_idx": lr_idx}

    if latest_match is not None:
        return latest_match

    last_lr_idx = len(lr_line) - 1
    return {
        "candle_idx": max(0, candle_offset + last_lr_idx),
        "lr_idx": last_lr_idx,
    }


def _linreg_decision(candle, position_rule, close_rule):
    bias = _linreg_candle_bias_label(candle)
    rule_labels = []

    position_label = _linreg_rule_label(position_rule)
    close_label = _linreg_rule_label(close_rule)

    if position_label:
        rule_labels.append(position_label)
    if close_label:
        rule_labels.append(close_label)

    if rule_labels:
        return f"{bias} Candle {' + '.join(rule_labels)}"

    return f"{bias} Candle Match"


def _linreg_candle_bias_label(candle):
    open_price = float(candle.get("open", 0.0) or 0.0)
    close_price = float(candle.get("close", 0.0) or 0.0)

    if close_price > open_price:
        return "Bullish"
    if close_price < open_price:
        return "Bearish"
    return "Neutral"


def _linreg_rule_label(rule):
    normalized = str(rule or "").strip().lower()
    mapping = {
        "above": "Above Line",
        "below": "Below Line",
        "on": "On Line",
        "piercing_from_below": "Piercing From Below",
        "piercing_from_above": "Piercing From Above",
        "close_above": "Close Above Line",
        "close_below": "Close Below Line",
        "close_on": "Close On Line",
    }
    return mapping.get(normalized)
