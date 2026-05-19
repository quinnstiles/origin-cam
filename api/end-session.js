import express from "express";
import { supabase } from "../lib/supabase.js";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        // ====================================
        // SECURE TOKEN EXTRACTION & VALIDATION
        // ====================================
        let token = null;
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.body.token) {
            token = req.body.token;
        }

        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized: Missing Token" });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ success: false, message: "Invalid or expired token" });
        }

        const userId = user.id;
        console.log(`🛑 END SESSION REQUESTED BY USER: ${userId}`);

        // Securely finalize and capture the remaining balance
        const remainingSeconds = await finalizeSession(userId, "manual", true);

        return res.json({
            success: true,
            message: "Session closed successfully",
            remainingSeconds: remainingSeconds !== null ? remainingSeconds : 0
        });
    } catch (err) {
        console.log("❌ END SESSION ROUTE ERROR:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;