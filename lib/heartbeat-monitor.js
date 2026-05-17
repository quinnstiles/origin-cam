import { getAllSessions } from "./session-store.js";
import { calculateDuration, calculateRemainingSeconds } from "./billing.js";
import { supabase } from "./supabase.js";

// ========================================
// CONFIG
// ========================================
const CHECK_INTERVAL_MS = 2000;
const HEARTBEAT_TIMEOUT_MS = Number(process.env.HEARTBEAT_TIMEOUT_MS || 10000);

// ========================================
// START MONITOR
// ========================================
export function startHeartbeatMonitor() {
    console.log("💓 HEARTBEAT MONITOR STARTED");

    setInterval(async () => {
        try {
            const sessions = getAllSessions();
            const now = Date.now();

            for (const session of sessions.values()) {
                try {
                    if (!session) continue;
                    if (!session.isActive) continue;
                    if (session.isEnding) continue;
                    if (!session.lastHeartbeat) continue;

                    const diff = now - session.lastHeartbeat;

                    if (diff < HEARTBEAT_TIMEOUT_MS) continue;

                    console.log("💀 HEARTBEAT TIMEOUT:", session.sessionId);

                    session.isEnding = true;

                    const duration = calculateDuration(session);

                    const { data: user, error } = await supabase
                        .from("users")
                        .select("remaining_seconds")
                        .eq("id", session.userId)
                        .single();

                    if (error || !user) {
                        throw new Error("Failed fetching user");
                    }

                    const updatedRemaining = calculateRemainingSeconds(
                        user.remaining_seconds,
                        duration
                    );

                    await supabase
                        .from("users")
                        .update({
                            remaining_seconds: updatedRemaining
                        })
                        .eq("id", session.userId);

                    console.log("✅ AUTO BILL SUCCESS");

                    session.isActive = false;

                } catch (err) {
                    console.log("❌ MONITOR SESSION ERROR:", err.message);
                }
            }
        } catch (err) {
            console.log("❌ HEARTBEAT MONITOR ERROR:", err.message);
        }
    }, CHECK_INTERVAL_MS);
}