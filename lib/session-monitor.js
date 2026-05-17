const timeouts = new Map();

// ========================================
// START SESSION TIMER
// ========================================
export function startSessionTimeout(
    sessionId,
    durationMs,
    onExpire
) {

    clearSessionTimeout(sessionId);

    const timeout = setTimeout(async () => {

        console.log(
            "⏰ SESSION EXPIRED:",
            sessionId
        );

        try {
            await onExpire();
        }
        catch (err) {

            console.log(
                "❌ EXPIRE ERROR:",
                err.message
            );
        }

    }, durationMs);

    timeouts.set(
        sessionId,
        timeout
    );
}

// ========================================
// CLEAR TIMER
// ========================================
export function clearSessionTimeout(
    sessionId
) {

    const timeout =
        timeouts.get(sessionId);

    if (!timeout) {
        return;
    }

    clearTimeout(timeout);

    timeouts.delete(sessionId);

    console.log(
        "🧹 TIMEOUT CLEARED:",
        sessionId
    );
}