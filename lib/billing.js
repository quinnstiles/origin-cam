// ========================================
// CALCULATE SESSION DURATION
// ========================================

export function calculateDuration(session) {

    if (!session) {
        throw new Error("Missing session");
    }

    if (!session.createdAt) {
        throw new Error("Missing createdAt");
    }

    const now = Date.now();

    const elapsedMs =
        now - session.createdAt;

    const duration =
        Math.floor(elapsedMs / 1000);

    if (
        isNaN(duration) ||
        duration < 0
    ) {
        throw new Error(
            "Invalid duration"
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

    if (
        isNaN(currentSeconds) ||
        isNaN(duration)
    ) {
        throw new Error(
            "Invalid billing values"
        );
    }

    const remaining =
        currentSeconds - duration;

    return Math.max(
        0,
        Math.floor(remaining)
    );
}