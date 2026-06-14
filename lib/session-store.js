// ========================================
// CLEANED ACTIVE SESSION STORAGE MAP
// ========================================
const sessions = new Map();

// ========================================
// CREATE SESSION
// ========================================
export function createSession(session) {
    console.log("🔹 [STORE] Session Created:", session.sessionId);
    // Explicitly enforce tracking a stream pulse timestamp from the absolute start
    sessions.set(session.sessionId, {
        ...session,
        lastStreamPulse: Date.now()
    });
}

// ========================================
// PURE LOOKUP BY ID
// ========================================
export function getSession(sessionId) {
    return sessions.get(sessionId) || null;
}

// ========================================
// PURE LOOKUP BY USER ID
// ========================================
export function getUserSession(userId) {
    for (const session of sessions.values()) {
        if (session.userId === userId) {
            return session;
        }
    }
    return null;
}

// ========================================
// DELETE SESSION FROM CACHE
// ========================================
export function deleteSession(sessionId) {
    if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        console.log("🧹 [STORE] Session memory cache evicted:", sessionId);
        return true;
    }
    return false;
}

// ========================================
// FETCH ALL FOR THE MONITOR TIMEOUT LOOP
// ========================================
export function getAllSessions() {
    return sessions;
}