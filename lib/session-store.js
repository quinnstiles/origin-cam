const sessions = new Map();

/**
 * CREATE / REPLACE session
 */
export function createSession(session) {
    sessions.set(session.sessionId, session);
}

/**
 * GET session by ID
 */
export function getSession(sessionId) {
    return sessions.get(sessionId) || null;
}

/**
 * FIND session by userId
 */
export function getUserSession(userId) {
    for (const session of sessions.values()) {
        if (session.userId === userId) {
            return session;
        }
    }
    return null;
}

/**
 * DELETE session
 */
export function deleteSession(sessionId) {
    sessions.delete(sessionId);
}

/**
 * FORCE CLEAR USER SESSION (IMPORTANT FIX)
 */
export function clearUserSession(userId) {
    for (const [id, session] of sessions.entries()) {
        if (session.userId === userId) {
            sessions.delete(id);
        }
    }
}

export function isSessionExpired(session) {
    const elapsed = Math.floor(
        (Date.now() - session.createdAt) / 1000
    );

    return elapsed >= session.sessionDuration;
}

/**
 * DEBUG
 */
export function getAllSessions() {
    return sessions;
}