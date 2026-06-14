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

    // EVICT CACHE IMMEDIATELY TO PREVENT RACE CONDITION OVER-SUBTRACTIONS
    deleteSession(currentSessionId);

    try {
        let billedSeconds = 0;
        let elapsedSeconds = 0;

        // 1. QUERY DECART AUTHORITATIVELY FOR REAL MEDIA STREAM METRICS
        try {
            const decartRes = await fetch(`https://api.decart.ai/v1/client/tokens/${currentDecartToken}`, {
                method: "GET",
                headers: { "x-api-key": process.env.DECART_API_KEY }
            });

            if (decartRes.ok) {
                const decartData = await decartRes.json();

                // Extract real processed duration from Decart's internal state
                // If the app crashed early, or connection failed entirely, this will safely be 0 or small.
                elapsedSeconds = decartData.duration_seconds || 0;
                billedSeconds = elapsedSeconds;
            } else {
                const errTxt = await decartRes.text();
                console.log(`⚠️ [FINALIZE] Decart status check failed: ${errTxt}. Falling back to timestamp delta.`);
                elapsedSeconds = Math.floor((Date.now() - session.createdAt) / 1000);
                billedSeconds = Math.max(0, elapsedSeconds);
            }
        } catch (decartErr) {
            console.log("⚠️ [FINALIZE] Network error contacting Decart API:", decartErr.message);
            elapsedSeconds = Math.floor((Date.now() - session.createdAt) / 1000);
            billedSeconds = Math.max(0, elapsedSeconds);
        }

        // 2. FETCH AUTHORITATIVE DATABASE SNAPSHOT
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

        // Clamp billing parameters to remain above zero and below the user's available balance
        const theoreticalRemaining = activeDbSeconds - billedSeconds;
        const remainingSeconds = Math.max(0, theoreticalRemaining);

        console.log(`📊 [FINALIZE] PROCESSING LIFECYCLE [Reason: ${reason}]:`, {
            sessionId: currentSessionId,
            userId: currentUserId,
            elapsedSeconds,
            billedSeconds,
            remainingSeconds
        });

        // 3. COMMIT FINALIZED CALCULATIONS SECURELY TO THE PRODUCTION DATABASE
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