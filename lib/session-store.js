const sessions = new Map();

// CREATE
export function createSession(session) {
    sessions.set(session.sessionId, session);
}

// GET BY SESSION ID
export function getSession(sessionId) {
    return sessions.get(sessionId);
}

// GET BY USER ID
export function getUserSession(userId) {
    for (const session of sessions.values()) {
        if (session.userId === userId && !session.closed) {
            return session;
        }
    }
    return null;
}

// DELETE (THIS IS THE ONLY VALID NAME)
export function removeSession(sessionId) {
    sessions.delete(sessionId);
}

// GET ALL
export function getAllSessions() {
    return sessions;
}