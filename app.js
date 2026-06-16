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

        // 🌟 Swift testing evaluation thresholds
        const BACKEND_DISCONNECT_THRESHOLD = 6000;
        const ACTIVATION_GRACE_PERIOD = 6000; // 🌟 6 seconds max to activate after start-session

        for (const session of activeSessions.values()) {

            // ------------------------------------
            // 🌟 UN-ACTIVATED SESSIONS LOOPGUARD
            // ------------------------------------
            if (!session.isLive) {
                const timeSinceCreation = now - session.createdAt;
                if (timeSinceCreation > ACTIVATION_GRACE_PERIOD) {
                    console.log(`🚨 [STARTUP TIMEOUT] Session ${session.sessionId} failed to send an activation frame within ${ACTIVATION_GRACE_PERIOD / 1000}s. Evicting dead payload.`);
                    await finalizeSession(
                        session.sessionId,
                        "stream-activity-lost",
                        false
                    );
                }
                continue; // Move to next session file context safely
            }

            // ------------------------------------
            // HARD LIVE OVER-STREAM PROTECTION
            // ------------------------------------
            const elapsedSeconds = Math.ceil((now - session.createdAt) / 1000);

            if (elapsedSeconds >= session.dbSeconds) {
                console.log(`🛑 [OVER-STREAM CUTOFF] Session ${session.sessionId} reached allocated balance (${session.dbSeconds}s). Shutting down execution.`);
                await finalizeSession(
                    session.sessionId,
                    "balance-depleted",
                    false
                );
                continue;
            }

            // ------------------------------------
            // AUTOMATIC CRASH & DISCONNECT TEARDOWN
            // ------------------------------------
            const referenceTime = session.lastStreamPulse || session.createdAt;
            const timeSinceLastPulse = now - referenceTime;

            if (isNaN(timeSinceLastPulse)) {
                console.log(`⚠️ Warning: Session ${session.sessionId} has missing stream timing tracking.`);
                session.lastStreamPulse = Date.now();
                continue;
            }

            if (timeSinceLastPulse > BACKEND_DISCONNECT_THRESHOLD) {
                console.log(
                    `🚨 STREAM LOSS DETECTED: Session ${session.sessionId} missed heartbeat deadlines (${Math.floor(timeSinceLastPulse / 1000)}s total silence). Closing session...`
                );

                await finalizeSession(
                    session.sessionId,
                    "stream-activity-lost",
                    false
                );
            }
        }
    } catch (err) {
        console.error("❌ GLOBAL STREAM ENGINE MONITOR FAILURE:", err);
    }
}, 1000); // 🌟 Run loop every 1 second for ultra-tight precision checking

// ========================================
// SERVER
// ========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
});