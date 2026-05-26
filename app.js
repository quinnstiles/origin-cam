import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// ========================================
// LOAD ENV
// ========================================
dotenv.config();

// ========================================
// ROUTES
// ========================================
import authRoute from "./api/auth.js";
import startSessionRoute from "./api/start-session.js";
import endSessionRoute from "./api/end-session.js";
import systemCheckRoute from "./api/system_check.js";
import heartbeatRouter from "./api/heartbeat.js";

// 🌟 NEW: Web Platform Authentication Ingress
import registerRoute from "./api/register.js";
import loginRoute from "./api/login.js";
import profileRoute from "./api/profile.js";

import { getAllSessions } from "./lib/session-store.js";
import { finalizeSession } from "./lib/finalizeSession.js";
import adminChildRoute from "./api/admin-child.js";
import adminLoginRoute from "./api/admin-login.js";
// ========================================
// APP
// ========================================
const app = express();

// ========================================
// MIDDLEWARE
// ========================================
app.use(cors());
app.use(express.json({
    limit: "10mb"
}));

// ========================================
// MOUNT ROUTES
// ========================================
app.use("/api/heartbeat", heartbeatRouter);
app.use("/api/auth", authRoute);
app.use("/api/start-session", startSessionRoute);
app.use("/api/end-session", endSessionRoute);
app.use("/api/system-check", systemCheckRoute);
app.use("/api/admin-login", adminLoginRoute);
// 🌟 NEW: Mount your web onboarding and verification gateways
app.use("/api/register", registerRoute); // Maps directly to /api/register
app.use("/api/login", loginRoute);       // Maps directly to /api/login (and /api/forgot-password if structured inside loginRoute)
app.use("/api/admin-child", adminChildRoute);
// Mount profile and ledger tracking tools securely
app.use("/api", profileRoute);
// ========================================
// HEALTH CHECK
// ========================================
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Origin server running"
    });
});

// ====================================
// 💓 THE GLOBAL CRASH DETECTION ENGINE
// ====================================
setInterval(async () => {
    const activeSessions = getAllSessions();
    const now = Date.now();
    const DISCONNECT_THRESHOLD = 10000; // 10 seconds without a ping = crash

    for (const session of activeSessions.values()) {
        const referenceTime = session.lastHeartbeat || session.createdAt;
        const timeSinceLastPing = now - referenceTime;

        if (isNaN(timeSinceLastPing)) {
            console.log(`⚠️ Warning: Session ${session.sessionId} has an invalid timestamp. Correcting flag.`);
            session.lastHeartbeat = Date.now();
            continue;
        }

        if (timeSinceLastPing > DISCONNECT_THRESHOLD) {
            console.log(`🚨 CRASH DETECTED: Session ${session.sessionId} went dark for ${Math.floor(timeSinceLastPing / 1000)}s.`);

            // Call finalizer using the exact same calculation logic as a manual stop!
            await finalizeSession(session.sessionId, "heartbeat-lost", false);
        }
    }
}, 5000); // Sweeps memory every 5 seconds

// ========================================
// SERVER
// ========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 SERVER RUNNING ON ${PORT}`);
});