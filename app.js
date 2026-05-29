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
import endSessionRoute from "./api/end-session.js";
import systemCheckRoute from "./api/system_check.js";
import heartbeatRouter from "./api/heartbeat.js";
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
import adminSettingsRouter
    from "./api/admin-settings.js";
// ========================================
// SESSION ENGINE
// ========================================
import { getAllSessions } from "./lib/session-store.js";
import { finalizeSession } from "./lib/finalizeSession.js";

import adminChildListRouter
    from "./api/admin-child-list.js";
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
// CORE API ROUTES
// ========================================
app.use(
    "/api/heartbeat",
    heartbeatRouter
);

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

app.use(
    "/api/system-check",
    systemCheckRoute
);

// ========================================
// WEB PLATFORM ROUTES
// ========================================
app.use(
    "/api/register",
    registerRoute
);

app.use("/api/login", loginRouter);

app.use(
    "/api",
    profileRoute
);

// ========================================
// ADMIN ROUTES
// ========================================
app.use(
    "/api/admin-login",
    adminLoginRoute
);



app.use(
    "/api/admin-settings",
    adminSettingsRouter
);

app.use("/api/admin-user", adminUserRouter);

app.use(
    "/api/admin-child-list",
    adminChildListRouter
);

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
// GLOBAL CRASH DETECTION ENGINE
// ========================================
setInterval(async () => {

    try {

        const activeSessions =
            getAllSessions();

        const now =
            Date.now();

        const DISCONNECT_THRESHOLD =
            10000;

        for (const session of activeSessions.values()) {

            const referenceTime =
                session.lastHeartbeat ||
                session.createdAt;

            const timeSinceLastPing =
                now - referenceTime;

            // ====================================
            // INVALID TIMESTAMP SAFETY
            // ====================================
            if (
                isNaN(timeSinceLastPing)
            ) {

                console.log(
                    `⚠️ Warning: Session ${session.sessionId} has invalid heartbeat timing.`
                );

                session.lastHeartbeat =
                    Date.now();

                continue;
            }

            // ====================================
            // SESSION CRASH DETECTED
            // ====================================
            if (
                timeSinceLastPing >
                DISCONNECT_THRESHOLD
            ) {

                console.log(
                    `🚨 CRASH DETECTED: Session ${session.sessionId} lost heartbeat for ${Math.floor(timeSinceLastPing / 1000)}s`
                );

                // ====================================
                // AUTO FINALIZE SESSION
                // ====================================
                await finalizeSession(
                    session.sessionId,
                    "heartbeat-lost",
                    false
                );
            }
        }

    } catch (err) {

        console.error(
            "❌ GLOBAL SESSION ENGINE FAILURE:",
            err
        );
    }

}, 5000);

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