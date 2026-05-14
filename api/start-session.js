import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Missing auth token"
            });
        }

        const userId = "temporary-user";

        const total_seconds = 99999;
        const remaining_seconds_before = total_seconds;

        const sessionId = crypto.randomUUID();

        // 🔥 CREATE SESSION IN DB (THIS WAS MISSING)
        const { data, error } = await supabase
            .from("sessions")
            .insert({
                id: sessionId,
                user_id: userId,
                status: "starting",
                total_seconds,
                used_seconds: 0,
                remaining_seconds_before,
                started_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.log("DB insert error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Failed to create session"
            });
        }

        const decartApiKey = process.env.DECART_API_KEY;

        return res.json({
            success: true,
            sessionId,
            decartToken: decartApiKey,
            userId
        });

    } catch (err) {
        console.log("START SESSION ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

export default router;