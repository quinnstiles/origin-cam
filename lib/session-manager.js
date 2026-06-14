import { getSession } from "./session-store.js";
import { finalizeSession } from "./finalizeSession.js";

// Concurrency tracking set to defend against duplicate execution cascades
const closingSessions = new Set();

// ========================================
// CORE LIFECYCLE CONTROLLER
// ========================================
export async function closeSession(sessionId, reason = "unknown") {
    const session = getSession(sessionId);

    if (!session) {
        console.log("⚠️ [MANAGER] Close sequence bypassed (Session does not exist):", sessionId);
        return { success: true, message: "No session found to close." };
    }

    if (closingSessions.has(sessionId) || session.isEnding) {
        console.log("⚠️ [MANAGER] Teardown already running, skipping overlapping call:", sessionId);
        return { success: false, message: "Teardown in progress." };
    }

    // Lock session state immediately
    closingSessions.add(sessionId);
    session.isEnding = true;

    try {
        console.log("🧠 [MANAGER] Commencing session breakdown pipeline:", { sessionId, reason });

        // Trigger database state balancing code path
        const result = await finalizeSession(sessionId, reason, false);

        console.log("🗑 [MANAGER] Structural session cleanup complete:", sessionId);
        return result;

    } catch (err) {
        console.log("❌ [MANAGER] Pipeline execution error encountered:", err.message);
        return { success: false, error: err.message };
    } finally {
        // Unlock session state window
        closingSessions.delete(sessionId);
    }
}