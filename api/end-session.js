// api/end-session.js
import express from "express";
import { getSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.json({ success: false, message: "Missing sessionId." });
        }

        // Authoritatively finalize the session and get the true remaining time
        const result = await finalizeSession(sessionId, "manual", false);

        if (result.success) {
            return res.json({
                success: true,
                remainingSeconds: result.remainingSeconds // 🌟 Return the real data to the UI
            });
        } else {
            return res.json({ success: false, message: "Failed finalizing session calculations." });
        }
    } catch (err) {
        console.log("❌ END SESSION ROUTE ERROR:", err.message);
        return res.json({ success: false, message: err.message });
    }
});

export default router;