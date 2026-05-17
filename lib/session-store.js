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
// REMOVE SESSION
// ========================================

export function removeSession(sessionId) {

    sessions.delete(sessionId);

    console.log(
        "🗑 SESSION REMOVED:",
        sessionId
    );
}

// ========================================
// GET USER SESSION
// ========================================

export function getUserSession(userId) {

    for (const session of sessions.values()) {

        if (session.userId !== userId) {
            continue;
        }

        // ====================================
        // STALE SESSION CHECK
        // ====================================

        const elapsedSeconds =
            Math.floor(
                (Date.now() - session.createdAt)
                / 1000
            );

        console.log({
            createdAt: session.createdAt,
            sessionDuration: session.sessionDuration,
            elapsedSeconds
        });

        if (
            elapsedSeconds >=
            session.sessionDuration
        ) {

            console.log(
                "⚠️ STALE SESSION AUTO REMOVED:",
                session.sessionId
            );

            sessions.delete(
                session.sessionId
            );

            continue;
        }

        return session;
    }

    return null;
}

// ========================================
// GET ALL SESSIONS
// ========================================


export function getAllSessions() {

    return sessions;
}