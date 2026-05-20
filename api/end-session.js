import express from "express";
import { finalizeSession } from "../lib/finalizeSession.js";
// Ensure your secure token authentication middleware is active here (e.g., checkAuth)

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        // 1. 🔒 AUTHENTICATED USER (Populated by your auth middleware)
        // If you aren't using middleware yet, you can fallback to req.body.userId temporarily,
        // but keeping it on req.user.id is the secure way to go!
        const userId = req.user?.id;
        const { sessionId } = req.body;

        console.log(`🛑 END SESSION REQUESTED BY USER: ${userId || "Unknown"} for Session: ${sessionId}`);

        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Missing sessionId in request body" });
        }

        // 2. Finalize securely using the explicit sessionId 
        // We pass false for 'isUserId' so it cleans up this exact session instance.
        const summary = await finalizeSession(sessionId, "manual", false);

        // 3. ⏱️ RETURN CURRENT BALANCE VALUE TO NODE -> C++
        // We pull 'remainingSeconds' out of the summary object returned by our patched finalizeSession.js
        return res.json({
            success: true,
            message: "Session closed successfully",
            remainingSeconds: summary ? summary.remainingSeconds : 0
        });

    } catch (err) {
        console.log("❌ END SESSION ROUTER ERROR:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;