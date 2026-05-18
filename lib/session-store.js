const sessions = new Map();

/**
 * session shape:
 * {
 *   sessionId,
 *   userId,
 *   createdAt,
 *   dbSeconds,
 *   graceSeconds,
 *   expiresAt,
 *   status: "active" | "ending" | "expired"
 * }
 */

// =========================
// CREATE
// =========================
export function createSession(session) {
    sessions.set(session.sessionId, {
        ...session,
        status: "active"
    });
}

// =========================
// GET
// =========================
export function getSession(sessionId) {
    return sessions.get(sessionId) || null;
}

// =========================
// GET BY USER
// =========================
export function getUserSession(userId) {
    const now = Date.now();

    for (const session of sessions.values()) {

        if (session.userId !== userId) continue;

        // stale check (auto cleanup)
        if (now >= session.expiresAt) {
            sessions.delete(session.sessionId);
            continue;
        }

        if (session.status === "ending") continue;

        return session;
    }

    return null;
}

// =========================
// UPDATE
// =========================
export function updateSession(sessionId, updates) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    const updated = {
        ...session,
        ...updates
    };

    sessions.set(sessionId, updated);
    return updated;
}

// =========================
// DELETE
// =========================
export function deleteSession(sessionId) {
    sessions.delete(sessionId);
}

// =========================
// CHECK VALIDITY
// =========================
export function isSessionValid(session) {
    if (!session) return false;

    return (
        session.status === "active" &&
        Date.now() < session.expiresAt
    );
}