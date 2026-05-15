const sessions = new Map();

// ========================================
// CREATE SESSION
// ========================================

export function createSession(sessionId, sessionData) {
    console.log("🧠 CREATE SESSION:", sessionId, sessionData);

    sessions.set(sessionId, sessionData);
}

// ========================================
// GET SESSION
// ========================================

export function getSession(
    sessionId
) {
    if (!sessionId) {
        throw new Error(
            "Missing sessionId"
        );
    }

    return sessions.get(sessionId);
}

// ========================================
// UPDATE SESSION
// ========================================

export function updateSession(
    sessionId,
    updates
) {
    const session =
        sessions.get(sessionId);

    if (!session) {
        throw new Error(
            "Session not found"
        );
    }

    sessions.set(
        sessionId,
        {
            ...session,
            ...updates
        }
    );
}

// ========================================
// DELETE SESSION
// ========================================

export function deleteSession(
    sessionId
) {
    if (!sessions.has(sessionId)) {
        throw new Error(
            "Session not found"
        );
    }

    sessions.delete(sessionId);
}

// ========================================
// GET ALL SESSIONS
// ========================================

export function getAllSessions() {
    return sessions;
}