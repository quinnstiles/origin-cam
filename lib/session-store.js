const sessions = new Map();

// sessionId -> session object
export function createSession(session) {
    sessions.set(session.sessionId, session);
}

export function getSession(sessionId) {
    return sessions.get(sessionId);
}

// check if user already has active session
export function getUserSession(userId) {
    for (const session of sessions.values()) {
        if (session.userId === userId && !session.closed) {
            return session;
        }
    }
    return null;
}

export function closeSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
        session.closed = true;
        sessions.delete(sessionId);
    }
}

export function getAllSessions() {
    return sessions;
}