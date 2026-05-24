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
        return { success: true, message: "Already finalized" };
    }

    const currentSessionId = session.sessionId;
    const currentUserId = session.userId;

    // 🌟 CRITICAL FIX: Evict from memory immediately so subsequent requests are never blocked by DB latency
    deleteSession(currentSessionId);
    console.log(`🧹 MEMORY PURGED IMMEDIATELY: ${currentSessionId}`);

    try {
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
        // 🌟 UPDATED: Also selecting 'signature' here to pass down to our history table
        const { data: currentDbUser } = await supabase
            .from("users")
            .select("remaining_seconds, signature")
            .eq("id", currentUserId)
            .single();

        // Use live balance floor if database changed during live execution loop
        const activeDbSeconds = currentDbUser ? currentDbUser.remaining_seconds : session.dbSeconds;
        const userSignature = currentDbUser ? currentDbUser.signature : "origin";
        const remainingSeconds = Math.max(0, activeDbSeconds - billedSeconds);

        console.log(`🧾 FINALIZING SYSTEM [Reason: ${reason}]:`, {
            sessionId: currentSessionId,
            userId: currentUserId,
            elapsedSeconds,
            billedSeconds,
            remainingSeconds
        });

        // ====================================
        // UPDATE ACTIVE DB VALUES WITH CONFIRMATION
        // ====================================
        const { data, error } = await supabase
            .from("users")
            .update({ remaining_seconds: remainingSeconds })
            .eq("id", currentUserId)
            .select();

        if (error) {
            console.log("❌ DB UPDATE HARD ERROR:", error.message);
            return { success: false, remainingSeconds: activeDbSeconds };
        }

        if (!data || data.length === 0) {
            console.log(`⚠️ DB ROW MISMATCH: No modifications made for user profile ${currentUserId}.`);
        } else {
            console.log(`✅ DB SUCCESS: User ${currentUserId} record saved with ${remainingSeconds}s left.`);

            // ====================================
            // 🌟 NEW: ARCHIVE ENTRY INTO HISTORY LEDGER
            // ====================================
            const { error: historyError } = await supabase
                .from("history")
                .insert([
                    {
                        user_id: currentUserId,
                        session_duration_seconds: billedSeconds,
                        remaining_seconds: remainingSeconds,
                        signature: userSignature,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (historyError) {
                console.log("⚠️ HISTORY LEDGER WRITE BYPASSED:", historyError.message);
            } else {
                console.log(`📊 ARCHIVED: Session history saved for UID: ${currentUserId}`);
            }
        }

        return {
            success: true,
            remainingSeconds
        };

    } catch (globalErr) {
        console.log("❌ CRITICAL UNCAUGHT ERROR IN FINALIZE:", globalErr.message);
        return { success: false, error: globalErr.message };
    }
}