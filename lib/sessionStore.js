const sessions = new Map();

// ========================================
// CREATE SESSION (ALL IN MS)
// ========================================
export function createSession(data) {

    const now = Date.now();

    sessions.set(data.sessionId, {

        sessionId: data.sessionId,
        userId: data.userId,

        // DB seconds converted → ms
        dbMs: data.dbSeconds * 1000,

        // grace already converted → ms
        graceMs: data.graceSeconds * 1000,

        sessionDurationMs: data.sessionDuration * 1000,

        startedAt: now,
        lastHeartbeat: now,

        active: true
    });
}

// ========================================
// GET SESSION
// ========================================
export function getSession(sessionId) {
    return sessions.get(sessionId);
}

// ========================================
// HEARTBEAT UPDATE
// ========================================
export function updateHeartbeat(sessionId) {

    const session = sessions.get(sessionId);
    if (!session) return false;

    session.lastHeartbeat = Date.now();
    return true;
}

// ========================================
// REMOVE SESSION
// ========================================
export function removeSession(sessionId) {
    sessions.delete(sessionId);
}

export { sessions };