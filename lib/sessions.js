const sessions = new Map();

export function createSession({
    sessionId,
    userId,
    dbSeconds,
    graceSeconds
}) {

    const fullDuration =
        dbSeconds + graceSeconds;

    sessions.set(sessionId, {

        sessionId,
        userId,

        dbSeconds,
        graceSeconds,

        fullDuration,

        startTime: Date.now(),
        lastHeartbeat: Date.now(),

        active: true
    });
}

export function getSession(sessionId) {
    return sessions.get(sessionId);
}

export function updateHeartbeat(sessionId) {

    const session =
        sessions.get(sessionId);

    if (!session) return;

    session.lastHeartbeat =
        Date.now();
}

export function removeSession(sessionId) {
    sessions.delete(sessionId);
}

export { sessions };