const sessionTimeouts = new Map();

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
        } catch (e) {
            console.log(
                "❌ SESSION EXPIRE ERROR:",
                e.message
            );
        }

    }, durationMs);

    sessionTimeouts.set(
        sessionId,
        timeout
    );
}

export function clearSessionTimeout(
    sessionId
) {
    const timeout =
        sessionTimeouts.get(sessionId);

    if (timeout) {
        clearTimeout(timeout);

        sessionTimeouts.delete(sessionId);
    }
}