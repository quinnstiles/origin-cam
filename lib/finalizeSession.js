import { getUserSession, deleteSession, getSession } from "./session-store.js";
import { supabase } from "./supabase.js";

export async function finalizeSession(identifier, reason = "manual", isUserId = false) {
    const session = isUserId ? getUserSession(identifier) : getSession(identifier);

    if (!session) {
        console.log(`⚠️ [FINALIZE] Target session already handled or dead. [Identifier: ${identifier}]`);
        return { success: true, message: "Already finalized" };
    }

    const currentSessionId = session.sessionId;
    const currentUserId = session.userId;
    const currentRemainingSeconds = session.dbSeconds;

    deleteSession(currentSessionId);

    try {
        // 🔍 FETCH CURRENT PROFILE STATE METADATA FROM SUPABASE
        const { data: userProfile, error: fetchError } = await supabase
            .from("users")
            .select("remaining_seconds, active_session_id")
            .eq("id", currentUserId)
            .single();

        if (fetchError || !userProfile) {
            console.log("❌ [FINALIZE] User profile balance resolution failed:", fetchError?.message);
            return { success: false, remainingSeconds: 0 };
        }

        // If this specific session is the current registered active session, clean the tracker variables
        const updatePayload = { remaining_seconds: currentRemainingSeconds };
        if (userProfile.active_session_id === currentSessionId) {
            updatePayload.active_session_id = null;
        }

        // COMMIT SECURELY TO THE PRODUCTION DATABASE
        const { error } = await supabase
            .from("users")
            .update(updatePayload)
            .eq("id", currentUserId);

        if (error) {
            console.log("❌ [FINALIZE] Supabase Database transaction execution error:", error.message);
            return { success: false, remainingSeconds: userProfile.remaining_seconds };
        }

        console.log(`✅ [FINALIZE] Complete. Reason: ${reason}. Saved Balance: ${currentRemainingSeconds}s.`);
        return { success: true, remainingSeconds: currentRemainingSeconds };

    } catch (globalErr) {
        console.log("❌ [FINALIZE] Critical unhandled internal exception:", globalErr.message);
        return { success: false, error: globalErr.message };
    }
}