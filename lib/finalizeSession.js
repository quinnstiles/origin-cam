import { supabase } from "./supabase.js";
import {
    getSession,
    deleteSession
} from "./session-store.js";

/**
 * ONE FUNCTION FOR EVERYTHING:
 * - manual stop
 * - heartbeat timeout
 * - forced timeout
 */
export async function finalizeSession(sessionId, reason = "user_end") {

    const session = getSession(sessionId);

    if (!session) {
        console.log("❌ Session not found:", sessionId);
        return;
    }

    console.log("🧠 FINALIZE SESSION:", {
        sessionId,
        reason
    });

    const now = Date.now();

    const elapsedSeconds = Math.floor(
        (now - session.createdAt) / 1000
    );

    let billedSeconds = 0;

    // ====================================
    // CASE 1: TIMEOUT (FULL CONSUME)
    // ====================================
    if (reason === "timeout") {

        billedSeconds = session.dbSeconds;

    } else {

        // ====================================
        // CASE 2: NORMAL STOP OR HEARTBEAT STOP
        // ====================================

        billedSeconds = Math.max(
            0,
            elapsedSeconds - session.graceSeconds
        );

        // never exceed paid time
        if (billedSeconds > session.dbSeconds) {
            billedSeconds = session.dbSeconds;
        }
    }

    const remainingSeconds =
        Math.max(0, session.dbSeconds - billedSeconds);

    console.log("💰 BILLING RESULT:", {
        elapsedSeconds,
        billedSeconds,
        remainingSeconds
    });

    // ====================================
    // UPDATE DB
    // ====================================
    const { error } = await supabase
        .from("users")
        .update({
            remaining_seconds: remainingSeconds
        })
        .eq("id", session.userId);

    if (error) {
        console.log("❌ DB UPDATE ERROR:", error.message);
    }

    // ====================================
    // CLEAN MEMORY
    // ====================================
    deleteSession(sessionId);

    console.log("🗑 SESSION CLEANED");
}