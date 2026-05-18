import {
    getSession,
    deleteSession
} from "./session-store.js";

import { supabase } from "./supabase.js";

// ========================================
// FINALIZE SESSION (SINGLE SOURCE OF TRUTH)
// ========================================


export async function finalizeSession(sessionId, reason = "manual") {

    const session = getSession(sessionId);

    if (!session) {
        console.log("⚠️ finalizeSession: session already gone", sessionId);
        return;
    }

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - session.createdAt) / 1000);
    let billedSeconds = 0;

    // ====================================
    // UNIFIED TIME CONSUMPTION RULE
    // ====================================
    if (reason === "timeout") {
        billedSeconds = session.dbSeconds;
    } else {
        billedSeconds = Math.min(
            session.dbSeconds,
            Math.max(0, elapsedSeconds - session.graceSeconds)
        );
    }

    const remainingSeconds = Math.max(0, session.dbSeconds - billedSeconds);

    console.log("🧾 FINALIZE SESSION APPLICATION:", {
        sessionId,
        reason,
        elapsedSeconds,
        billedSeconds,
        remainingSeconds
    });

    // UPDATE DB
    const { error } = await supabase
        .from("users")
        .update({ remaining_seconds: remainingSeconds })
        .eq("id", session.userId);

    if (error) {
        console.log("❌ DB UPDATE FAILED:", error.message);
        return;
    }

    // CLEAN MEMORY
    deleteSession(sessionId);
    console.log("🧹 SESSION FINALIZED & REMOVED:", sessionId);
}