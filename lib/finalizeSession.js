import { getSession, updateSession, deleteSession } from "./session-store.js";
import { supabase } from "./supabase.js";

// SINGLE SOURCE OF TRUTH FOR ENDING SESSION
export async function finalizeSession(sessionId, reason = "unknown") {

    const session = getSession(sessionId);

    if (!session) return;

    // prevent double execution
    if (session.status === "ending") return;

    updateSession(sessionId, { status: "ending" });

    console.log("🛑 FINALIZE SESSION:", sessionId, reason);

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - session.createdAt) / 1000);

    let billableSeconds = elapsedSeconds - session.graceSeconds;
    if (billableSeconds < 0) billableSeconds = 0;

    // clamp
    if (billableSeconds > session.dbSeconds) {
        billableSeconds = session.dbSeconds;
    }

    const remaining = Math.max(0, session.dbSeconds - billableSeconds);

    // DB UPDATE
    await supabase
        .from("users")
        .update({ remaining_seconds: remaining })
        .eq("id", session.userId);

    deleteSession(sessionId);

    console.log("✅ SESSION CLOSED:", {
        sessionId,
        reason,
        remaining
    });
}