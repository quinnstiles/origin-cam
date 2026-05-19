import express from "express";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body; // Back to your original payload format

        console.log(`🛑 END SESSION HIT FOR: ${sessionId}`);

        // Finalize and capture the remaining balance
        const remainingSeconds = await finalizeSession(sessionId, "manual");

        return res.json({
            success: true,
            message: "Session closed successfully",
            remainingSeconds: remainingSeconds
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;