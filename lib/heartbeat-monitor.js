import {
    getAllSessions
} from "./session-store.js";

import {
    calculateDuration,
    calculateRemainingSeconds
} from "./billing.js";

import { supabase }
    from "./supabase.js";

// ========================================
// CONFIG
// ========================================

const CHECK_INTERVAL_MS = 2000;

const HEARTBEAT_TIMEOUT_MS =
    Number(
        process.env
            .HEARTBEAT_TIMEOUT_MS
    );

// ========================================
// START MONITOR
// ========================================

export function startHeartbeatMonitor() {

    console.log(
        "💓 HEARTBEAT MONITOR STARTED"
    );

    setInterval(
        async () => {

            try {

                const sessions =
                    getAllSessions();

                const now =
                    Date.now();

                for (const session of sessions) {

                    try {

                        // ====================
                        // VALIDATE
                        // ====================

                        if (!session)
                            continue;

                        if (!session.isActive)
                            continue;

                        if (session.isEnding)
                            continue;

                        if (
                            session.lastHeartbeat
                            === null
                        ) {
                            continue;
                        }

                        // ====================
                        // TIME SINCE LAST HEARTBEAT
                        // ====================

                        const diff =
                            now
                            - session.lastHeartbeat;

                        // ====================
                        // TIMEOUT
                        // ====================

                        if (
                            diff <
                            HEARTBEAT_TIMEOUT_MS
                        ) {
                            continue;
                        }

                        console.log(
                            "💀 HEARTBEAT TIMEOUT:",
                            session.sessionId
                        );

                        // ====================
                        // LOCK SESSION
                        // ====================

                        session.isEnding =
                            true;

                        // ====================
                        // CALCULATE DURATION
                        // ====================

                        const duration =
                            calculateDuration(
                                session
                            );

                        console.log(
                            "⏱ AUTO DURATION:",
                            duration
                        );

                        // ====================
                        // FETCH USER
                        // ====================

                        const {
                            data: user,
                            error: fetchError
                        } = await supabase
                            .from("users")
                            .select(
                                "remaining_seconds"
                            )
                            .eq(
                                "id",
                                session.userId
                            )
                            .single();

                        if (
                            fetchError ||
                            !user
                        ) {
                            throw new Error(
                                "Failed fetching user"
                            );
                        }

                        // ====================
                        // CALCULATE REMAINING
                        // ====================

                        const updatedRemaining =
                            calculateRemainingSeconds(
                                user.remaining_seconds,
                                duration
                            );

                        // ====================
                        // UPDATE DATABASE
                        // ====================

                        const {
                            error: updateError
                        } = await supabase
                            .from("users")
                            .update({
                                remaining_seconds:
                                    updatedRemaining
                            })
                            .eq(
                                "id",
                                session.userId
                            );

                        if (updateError) {
                            throw new Error(
                                "DB update failed"
                            );
                        }

                        console.log(
                            "✅ AUTO BILL SUCCESS"
                        );

                        console.log({
                            before:
                                user.remaining_seconds,

                            duration,

                            after:
                                updatedRemaining
                        });

                        // ====================
                        // DESTROY SESSION
                        // ====================

                        session.isActive =
                            false;

                    } catch (err) {

                        console.log(
                            "❌ MONITOR SESSION ERROR:",
                            err.message
                        );
                    }
                }

            } catch (err) {

                console.log(
                    "❌ HEARTBEAT MONITOR ERROR:",
                    err.message
                );
            }

        },

        CHECK_INTERVAL_MS
    );
}