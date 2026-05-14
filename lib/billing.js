import { supabase } from "./supabase.js";
import { getSession } from "./sessionStore.js";

export async function endSession(sessionId, meta = {}) {

    const now = Date.now();

    const session = getSession(sessionId);

    if (!session) {
        console.log("❌ Session not found:", sessionId);
        return null;
    }

    const rawDurationMs = now - session.startedAt;

    const graceMs = session.graceMs || 0;

    let billableMs = rawDurationMs - graceMs;
    if (billableMs < 0) billableMs = 0;

    const secondsUsed = Math.floor(billableMs / 1000);

    const totalSeconds = Math.floor(session.dbMs / 1000);

    const remainingSeconds = Math.max(
        0,
        totalSeconds - secondsUsed
    );

    console.log("💰 BILLING:", {
        sessionId,
        secondsUsed,
        remainingSeconds
    });

    // ========================================
    // 🔥 RESTORED DB FORMAT (OLD SYSTEM COMPAT)
    // ========================================
    const { data, error } = await supabase
        .from("sessions")
        .update({
            used_seconds: secondsUsed,
            remaining_seconds_after: remainingSeconds,
            ended_at: new Date().toISOString(),
            status: "ended",
            end_reason: meta.reason || "system_end"
        })
        .eq("id", sessionId)
        .select()
        .single();

    if (error) {
        console.log("❌ DB error:", error.message);
        return null;
    }

    session.ended = true;

    console.log("✅ BILLING SAVED:", data);

    return data;
}