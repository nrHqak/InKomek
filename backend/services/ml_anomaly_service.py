def detect_anomaly(vibration_values: list[float] | None, speed_values: list[float] | None) -> bool:
    # Fast threshold fallback that can be replaced with IsolationForest inference.
    if not vibration_values and not speed_values:
        return False

    vib_alert = False
    speed_alert = False

    if vibration_values:
        vib_avg = sum(abs(v) for v in vibration_values) / len(vibration_values)
        vib_alert = vib_avg > 1.8

    if speed_values:
        low_speed_count = sum(1 for speed in speed_values if speed < 0.2)
        speed_alert = low_speed_count >= max(3, len(speed_values) // 2)

    return vib_alert or speed_alert

