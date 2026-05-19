import { getUserSession, deleteSession, getSession } from "./session-store.js";
import { supabase } from "./supabase.js";

// ========================================
// FINALIZE SESSION (SECURED BY USER OR EXPLICIT ID)
// ========================================

export async function finalizeSession(identifier, reason = "manual", isUserId = false) {

    const session = isUserId ? getUserSession(identifier) : getSession(identifier);

    if (!session) {
        console.log(`⚠️ finalizeSession: Target session already handled or dead. [ID: ${identifier}]`);
        return null; // Return null if it's already gone
    }

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - session.createdAt) / 1000);
    let billedSeconds = 0;

    if (reason === "timeout") {
        billedSeconds = session.dbSeconds;
    } else {
        billedSeconds = Math.min(
            session.dbSeconds,
            Math.max(0, elapsedSeconds - session.graceSeconds)
        );
    }

    const remainingSeconds = Math.max(0, session.dbSeconds - billedSeconds);

    // ... [Your Supabase Update Logic stays exactly the same here] ...

    // CLEAN AUTHORITATIVE MEMORY
    deleteSession(session.sessionId);
    console.log(`🧹 MEMORY PURGED: ${session.sessionId}`);

    // 🔥 RETURN THE VALUE SO THE END-ROUTE CAN SEND IT TO THE CLIENT
    return remainingSeconds;
}