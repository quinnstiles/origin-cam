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

    // ====================================
    // FETCH LIVE CURRENT PROFILE BALANCES
    // ====================================
    // 🌟 FIXED: Targeted 'users' table and 'remaining_seconds' column
    const { data: currentDbUser } = await supabase
        .from("users")
        .select("remaining_seconds")
        .eq("id", session.userId)
        .single();

    // Use live balance floor if database changed during live execution loop
    const activeDbSeconds = currentDbUser ? currentDbUser.remaining_seconds : session.dbSeconds;
    const remainingSeconds = Math.max(0, activeDbSeconds - billedSeconds);

    console.log(`🧾 FINALIZING SYSTEM [Reason: ${reason}]:`, {
        sessionId: session.sessionId,
        userId: session.userId,
        elapsedSeconds,
        billedSeconds,
        remainingSeconds
    });

    // ====================================
    // UPDATE ACTIVE DB VALUES WITH CONFIRMATION
    // ====================================
    // 🌟 FIXED: Update targeted directly to the 'users' table
    const { data, error } = await supabase
        .from("users")
        .update({ remaining_seconds: remainingSeconds })
        .eq("id", session.userId)
        .select();

    if (error) {
        console.log("❌ DB UPDATE HARD ERROR:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log(`⚠️ DB ROW MISMATCH: No modifications made for user profile ${session.userId}.`);
    } else {
        console.log(`✅ DB SUCCESS: User ${session.userId} record saved with ${remainingSeconds}s left.`);
    }

    // ====================================
    // CLEAN AUTHORITATIVE MEMORY
    // ====================================
    deleteSession(session.sessionId);
    console.log(`🧹 MEMORY PURGED: ${session.sessionId}`);

    // Return current stats block to calling handlers (useful if bridge.js needs to pipe remaining time back to C++)
    return {
        success: true,
        remainingSeconds
    };
}