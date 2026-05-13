const sessions = new Map();

export function createSession(id, data) {
    sessions.set(id, {
        ...data,
        wsActive: false,
        decartActive: false
    });
}

export function getSession(id) {
    return sessions.get(id);
}

export function updateSession(id, data) {
    const existing = sessions.get(id);
    if (!existing) return;
    sessions.set(id, { ...existing, ...data });
}

export function deleteSession(id) {
    sessions.delete(id);
}

export function getAllSessions() {
    return sessions;
}