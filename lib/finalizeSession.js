import { getUserSession, deleteSession, getSession } from "./session-store.js";
import { supabase } from "./supabase.js";

// ========================================================================
// SECURE LOCAL FINALIZATION AND DATABASE WRITE BACK ONLY
// ========================================================================
export async function finalizeSession(identifier, reason = "manual", isUserId = false) {

    // 1. RESOLVE ACTIVE SESSION OBJECT FROM MEMORY
    const session = isUserId ? getUserSession(identifier) : getSession(identifier);

    if (!session) {
        console.log(`⚠️ [FINALIZE] Target session already handled or dead. [Identifier: ${identifier}]`);
        return { success: true, message: "Already finalized" };
    }

    const currentSessionId = session.sessionId;
    const currentUserId = session.userId;
    const sessionCreatedAt = session.createdAt;
    const sessionWasLive = session.isLive;

    // 2. EVICT CACHE IMMEDIATELY TO PREVENT RACE CONDITION OVER-SUBTRACTIONS
    deleteSession(currentSessionId);

    try {
        // 3. AUTHORITATIVE LOCAL TIME CALCULATION
        const now = Date.now();
        const localElapsedMs = now - sessionCreatedAt;

        // Convert milliseconds to seconds and round up cleanly
        let elapsedSeconds = Math.ceil(localElapsedMs / 1000);

        // SAFETY RATCHET: If the stream went live but closed instantly, charge a 1-second minimum
        if (sessionWasLive && elapsedSeconds <= 0) {
            elapsedSeconds = 1;
        }

        // If the stream never even went live, charge 0 here 
        if (!sessionWasLive) {
            elapsedSeconds = 0;
        }

        // Safety cap: Clamp billing so they are never charged more than they had in their wallet
        const billedSeconds = Math.min(session.dbSeconds, elapsedSeconds);

        console.log(`🛡️ [LOCAL BILLING ENGINE] Calculated via server timestamps: ${billedSeconds}s`);

        // 4. FETCH CURRENT PROFILE BALANCE & STATE METADATA FROM SUPABASE
        const { data: userProfile, error: fetchError } = await supabase
            .from("users")
            .select("remaining_seconds, active_session_id")
            .eq("id", currentUserId)
            .single();

        if (fetchError || !userProfile) {
            console.log("❌ [FINALIZE] User profile balance resolution failed:", fetchError?.message);
            return { success: false, remainingSeconds: 0 };
        }

        const activeDbSeconds = userProfile.remaining_seconds;

        // Subtract what they used and ensure balance never drops below zero
        const theoreticalRemaining = activeDbSeconds - billedSeconds;
        const remainingSeconds = Math.max(0, theoreticalRemaining);

        console.log(`📊 [FINALIZE] PROCESSING LIFECYCLE [Reason: ${reason}]:`, {
            sessionId: currentSessionId,
            userId: currentUserId,
            elapsedSeconds,
            billedSeconds,
            remainingSeconds
        });

        // 5. CONSTRUCT TRANSACTION PAYLOAD
        const updatePayload = { remaining_seconds: remainingSeconds };

        // Concurrency Guard: Only wipe out the tracking states if this specific session owns them.
        // If a subsequent session has already spun up on another machine, do not overwrite its flags.
        if (userProfile.active_session_id === currentSessionId) {
            updatePayload.active_session_id = null;
            updatePayload.session_is_live = false;
        }

        // 6. COMMIT SECURELY TO THE PRODUCTION DATABASE
        const { error } = await supabase
            .from("users")
            .update(updatePayload)
            .eq("id", currentUserId);

        if (error) {
            console.log("❌ [FINALIZE] Supabase Database transaction execution error:", error.message);
            return { success: false, remainingSeconds: activeDbSeconds };
        }

        console.log(`🧹 [STORE] Session memory cache evicted: ${currentSessionId}`);
        console.log(`✅ [FINALIZE] Database updated successfully for user ${currentUserId}. Bal: ${remainingSeconds}s.`);
        return { success: true, remainingSeconds };

    } catch (globalErr) {
        console.log("❌ [FINALIZE] Critical unhandled internal exception:", globalErr.message);
        return { success: false, error: globalErr.message };
    }
}