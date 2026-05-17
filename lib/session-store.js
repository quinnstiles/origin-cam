const sessions = new Map();

// ========================================
// CREATE SESSION
// ========================================
export function createSession(session) {

    sessions.set(
        session.sessionId,
        session
    );

    console.log(
        "💾 SESSION STORED:",
        session.sessionId
    );
}

// ========================================
// GET SESSION
// ========================================
export function getSession(sessionId) {

    return sessions.get(sessionId);
}

// ========================================
// GET USER ACTIVE SESSION
// ========================================
export function getUserSession(userId) {

    for (const session of sessions.values()) {

        if (
            session.userId === userId &&
            !session.closed
        ) {
            return session;
        }
    }

    return null;
}

// ========================================
// REMOVE SESSION
// ========================================
export function removeSession(sessionId) {

    const exists =
        sessions.has(sessionId);

    if (!exists) {
        return;
    }

    sessions.delete(sessionId);

    console.log(
        "🗑 SESSION REMOVED:",
        sessionId
    );
}

// ========================================
// GET ALL
// ========================================
export function getAllSessions() {
    return sessions;
}