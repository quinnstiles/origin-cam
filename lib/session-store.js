// ========================================
// SESSION STORE (TIME-AUTHORITY VERSION)
// ========================================

const sessions = new Map();

// ========================================
// HELPERS
// ========================================

function isExpired(session) {
    const now = Date.now();

    const totalSeconds =
        session.dbSeconds + session.graceSeconds;

    const expiresAt =
        session.createdAt + totalSeconds * 1000;

    return now >= expiresAt;
}

// ========================================
// CREATE SESSION
// ========================================

export function createSession(session) {
    console.log("💾 SESSION CREATED:", session.sessionId);
    sessions.set(session.sessionId, session);
}

// ========================================
// GET SESSION BY ID (AUTO CLEAN)
// ========================================

export function getSession(sessionId) {
    return sessions.get(sessionId) || null;
}

// ========================================
// GET USER SESSION (AUTO CLEAN + SAFE)
// ========================================

export function getUserSession(userId) {
    for (const session of sessions.values()) {
        if (session.userId !== userId) continue;

        // stale check
        if (isExpired(session)) {
            console.log("🧹 AUTO REMOVE STALE USER SESSION:", session.sessionId);
            sessions.delete(session.sessionId);
            continue;
        }

        return session;
    }

    return null;
}

// ========================================
// CLEAR USER SESSION (FOR RESTART)
// ========================================

export function clearUserSession(userId) {
    for (const [id, session] of sessions.entries()) {
        if (session.userId === userId) {
            sessions.delete(id);
            console.log("🧹 USER SESSION CLEARED:", id);
        }
    }
}

// ========================================
// DELETE SESSION BY ID
// ========================================

export function deleteSession(sessionId) {
    if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        console.log("🗑 SESSION DELETED:", sessionId);
    }
}

// ========================================
// GET ALL (DEBUG ONLY)
// ========================================

export function getAllSessions() {
    return sessions;
}