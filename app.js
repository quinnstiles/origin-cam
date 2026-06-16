import express from "express";
import cors from "cors";
import dotenv from "dotenv";

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
            // 🛡️ LOGIC 1 & 1b: UN-ACTIVATED HANDSHAKE WATCHDOG (ZERO-TRUST Posture)
            // ------------------------------------------------------------
            if (!session.isLive) {
                // Balance-driven limit: The user's wallet dictates the startup grace period
                const maximumStartupGraceMs = session.dbSeconds * 1000;

                if (elapsedMilliseconds >= maximumStartupGraceMs) {
                    console.log(`🚨 [WATCHDOG BREAKDOWN] Session ${session.sessionId} failed to activate within dynamic wallet limit of ${session.dbSeconds}s.`);
                    console.log(`💀 [ZERO-TRUST PENALTY] Setting database profile balance to 0s for user: ${session.userId}`);

                    // 1. Authoritatively lock database profile balance to zero
                    await supabase
                        .from("users")
                        .update({ remaining_seconds: 0 })
                        .eq("id", session.userId);

                    // 2. Kill the session by clearing memory cache tracking paths
                    await finalizeSession(session.sessionId, "stream-activity-lost", false);
                }
                continue; // Move strictly to next session ticket evaluation
            }

            // ------------------------------------------------------------
            // 🔄 LOGIC 2: ACTIVE LIVE STREAM BILLING CLOCK
            // ------------------------------------------------------------
            if (elapsedSeconds >= session.dbSeconds) {
                console.log(`🛑 [OVER-STREAM CUTOFF] Live Session ${session.sessionId} reached absolute allocated balance (${session.dbSeconds}s).`);
                await finalizeSession(session.sessionId, "balance-depleted", false);
                continue;
            }

            // ------------------------------------------------------------
            // 📡 LOGIC 3: MID-STREAM SILENCE GUARD (Loss of Pulse)
            // ------------------------------------------------------------
            const SILENCE_THRESHOLD_MS = 6000; // 6 seconds
            if (now - session.lastStreamPulse > SILENCE_THRESHOLD_MS) {
                console.log(`⚠️ [HEARTBEAT LOSS] Live Session ${session.sessionId} went silent. Finalizing fractional billing usage.`);
                await finalizeSession(session.sessionId, "stream-activity-lost", false);
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