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
import authRoute
    from "./api/auth.js";

import startSessionRoute
    from "./api/start-session.js";



import endSessionRoute
    from "./api/end-session.js";

import { getAllSessions } from "./lib/session-store.js";
import { finalizeSession } from "./lib/finalizeSession.js";


import heartbeatRouter from "./api/heartbeat.js";
// ========================================
// HEARTBEAT MONITOR
// ========================================


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
// ROUTES
// ========================================

app.use("/api/heartbeat", heartbeatRouter);

app.use(
    "/api/auth",
    authRoute
);


app.use(
    "/api/start-session",
    startSessionRoute
);



app.use(
    "/api/end-session",
    endSessionRoute
);

// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message:
            "Origin server running"
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
        const timeSinceLastPing = now - session.lastHeartbeat;

        if (timeSinceLastPing > DISCONNECT_THRESHOLD) {
            console.log(`🚨 CRASH DETECTED: Session ${session.sessionId} went dark for ${Math.floor(timeSinceLastPing / 1000)}s.`);

            // Call finalizer using the exact same calculation logic as a manual stop!
            await finalizeSession(session.sessionId, "heartbeat-lost", false);
        }
    }
}, 5000); // Sweeps memory every 5 seconds

// ========================================
// START HEARTBEAT MONITOR
// ========================================


// ========================================
// SERVER
// ========================================

const PORT =
    process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `🚀 SERVER RUNNING ON ${PORT}`
    );
});