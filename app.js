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

        // 🌟 Define the exact absolute independent lifetime (10 seconds)
        const ABSOLUTE_KILL_THRESHOLD = 10000;

        for (const session of activeSessions.values()) {

            // 🌟 FORCE INDEPENDENT TIMEOUT MATH
            // We calculate time purely from the moment start-session created the memory object.
            const totalLifetime = now - session.createdAt;

            if (totalLifetime >= ABSOLUTE_KILL_THRESHOLD) {
                console.log(`🚨 [INDEPENDENT AUTOMATIC KILL] Session ${session.sessionId} reached its maximum 10-second deadline. Wiping session immediately regardless of client state.`);

                await finalizeSession(
                    session.sessionId,
                    "stream-activity-lost", // Keeps your standard breakdown reason intact
                    false
                );
                continue; // Move directly to the next session
            }

            // ------------------------------------
            // HARD LIVE OVER-STREAM PROTECTION (Fallback check for user balances)
            // ------------------------------------
            if (session.isLive) {
                const elapsedSeconds = Math.ceil((now - session.createdAt) / 1000);
                if (elapsedSeconds >= session.dbSeconds) {
                    console.log(`🛑 [OVER-STREAM CUTOFF] Session ${session.sessionId} reached allocated balance.`);
                    await finalizeSession(session.sessionId, "balance-depleted", false);
                }
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