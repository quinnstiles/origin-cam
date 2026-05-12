// ========================================
// ACTIVE SESSIONS
// ========================================

const activeSessions =
    new Map();

// ========================================
// CREATE SESSION
// ========================================

export function createSession(
    sessionId,
    data
) {
    activeSessions.set(
        sessionId,
        data
    );
}

// ========================================
// GET SESSION
// ========================================

export function getSession(
    sessionId
) {
    return activeSessions.get(
        sessionId
    );
}

// ========================================
// REMOVE SESSION
// ========================================

export function removeSession(
    sessionId
) {
    activeSessions.delete(
        sessionId
    );
}

// ========================================
// GET ALL SESSIONS
// ========================================

export function getAllSessions() {
    return activeSessions;
}