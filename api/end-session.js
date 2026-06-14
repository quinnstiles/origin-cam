import express from "express";
import { finalizeSession } from "../lib/finalizeSession.js";
import { getSession } from "../lib/session-store.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body;
        console.log(`🛑 END SESSION REQUESTED FOR TARGET INSTANCE ID: ${sessionId}`);

        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Missing sessionId" });
        }

        const session = getSession(sessionId);
        if (session) {
            // 🌟 SET THE BILLING CLOCK START RIGHT HERE (Only when Decart stream went live)
            // This ensures you don't bill the user for the 2-5 seconds spent setting up WebRTC
            session.createdAt = Date.now();
        }

        const summary = await finalizeSession(sessionId, "manual", false);
        const balanceResponse = summary && typeof summary.remainingSeconds !== 'undefined'
            ? summary.remainingSeconds
            : 0;

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