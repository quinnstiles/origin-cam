const sessions = new Map();

// ========================================
// CREATE SESSION
// ========================================

export function createSession(session) {

    sessions.set(
        session.sessionId,
        session
    );
}

// ========================================
// GET SESSION
// ========================================

export function getSession(sessionId) {

    return sessions.get(sessionId);
}

// ========================================
// GET USER SESSION
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

    sessions.delete(sessionId);
}

// ========================================
// GET ALL
// ========================================

export function getAllSessions() {

    return sessions;
}