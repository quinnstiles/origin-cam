// ========================================
// CALCULATE SESSION DURATION
// ========================================

export function calculateDuration(
    session
) {

    // ====================================
    // VALIDATE SESSION
    // ====================================

    if (!session) {
        throw new Error(
            "Missing session"
        );
    }

    // ====================================
    // VALIDATE HEARTBEATS
    // ====================================

    if (
        session.firstHeartbeat === null
    ) {
        throw new Error(
            "Missing firstHeartbeat"
        );
    }

    if (
        session.lastHeartbeat === null
    ) {
        throw new Error(
            "Missing lastHeartbeat"
        );
    }

    // ====================================
    // VALIDATE GRACE TIME
    // ====================================

    if (
        typeof session.graceSeconds
        !== "number"
    ) {
        throw new Error(
            "Invalid graceSeconds"
        );
    }

    // ====================================
    // CALCULATE ACTIVE TIME
    // ====================================

    const activeMilliseconds =
        session.lastHeartbeat
        - session.firstHeartbeat;

    // ====================================
    // VALIDATE TIME
    // ====================================

    if (
        activeMilliseconds < 0
    ) {
        throw new Error(
            "Negative duration"
        );
    }

    // ====================================
    // CONVERT TO SECONDS
    // ====================================

    const activeSeconds =
        Math.ceil(
            activeMilliseconds / 1000
        );

    // ====================================
    // FINAL DURATION
    // ====================================

    const duration =
        activeSeconds
        + session.graceSeconds;

    // ====================================
    // FINAL VALIDATION
    // ====================================

    if (
        Number.isNaN(duration)
    ) {
        throw new Error(
            "Invalid duration"
        );
    }

    if (duration <= 0) {
        throw new Error(
            "Duration <= 0"
        );
    }

    return duration;
}

// ========================================
// CALCULATE REMAINING TIME
// ========================================

export function calculateRemainingSeconds(
    currentSeconds,
    duration
) {

    // ====================================
    // VALIDATE INPUTS
    // ====================================

    if (
        typeof currentSeconds
        !== "number"
    ) {
        throw new Error(
            "Invalid currentSeconds"
        );
    }

    if (
        typeof duration
        !== "number"
    ) {
        throw new Error(
            "Invalid duration"
        );
    }

    // ====================================
    // CALCULATE
    // ====================================

    const updated =
        currentSeconds - duration;

    // ====================================
    // CLAMP
    // ====================================

    if (updated < 0) {
        return 0;
    }

    return updated;
}