import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./lib/supabase.js";

// ========================================
// LOAD ENV
// ========================================
dotenv.config();

// ========================================
// CORE ROUTES
// ========================================
import authRoute from "./api/auth.js";
import startSessionRoute from "./api/start-session.js";
import activateSessionRoute from "./api/activate-session.js";
import endSessionRoute from "./api/end-session.js";
import systemCheckRoute from "./api/system_check.js";
import adminUserRouter from "./api/admin-user.js";

// ========================================
// WEB PLATFORM ROUTES
// ========================================
import registerRoute from "./api/register.js";
import loginRouter from "./api/login.js";
import profileRoute from "./api/profile.js";

// ========================================
// ADMIN ROUTES
// ========================================
import adminLoginRoute from "./api/admin-login.js";
import adminSettingsRouter from "./api/admin-settings.js";
import adminChildListRouter from "./api/admin-child-list.js";

// ========================================
// SESSION ENGINE
// ========================================
import { getAllSessions } from "./lib/session-store.js";
import { finalizeSession } from "./lib/finalizeSession.js";

// ========================================
// APP INITIALIZATION
// ========================================
const app = express();

// ========================================
// MIDDLEWARE
// ========================================
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ========================================
// CORE API ROUTES
// ========================================
app.use("/api/auth", authRoute);
app.use("/api/start-session", startSessionRoute);
app.use("/api/activate-session", activateSessionRoute);
app.use("/api/end-session", endSessionRoute);
app.use("/api/system-check", systemCheckRoute);

// ========================================
// WEB PLATFORM ROUTES
// ========================================
app.use("/api/register", registerRoute);
app.use("/api/login", loginRouter);
app.use("/api", profileRoute);

// ========================================
// ADMIN ROUTES
// ========================================
app.use("/api/admin-login", adminLoginRoute);
app.use("/api/admin-settings", adminSettingsRouter);
app.use("/api/admin-user", adminUserRouter);
app.use("/api/admin-child-list", adminChildListRouter);

// ========================================
// HEALTH CHECK
// ========================================
app.get("/", (req, res) => {
    return res.json({
        success: true,
        message: "Origin server running"
    });
});

// ========================================
// SERVER-SIDE STREAM MONITORING ENGINE
// ========================================
setInterval(async () => {
    try {
        const activeSessions = getAllSessions();
        const now = Date.now();

        for (const session of activeSessions.values()) {
            const elapsedMilliseconds = now - session.createdAt;
            const elapsedSeconds = Math.ceil(elapsedMilliseconds / 1000);

            // ------------------------------------------------------------
            // 🛡️ LOGIC 1: UN-ACTIVATED HANDSHAKE WATCHDOG (ZERO-TRUST POSTURE)
            // ------------------------------------------------------------
            if (!session.isLive) {
                const maximumStartupGraceMs = session.dbSeconds * 1000;

                if (elapsedMilliseconds >= maximumStartupGraceMs) {
                    console.log(`🚨 [WATCHDOG BREAKDOWN] Session ${session.sessionId} failed to activate within dynamic wallet limit of ${session.dbSeconds}s.`);
                    console.log(`💀 [ZERO-TRUST PENALTY] Zeroing balance and clearing states in Supabase for user: ${session.userId}`);

                    // 1. Clear state flags and authoritatively penalize balance to zero
                    await supabase
                        .from("users")
                        .update({
                            remaining_seconds: 0,
                            active_session_id: null,
                            session_is_live: false
                        })
                        .eq("id", session.userId);

                    // 2. Clear memory references and terminate local tracking ticket
                    await finalizeSession(session.sessionId, "stream-activity-lost", false);
                }
                continue;
            }

            // ------------------------------------------------------------
            // 🔄 LOGIC 2: ACTIVE LIVE STREAM BILLING CLOCK
            // ------------------------------------------------------------
            if (elapsedSeconds >= session.dbSeconds) {
                console.log(`🛑 [OVER-STREAM CUTOFF] Live Session ${session.sessionId} reached absolute allocated balance (${session.dbSeconds}s).`);

                // Clear state tracking metrics in Supabase
                await supabase
                    .from("users")
                    .update({
                        active_session_id: null,
                        session_is_live: false
                    })
                    .eq("id", session.userId);

                // Authoritatively calculate database write-backs and clear cache
                await finalizeSession(session.sessionId, "balance-depleted", false);
            }
        }
    } catch (err) {
        console.error("❌ GLOBAL STREAM ENGINE MONITOR FAILURE:", err);
    }
}, 1000);

// ========================================
// SERVER
// ========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
});