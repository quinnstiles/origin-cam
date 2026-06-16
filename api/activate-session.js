import express from "express";
import { getSession } from "../lib/session-store.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.json({ success: "false", message: "Missing sessionId." });
        }

        const session = getSession(sessionId);
        if (!session) {
            return res.json({ success: "false", message: "Session not found or already terminated." });
        }

        const now = Date.now();

        // 1. DEFUSE THE STARTUP BOMB TIMER
        if (global.startupTimers && global.startupTimers.has(sessionId)) {
            clearTimeout(global.startupTimers.get(sessionId));
            global.startupTimers.delete(sessionId);
            console.log(`🛡️ BOMB TIMER DEFUSED: Session ${sessionId} confirmed active by Node.`);
        }

        // 2. ACTIVATE BILLING CLOCK FROM THIS EXACT MILLISECOND
        if (!session.isLive) {
            session.isLive = true;
            session.createdAt = now; // 🌟 The clock officially starts now!
            console.log(`🎥 Stream went live. Billing clock started for: ${sessionId}`);
        }

        // 🌟 ADD THIS: Track the pulse timestamp for the app.js watchdog interval loop
        session.lastStreamPulse = now;

        return res.json({ success: "true", message: "Session activated successfully." });

    } catch (err) {
        console.log("❌ ACTIVATE SESSION ERROR:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

export default router;