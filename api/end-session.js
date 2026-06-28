import express from "express";
import { activeControlSessions } from "../app.js"; // 👈 Pull our tracking map from app.js
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.json({ success: false, message: "Missing sessionId parameters." });
        }

        // 🛡️ THE ANTI-FRAUD SWITCH: Is the real streaming pipe still active?
        if (activeControlSessions.has(sessionId)) {
            console.log(`🚫 [FRAUD DEFLECTED] Prevented a client bypass attempt targeting active session: ${sessionId}`);
            return res.json({
                success: false,
                message: "Security Error: Active streaming pipe pipeline is still live. Request denied."
            });
        }

        // If the websocket is truly dead, handle normal post-session cleanup safely
        const result = await finalizeSession(sessionId, "manual", false);
        return res.json(result);

    } catch (err) {
        console.log("❌ END SESSION ROUTE ERROR:", err.message);
        return res.json({ success: false, message: err.message });
    }
});

export default router;