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

// ========================================
// GET USER SESSION (PURE LOOKUP - NO STEALTH CLEANUP)
// ========================================
export function getUserSession(userId) {
    for (const session of sessions.values()) {
        if (session.userId === userId) {
            return session; // Just return it! Let the route handle the math safely.
        }
    }
    return null;
}


// ========================================
// CLEAR USER SESSION (FOR RESTART)
// ========================================
export function clearUserSession(userId) {
    for (const [id, session] of sessions.entries()) {
        if (session.userId === userId) {
            // 🌟 CRITICAL FIX: Kill active background safety timers before eviction
            if (session.timeoutHandle) {
                console.log(`🧹 Cancelling lingering timeout timer for session: ${id}`);
                clearTimeout(session.timeoutHandle);
            }
            sessions.delete(id);
            console.log("🧹 USER SESSION CLEARED:", id);
        }
    }
}

// ========================================
// DELETE SESSION BY ID
// ========================================
export function deleteSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
        // 🌟 CRITICAL FIX: Ensure the timer is completely defused when manually stopped
        if (session.timeoutHandle) {
            console.log(`🧹 Cancelling dynamic safety timeout timer for session: ${sessionId}`);
            clearTimeout(session.timeoutHandle);
        }
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