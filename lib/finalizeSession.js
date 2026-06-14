import { getUserSession, deleteSession, getSession } from "./session-store.js";
import { supabase } from "./supabase.js";

// ========================================
// SECURE FINALIZATION AND DATABASE WRITE BACK
// ========================================
export async function finalizeSession(identifier, reason = "manual", isUserId = false) {

    // Fetch state object using either criteria safely
    const session = isUserId ? getUserSession(identifier) : getSession(identifier);

    if (!session) {
        console.log(`⚠️ [FINALIZE] Target session already handled or dead. [Identifier: ${identifier}]`);
        return { success: true, message: "Already finalized" };
    }

    const currentSessionId = session.sessionId;
    const currentUserId = session.userId;

    try {
        const now = Date.now();
        let billedSeconds = 0;
        let elapsedSeconds = 0;

        // Zero-Bill Guard if the setup never fully launched
        if (!session.isLive) {
            console.log(`🛡️ [FINALIZE] Zero-Bill Guard tripped for ${currentSessionId}. Charging 0 seconds.`);
            billedSeconds = 0;
        } else {
            // Calculate real run-time up to this moment
            elapsedSeconds = Math.floor((now - session.createdAt) / 1000);

            // Subtract any established startup grace thresholds
            const grace = Number(session.graceSeconds || 0);
            billedSeconds = Math.max(0, elapsedSeconds - grace);
        }

        // Fetch authoritative database snapshot to avoid client-side spoofing desyncs
        const { data: userProfile, error: fetchError } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", currentUserId)
            .single();

        if (fetchError || !userProfile) {
            console.log("❌ [FINALIZE] Target user profile balance resolution failed:", fetchError?.message);
            return { success: false, remainingSeconds: 0 };
        }

        const activeDbSeconds = userProfile.remaining_seconds;

        // Deduct runtime without dropping below zero
        const remainingSeconds = Math.max(0, activeDbSeconds - billedSeconds);

        console.log(`📊 [FINALIZE] PROCESSING LIFECYCLE [Reason: ${reason}]:`, {
            sessionId: currentSessionId,
            userId: currentUserId,
            elapsedSeconds,
            billedSeconds,
            remainingSeconds
        });

        // EVICT CACHE IMMEDIATELY TO PREVENT RACE CONDITION SUBTRACTIONS
        deleteSession(currentSessionId);

        // Commit finalized calculations securely to the production Database
        const { data, error } = await supabase
            .from("users")
            .update({ remaining_seconds: remainingSeconds })
            .eq("id", currentUserId)
            .select();

        if (error) {
            console.log("❌ [FINALIZE] Supabase Database transaction execution error:", error.message);
            return { success: false, remainingSeconds: activeDbSeconds };
        }

        console.log(`✅ [FINALIZE] Database updated successfully for user ${currentUserId}. Bal: ${remainingSeconds}s.`);
        return { success: true, remainingSeconds };

    } catch (globalErr) {
        console.log("❌ [FINALIZE] Critical unhandled internal exception:", globalErr.message);
        return { success: false, error: globalErr.message };
    }
}