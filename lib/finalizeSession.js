import { getUserSession, deleteSession, getSession } from "./session-store.js";
import { supabase } from "./supabase.js";

// ========================================
// SECURE AUTHORITATIVE FINALIZATION AND DATABASE WRITE BACK
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
    const currentDecartToken = session.decartToken;

    // Clear any lingering startup timeout timers just in case it was terminated mid-launch
    if (global.startupTimers && global.startupTimers.has(currentSessionId)) {
        clearTimeout(global.startupTimers.get(currentSessionId));
        global.startupTimers.delete(currentSessionId);
    }

    // EVICT CACHE IMMEDIATELY TO PREVENT RACE CONDITION OVER-SUBTRACTIONS
    deleteSession(currentSessionId);

    try {
        let billedSeconds = 0;
        let elapsedSeconds = 0;

        // 1. AUTHORITATIVE BACKEND UPSTREAM KILL VIA UNIQUE TOKEN
        try {
            console.log(`⚡ [FINALIZE] Sending authoritative DELETE to Decart infrastructure for session: ${currentSessionId}`);
            const decartRes = await fetch(`https://api.decart.ai/v1/client/tokens/${currentDecartToken}`, {
                method: "DELETE",
                headers: { "x-api-key": process.env.DECART_API_KEY }
            });

            if (!decartRes.ok) {
                const errTxt = await decartRes.text();
                console.log(`⚠️ [FINALIZE] Decart upstream stream teardown returned warning: ${errTxt}`);
            } else {
                console.log(`✅ [FINALIZE] Upstream pipeline destroyed by Decart for session: ${currentSessionId}`);
            }
        } catch (decartKillErr) {
            console.log("❌ [FINALIZE] Network failure executing Decart upstream teardown:", decartKillErr.message);
        }

        // 2. ACCURATE CALCULATIONS
        if (!session.isLive || reason === "startup_timeout") {
            // Zero-Bill Guard trips if connection never established or timed out out in the first 15 seconds
            console.log(`🛡️ [FINALIZE] Zero-Bill Guard tripped for ${currentSessionId}. Charging 0 seconds.`);
            billedSeconds = 0;
            elapsedSeconds = 0;
        } else {
            // Compute time elapsed since the Node successfully sent the activate signal
            elapsedSeconds = Math.floor((Date.now() - session.createdAt) / 1000);
            billedSeconds = Math.min(session.dbSeconds, Math.max(0, elapsedSeconds));
        }

        // 3. FETCH AUTHORITATIVE DATABASE SNAPSHOT
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

        // Deduct usage without dropping balance below zero
        const remainingSeconds = Math.max(0, activeDbSeconds - billedSeconds);

        console.log(`📊 [FINALIZE] PROCESSING LIFECYCLE [Reason: ${reason}]:`, {
            sessionId: currentSessionId,
            userId: currentUserId,
            elapsedSeconds,
            billedSeconds,
            remainingSeconds
        });

        // 4. COMMIT FINALIZED CALCULATIONS SECURELY TO THE PRODUCTION DATABASE
        const { error } = await supabase
            .from("users")
            .update({ remaining_seconds: remainingSeconds })
            .eq("id", currentUserId);

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