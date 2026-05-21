import express from "express";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body;

        console.log(`🛑 END SESSION REQUESTED FOR TARGET INSTANCE ID: ${sessionId}`);

        if (!sessionId) {
            console.log("⚠️ END SESSION ABORTED: Received request without a valid sessionId payload.");
            return res.status(400).json({ success: false, message: "Missing sessionId in request body" });
        }

        // Finalize securely using the explicit sessionId 
        // Memory eviction is handled on step one inside our patched finalizeSession structure
        const summary = await finalizeSession(sessionId, "manual", false);

        // Fallback default safely if summary returns empty or encountered db edge cases
        const balanceResponse = summary && typeof summary.remainingSeconds !== 'undefined'
            ? summary.remainingSeconds
            : 0;

        console.log(`✨ END ROUTE COMPLETION: Returning balance balance ceiling [${balanceResponse}s] to proxy bridge.`);

        return res.json({
            success: true,
            message: "Session closed successfully",
            remainingSeconds: Number(balanceResponse)
        });

    } catch (err) {
        console.log("❌ END SESSION ROUTER ERROR:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;