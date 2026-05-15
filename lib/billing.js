// ========================================
// CALCULATE SESSION DURATION (SECONDS)
// ========================================

export function calculateDuration(session) {
    if (!session) {
        throw new Error("Missing session");
    }

    if (!session.createdAt) {
        throw new Error("Missing createdAt");
    }

    const now = Date.now();

    // ensure numeric safety
    const startTime = Number(session.createdAt);

    if (isNaN(startTime)) {
        throw new Error("Invalid createdAt timestamp");
    }

    const elapsedMs = now - startTime;

    const duration = Math.floor(elapsedMs / 1000);

    // prevent negative / corrupted clock issues
    if (!Number.isFinite(duration) || duration < 0) {
        return 0;
    }

    return duration;
}


// ========================================
// CALCULATE BILLABLE DURATION (WITH GRACE)
// ========================================

export function calculateBillableDuration(session) {
    const rawDuration = calculateDuration(session);

    const grace =
        Number(session?.graceSeconds || 0);

    if (isNaN(grace) || grace < 0) {
        throw new Error("Invalid graceSeconds");
    }

    const billableDuration =
        rawDuration - grace;

    return Math.max(0, Math.floor(billableDuration));
}


// ========================================
// CALCULATE REMAINING TIME
// ========================================

export function calculateRemainingSeconds(
    currentSeconds,
    duration
) {
    const current = Number(currentSeconds);
    const used = Number(duration);

    if (isNaN(current) || isNaN(used)) {
        throw new Error("Invalid billing values");
    }

    const remaining = current - used;

    return Math.max(0, Math.floor(remaining));
}