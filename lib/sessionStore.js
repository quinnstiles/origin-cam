const sessions = new Map();

/**
 * session structure:
 * {
 *   userId,
 *   startTime,
 *   lastHeartbeat,
 *   active,
 *   billedSeconds
 * }
 */

export function createSession(sessionId, userId) {
    sessions.set(sessionId, {
        userId,
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        active: true,
        billedSeconds: 0
    });
}

export function updateHeartbeat(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;

    session.lastHeartbeat = Date.now();
}

export function endSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    session.active = false;

    session.billedSeconds = Math.floor(
        (Date.now() - session.startTime) / 1000
    );

    return session;
}

export function getSession(sessionId) {
    return sessions.get(sessionId);
}