import { supabase } from "./supabase.js";

// =====================================================
// ENV
// =====================================================

const GRACE_MS =
    Number(process.env.GRACE_TIME || 10000);

const HEARTBEAT_TIMEOUT_MS =
    Number(process.env.HEARTBEAT_TIMEOUT || 15000);

// =====================================================
// END SESSION
// =====================================================

export async function endSession(
    sessionId,
    meta = {}
) {

    try {

        const now = Date.now();

        // =========================================
        // GET SESSION
        // =========================================

        const {
            data: session,
            error
        } = await supabase
            .from("sessions")
            .select("*")
            .eq("id", sessionId)
            .single();

        if (error || !session) {

            console.log(
                "Session not found:",
                sessionId
            );

            return null;
        }

        // =========================================
        // ALREADY CLOSED
        // =========================================

        if (session.ended_at) {
            return session;
        }

        // =========================================
        // SESSION TIME
        // =========================================

        const startedAt =
            Number(session.started_at);

        const rawDurationMs =
            now - startedAt;

        const fullDurationMs =
            (session.session_duration || 0) * 1000;

        // =========================================
        // FULLY CONSUMED
        // =========================================

        let remainingSeconds = 0;
        let billedSeconds = session.db_seconds;

        if (
            rawDurationMs < fullDurationMs
        ) {

            // =====================================
            // REMOVE GRACE
            // =====================================

            const billableMs =
                Math.max(
                    0,
                    rawDurationMs - GRACE_MS
                );

            billedSeconds =
                Math.floor(
                    billableMs / 1000
                );

            remainingSeconds =
                Math.max(
                    0,
                    session.db_seconds -
                    billedSeconds
                );
        }

        // =========================================
        // NO GRACE LEAK
        // =========================================

        if (
            remainingSeconds >
            session.db_seconds
        ) {
            remainingSeconds =
                session.db_seconds;
        }

        // =========================================
        // UPDATE USER BALANCE
        // =========================================

        await supabase
            .from("profiles")
            .update({
                seconds:
                    remainingSeconds
            })
            .eq(
                "id",
                session.user_id
            );

        // =========================================
        // CLOSE SESSION
        // =========================================

        const {
            data,
            error: updateError
        } = await supabase
            .from("sessions")
            .update({
                ended_at: now,

                billed_seconds:
                    billedSeconds,

                remaining_seconds:
                    remainingSeconds,

                status: "closed",

                close_reason:
                    meta.reason || "manual"
            })
            .eq("id", sessionId)
            .select()
            .single();

        if (updateError) {

            console.log(
                "Billing update error:",
                updateError.message
            );

            return null;
        }

        // =========================================
        // DEBUG
        // =========================================

        console.log("💰 SESSION BILLED");

        console.log({
            sessionId,
            rawDurationMs,
            billedSeconds,
            remainingSeconds
        });

        return data;

    } catch (e) {

        console.log(
            "endSession error:",
            e.message
        );

        return null;
    }
}

// =====================================================
// CLOSE DEAD SESSIONS
// =====================================================

export async function closeDeadSessions() {

    try {

        const now = Date.now();

        const {
            data: sessions,
            error
        } = await supabase
            .from("sessions")
            .select("*")
            .is("ended_at", null);

        if (error || !sessions) {

            console.log(
                "Billing fetch error:",
                error?.message
            );

            return;
        }

        for (const session of sessions) {

            // =====================================
            // HEARTBEAT CHECK
            // =====================================

            const lastSeen =
                session.last_seen ||
                session.started_at;

            const heartbeatDiff =
                now - lastSeen;

            if (
                heartbeatDiff >
                HEARTBEAT_TIMEOUT_MS
            ) {

                console.log(
                    "💀 Heartbeat lost:",
                    session.id
                );

                await endSession(
                    session.id,
                    {
                        reason:
                            "heartbeat_timeout"
                    }
                );

                continue;
            }

            // =====================================
            // FULL SESSION CONSUMED
            // =====================================

            const elapsedMs =
                now - session.started_at;

            const maxDurationMs =
                (session.session_duration || 0) * 1000;

            if (
                elapsedMs >= maxDurationMs
            ) {

                console.log(
                    "⏱ Session fully consumed:",
                    session.id
                );

                await endSession(
                    session.id,
                    {
                        reason:
                            "fully_consumed"
                    }
                );
            }
        }

    } catch (e) {

        console.log(
            "closeDeadSessions error:",
            e.message
        );
    }
}

// =====================================================
// BILLING WATCHER
// =====================================================

export function startBillingWatcher() {

    setInterval(async () => {

        try {

            await closeDeadSessions();

        } catch (e) {

            console.log(
                "Billing watcher error:",
                e.message
            );
        }

    }, 5000);

    console.log(
        "💰 Billing watcher started"
    );
}