import express from "express";
import { finalizeSession } from "../lib/finalizeSession.js";
// Import your token authentication middleware here as well

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        // 🔒 AUTHORITATIVE EXTRACTION (Get userId from secure request auth token, not body!)
        const userId = req.user.id;

        console.log(`🛑 END SESSION REQUESTED BY USER: ${userId}`);

        // Finalize by userId securely!
        await finalizeSession(userId, "manual", true);

        return res.json({ success: true, message: "Session closed successfully" });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;