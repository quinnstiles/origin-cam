import {
    getSession,
    updateSession,
    deleteSession
} from "./session-store.js";

import { clearSessionTimeout } from "./session-monitor.js";

import { finalizeSession } from "./finalizeSession.js";

const closingSessions = new Set();

export async function closeSession(sessionId, reason = "unknown") {
    const session = getSession(sessionId);

    if (!session) {
        console.log("⚠️ CLOSE IGNORED (no session):", sessionId);
        return;
    }

    if (closingSessions.has(sessionId) || session.isEnding) {
        console.log("⚠️ ALREADY CLOSING:", sessionId);
        return;
    }

    closingSessions.add(sessionId);

    try {
        console.log("🧠 CLOSING SESSION:", { sessionId, reason });

        updateSession(sessionId, { isEnding: true });

        clearSessionTimeout(sessionId);

        await finalizeSession(sessionId, reason === "timeout");

        deleteSession(sessionId);

        console.log("🗑 SESSION CLOSED:", sessionId);

    } catch (err) {
        console.log("❌ CLOSE SESSION ERROR:", err.message);
    } finally {
        closingSessions.delete(sessionId);
    }
}