import express from "express";
import { finalizeSession } from "../lib/finalizeSession.js";
// Import your token authentication middleware here as well

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const userId = req.user.id;

        console.log(`🛑 END SESSION REQUESTED BY USER: ${userId}`);

        // Securely finalize and capture the remaining balance!
        const remainingSeconds = await finalizeSession(userId, "manual", true);

        return res.json({
            success: true,
            message: "Session closed successfully",
            remainingSeconds: remainingSeconds !== null ? remainingSeconds : 0
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;