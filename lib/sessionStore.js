const sessions = new Map();

// ========================================
// CREATE SESSION
// ========================================

export function createSession(data) {

    sessions.set(data.sessionId, {

        sessionId:
            data.sessionId,

        userId:
            data.userId,

        dbSeconds:
            data.dbSeconds,

        graceSeconds:
            data.graceSeconds,

        sessionDuration:
            data.sessionDuration,

        startedAt:
            Date.now(),

        lastHeartbeat:
            Date.now()
    });
}

// ========================================
// GET SESSION
// ========================================

export function getSession(sessionId) {

    return sessions.get(sessionId);
}

// ========================================
// UPDATE HEARTBEAT
// ========================================

export function updateHeartbeat(sessionId) {

    const session =
        sessions.get(sessionId);

    if (!session)
        return false;

    session.lastHeartbeat =
        Date.now();

    return true;
}

// ========================================
// REMOVE SESSION
// ========================================

export function removeSession(sessionId) {

    sessions.delete(sessionId);
}