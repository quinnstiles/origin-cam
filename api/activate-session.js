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

        // 🌟 GATEWAY RULE 1: If the dynamic watchdog loop already cleared the ticket or zeroed out balance, reject instantly!
        if (!session) {
            return res.json({ success: "false", message: "Session not found, expired, or balance has been written down to 0." });
        }

        const now = Date.now();

        // 🌟 GATEWAY RULE 2: Proactive threshold network guard
        if (session.isLive) {
            const elapsedSeconds = Math.ceil((now - session.createdAt) / 1000);
            if (elapsedSeconds >= session.dbSeconds) {
                console.log(`🚨 [GATEWAY PROTECTION] Force-blocking activation payload for ${sessionId}. Balance exhausted.`);
                return res.json({ success: "false", message: "Session balance allocation fully exhausted." });
            }
        }

        // 1. ACTIVATE BILLING CLOCK FROM THIS EXACT MILLISECOND
        if (!session.isLive) {
            session.isLive = true;
            session.createdAt = now; // The active consumption countdown officially begins right now
            console.log(`🎥 Stream confirmed live. Billing engine engaged for: ${sessionId}`);
        }

        // Keep interval loop data synchronized
        session.lastStreamPulse = now;

        return res.json({ success: "true", message: "Session activated successfully." });

    } catch (err) {
        console.log("❌ ACTIVATE SESSION ERROR:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

export default router;