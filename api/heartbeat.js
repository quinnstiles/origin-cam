import express from "express";
import { getUserSession, deleteSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const userId = req.user.id; // Secure identity extraction

        const session = getUserSession(userId);
        if (!session) {
            return res.status(404).json({ success: false, message: "No active session found. Stop streaming." });
        }

        const now = Date.now();

        // ====================================
        // FIRST HEARTBEAT (ACTIVATION HANDSHAKE)
        // ====================================
        if (!session.isLive) {
            console.log(`✨ FIRST HEARTBEAT RECEIVED: Activating billing tracking for Session ${session.sessionId}`);

            // 1. Defuse the initial 15-second pending safety timer safely
            if (session.timeoutHandle) {
                clearTimeout(session.timeoutHandle);
                session.timeoutHandle = null;
            }

            // 2. Lock the official live timestamp values
            session.isLive = true;
            session.createdAt = now;
            session.lastHeartbeat = now;

            // 3. Establish the runtime maximum duration safety constraint
            const totalAllowedMs = (session.dbSeconds + session.graceSeconds) * 1000;

            session.timeoutHandle = setTimeout(async () => {
                console.log(`🚨 RUNTIME EXPIRED: Session ${session.sessionId} reached its balance ceiling limit.`);
                await finalizeSession(session.sessionId, "timeout", false);
            }, totalAllowedMs);

            return res.json({ success: true, message: "Session activated successfully." });
        }

        // ====================================
        // SUBSEQUENT HEARTBEATS (LIVENESS KEEP-ALIVE)
        // ====================================
        session.lastHeartbeat = now;
        return res.json({ success: true });

    } catch (err) {
        console.error("❌ HEARTBEAT ERROR:", err.message);
        return res.status(500).json({ success: false, message: "Internal server processing fault." });
    }
});

export default router;