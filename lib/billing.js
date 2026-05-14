import { supabase } from "./supabase.js";
import { getSession } from "./sessionStore.js";

// ========================================
// FINAL BILLING ENGINE
// ========================================
export async function endSession(sessionId, meta = {}) {

    const now = Date.now();

    const session = getSession(sessionId);

    if (!session) {
        console.log("❌ Session not found in memory:", sessionId);
        return null;
    }

    if (session.ended) {
        console.log("⚠️ Already billed:", sessionId);
        return null;
    }

    // ========================================
    // RAW DURATION (ms)
    // ========================================
    const rawDurationMs = now - session.startedAt;

    // ========================================
    // GRACE WINDOW (ms)
    // ========================================
    const graceMs = session.graceMs || 0;

    // ========================================
    // BILLABLE TIME
    // ========================================
    let billableMs = rawDurationMs - graceMs;

    if (billableMs < 0) billableMs = 0;

    const billedSeconds = Math.floor(billableMs / 1000);

    console.log("💰 BILLING CALC:", {
        sessionId,
        rawDurationMs,
        graceMs,
        billableMs,
        billedSeconds
    });

    // ========================================
    // UPDATE SUPABASE
    // ========================================
    const { data, error } = await supabase
        .from("sessions")
        .update({
            ended_at: now,
            billed_seconds: billedSeconds,
            status: "closed",
            close_reason: meta.reason || "session_end"
        })
        .eq("id", sessionId)
        .select()
        .single();

    if (error) {
        console.log("❌ Billing DB error:", error.message);
        return null;
    }

    // mark memory session closed
    session.ended = true;

    console.log("✅ BILLING FINALIZED:", data);

    return data;
}