// ========================================
// IN-MEMORY SESSION STORE
// ========================================

const sessions = new Map();

// ========================================
// CREATE SESSION
// ========================================

export function createSession(sessionId, sessionData) {
    console.log("🧠 CREATE SESSION:", sessionId, sessionData);

    sessions.set(sessionId, {
        ...sessionData,
        createdAt: sessionData.createdAt || Date.now(),
        isActive: true,
        isEnding: false
    });
}

// ========================================
// GET SESSION
// ========================================

export function getSession(sessionId) {
    if (!sessionId) {
        throw new Error("Missing sessionId");
    }

    return sessions.get(sessionId) || null;
}

// ========================================
// UPDATE SESSION
// ========================================

export function updateSession(sessionId, updates) {
    const session = sessions.get(sessionId);

    if (!session) {
        throw new Error("Session not found");
    }

    const updated = {
        ...session,
        ...updates
    };

    sessions.set(sessionId, updated);
    return updated;
}

// ========================================
// DELETE SESSION
// ========================================

export function deleteSession(sessionId) {
    if (!sessions.has(sessionId)) {
        return false;
    }

    sessions.delete(sessionId);
    return true;
}

// ========================================
// GET ALL SESSIONS (SAFE)
// ========================================

export function getAllSessions() {
    return Array.from(sessions.values());
}

// ========================================
// GET ACTIVE SESSION BY USER
// ========================================

export function getSessionByUser(userId) {
    for (const session of sessions.values()) {
        if (session.userId === userId && session.isActive) {
            return session;
        }
    }
    return null;
}

// ========================================
// CHECK IF USER HAS ACTIVE SESSION
// ========================================

export function hasActiveSession(userId) {
    return getSessionByUser(userId) !== null;
}

// ========================================
// FORCE CLEAN STALE SESSIONS
// (prevents "Session already running" bug)
// ========================================

export function cleanupStaleSessions(maxAgeMs = 60 * 60 * 1000) {
    const now = Date.now();

    for (const [sessionId, session] of sessions.entries()) {
        const age = now - (session.createdAt || now);

        if (!session.isActive || age > maxAgeMs) {
            sessions.delete(sessionId);
        }
    }
}

// ========================================
// FORCE CLEAR ALL (DEBUG ONLY)
// ========================================

export function clearAllSessions() {
    sessions.clear();
}