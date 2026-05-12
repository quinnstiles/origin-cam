// ========================================
// FILE:
// lib/time.js
// ========================================

// ========================================
// GRACE TIME
// ========================================

export const GRACE_TIME =
    Number(process.env.GRACE_TIME || 10);

// ========================================
// NOW
// ========================================

export function nowSeconds() {

    return Math.floor(Date.now() / 1000);
}

// ========================================
// CREATE TOTAL SESSION TIME
// ========================================

export function createTotalSessionTime(
    remainingSeconds
) {

    return (
        Number(remainingSeconds || 0) +
        GRACE_TIME
    );
}

// ========================================
// CALCULATE ELAPSED
// ========================================

export function calculateElapsed(
    startedAt
) {

    const elapsed =
        nowSeconds() - startedAt;

    return Math.max(0, elapsed);
}

// ========================================
// CALCULATE REMAINING
// ========================================

export function calculateRemaining({

    totalSessionTime,
    startedAt

}) {

    const elapsed =
        calculateElapsed(startedAt);

    const remaining =
        totalSessionTime - elapsed;

    return Math.max(0, remaining);
}

// ========================================
// SESSION FINISHED
// ========================================

export function isSessionExpired({

    totalSessionTime,
    startedAt

}) {

    const remaining =
        calculateRemaining({
            totalSessionTime,
            startedAt
        });

    return remaining <= 0;
}