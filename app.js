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

// ========================================
// WEB PLATFORM ROUTES
// ========================================
import registerRoute from "./api/register.js";
import loginRoute from "./api/login.js";
import profileRoute from "./api/profile.js";

// ========================================
// ADMIN ROUTES
// ========================================
import adminLoginRoute from "./api/admin-login.js";
import adminChildListRoute from "./api/admin-child-list.js";
import adminLogoutRoute from "./api/admin-logout.js";

// ========================================
// SESSION ENGINE
// ========================================
import { getAllSessions } from "./lib/session-store.js";
import { finalizeSession } from "./lib/finalizeSession.js";

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
// CORE ROUTES
// ========================================
app.use("/api/heartbeat", heartbeatRouter);

app.use("/api/auth", authRoute);

app.use("/api/start-session", startSessionRoute);

app.use("/api/end-session", endSessionRoute);

app.use("/api/system-check", systemCheckRoute);

// ========================================
// WEB PLATFORM ROUTES
// ========================================
app.use("/api/register", registerRoute);

app.use("/api/login", loginRoute);

app.use("/api", profileRoute);

// ========================================
// ADMIN ROUTES
// ========================================
app.use(
    "/api/admin-login",
    adminLoginRoute
);

app.use(
    "/api/admin-child",
    adminChildListRoute
);

app.use(
    "/api/admin-logout",
    adminLogoutRoute
);

// ========================================
// HEALTH CHECK
// ========================================
app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "Origin server running"
    });
});

// ========================================
// GLOBAL CRASH DETECTION ENGINE
// ========================================
setInterval(async () => {

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

        if (isNaN(timeSinceLastPing)) {

            console.log(
                `⚠️ Warning: Session ${session.sessionId} has an invalid timestamp. Correcting flag.`
            );

            session.lastHeartbeat =
                Date.now();

            continue;
        }

        if (
            timeSinceLastPing >
            DISCONNECT_THRESHOLD
        ) {

            console.log(
                `🚨 CRASH DETECTED: Session ${session.sessionId} went dark for ${Math.floor(timeSinceLastPing / 1000)}s.`
            );

            // =================================
            // AUTO FINALIZE SESSION
            // =================================
            await finalizeSession(
                session.sessionId,
                "heartbeat-lost",
                false
            );
        }
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