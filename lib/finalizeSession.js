import { getUserSession, deleteSession, getSession } from "./session-store.js";
import { supabase } from "./supabase.js";

// ========================================
// FINALIZE SESSION (SECURED BY USER OR EXPLICIT ID)
// ========================================
export async function finalizeSession(identifier, reason = "manual", isUserId = false) {

    // Dynamically fetch by userId or fallback to direct sessionId (for timeouts)
    const session = isUserId ? getUserSession(identifier) : getSession(identifier);

    if (!session) {
        console.log(`⚠️ finalizeSession: Target session already handled or dead. [ID: ${identifier}]`);
        return;
    }

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - session.createdAt) / 1000);
    let billedSeconds = 0;

    // ====================================
    // TIME CONSUMPTION RULE
    // ====================================
    if (reason === "timeout") {
        billedSeconds = session.dbSeconds; // Full consumption penalty
    } else {
        // Manual stop or Heartbeat loss uses elapsed time minus grace allowance
        billedSeconds = Math.min(
            session.dbSeconds,
            Math.max(0, elapsedSeconds - session.graceSeconds)
        );
    }

    const remainingSeconds = Math.max(0, session.dbSeconds - billedSeconds);

    console.log(`🧾 FINALIZING SYSTEM [Reason: ${reason}]:`, {
        sessionId: session.sessionId,
        userId: session.userId,
        elapsedSeconds,
        billedSeconds,
        remainingSeconds
    });

    // ====================================
    // UPDATE DB WITH CONFIRMATION
    // ====================================
    const { data, error } = await supabase
        .from("users")
        .update({ remaining_seconds: remainingSeconds })
        .eq("id", session.userId)
        .select(); // Returns modified rows to prevent silent failures

    if (error) {
        console.log("❌ DB UPDATE HARD ERROR:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log(`⚠️ DB ROW MISMATCH: No modifications made. Balance was likely already 0 or ID is invalid.`);
    } else {
        console.log(`✅ DB SUCCESS: User ${session.userId} record saved with ${remainingSeconds}s left.`);
    }

    // ====================================
    // CLEAN AUTHORITATIVE MEMORY
    // ====================================
    deleteSession(session.sessionId);
    console.log(`🧹 MEMORY PURGED: ${session.sessionId}`);
}