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

        // 🌟 ZERO-TRUST GATEWAY RULE: If the app.js watchdog countdown already expired and 
        // penalized the account to 0 (or evicted it), block late activations instantly!
        if (!session) {
            return res.json({ success: "false", message: "Session not found, expired, or balance has been written down to 0." });
        }

        const now = Date.now();

        // 1. ENGAGE BILLING CLOCK FROM THIS EXACT MILLISECOND
        if (!session.isLive) {
            session.isLive = true;
            session.createdAt = now; // The countdown officially begins right now
            console.log(`🎥 Stream confirmed live. Billing engine engaged for: ${sessionId}`);
        }

        // Initialize the tracking timestamp so app.js knows when the live stream started
        session.lastStreamPulse = now;

        return res.json({ success: "true", message: "Session activated successfully." });

    } catch (err) {
        console.log("❌ ACTIVATE SESSION ERROR:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

export default router;