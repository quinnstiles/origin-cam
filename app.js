import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer } from "ws"; // 👈 Add this line
import { supabase } from "./lib/supabase.js"; // 👈 Add this line for WebSocket fallback commits

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
import { getSession, deleteSession } from "./lib/session-store.js";

// Global map tracking active, live socket pipes exclusively
export const activeControlSessions = new Map();

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
// SERVER INTERNALS & WEBSOCKET GATEWAY
// ========================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
});

// Attach the secure WebSocket Server to your existing express port instance
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
    // Parse target queries passed from the client endpoint link url: ws://yourdomain.com?sessionId=xyz
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = urlParams.searchParams.get("sessionId");

    if (!sessionId) {
        ws.send(JSON.stringify({ command: "TERMINATE_IMMEDIATE", error: "Missing session allocation handle." }));
        return ws.close();
    }

    const session = getSession(sessionId);
    if (!session) {
        ws.send(JSON.stringify({ command: "TERMINATE_IMMEDIATE", error: "Target session profile record not found." }));
        return ws.close();
    }

    let countdownInterval = null;
    let isStreamActive = false;
    let currentBalance = session.dbSeconds;

    // Store this live physical socket connection in the safety map tracker
    activeControlSessions.set(sessionId, ws);

    // ⏳ 1. ENGAGE THE 12-SECOND HANDSHAKE GRACE TRAP
    const graceTimeout = setTimeout(() => {
        if (!isStreamActive) {
            console.log(`🚨 [WATCHDOG] Session ${sessionId} failed frame submission within 12s. Dropping link.`);
            ws.send(JSON.stringify({ command: "TERMINATE_IMMEDIATE", error: "Connection failed: No frames received." }));
            ws.close();
        }
    }, 12000);

    ws.on("message", async (message) => {
        try {
            const data = JSON.parse(message);

            // 🟢 2. REALTIME HANDSHAKE: FIRST STREAMING FRAME DETECTED
            if (data.event === "FRAME_ACTIVE" && !isStreamActive) {
                isStreamActive = true;
                clearTimeout(graceTimeout); // Disarm the 12s failure trigger
                session.isLive = true;
                console.log(`🏁 [ENGINE] WebRTC frames detected for ${sessionId}. Cloud billing countdown started.`);

                // 🕒 3. AUTHORITATIVE CLOUD MASTER COUNTDOWN LOOP
                countdownInterval = setInterval(async () => {
                    if (currentBalance <= 0) {
                        clearInterval(countdownInterval);
                        ws.send(JSON.stringify({ command: "TERMINATE_IMMEDIATE", error: "Wallet balance fully depleted." }));
                        ws.close();
                        return;
                    }

                    currentBalance--;
                    session.dbSeconds = currentBalance; // Keep store object accurate

                    // Push the live server remaining seconds directly down to the app UI view
                    ws.send(JSON.stringify({
                        command: "TICK",
                        remainingSeconds: currentBalance
                    }));

                    // Database balance batch syncs executed safely every 5 ticks
                    if (currentBalance % 5 === 0) {
                        await supabase.from("users").update({ remaining_seconds: currentBalance }).eq("id", session.userId);
                    }
                }, 1000);
            }
        } catch (err) {
            console.log("Malformed frame sync frame dropped:", err.message);
        }
    });

    // 🛑 4. SEVERANCE PROTECTION CLEANUP ENGINE
    ws.on("close", async () => {
        clearTimeout(graceTimeout);
        if (countdownInterval) clearInterval(countdownInterval);

        activeControlSessions.delete(sessionId);
        deleteSession(sessionId);

        // Authoritatively commit final structural balance calculations to the production database table layout
        await supabase.from("users")
            .update({
                remaining_seconds: currentBalance,
                active_session_id: null
            })
            .eq("id", session.userId);

        console.log(`🔌 [CLEANUP] Channel broken for session ${sessionId}. Account updated safely with balance: ${currentBalance}s`);
    });
});