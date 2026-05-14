import express from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {

    try {

        console.log("🔥 RAW BODY:", req.body);

        const { token, secondsUsed } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Missing token"
            });
        }

        // =====================================
        // EXTRACT USER ID FROM JWT
        // =====================================
        const decoded = jwt.decode(token);

        const userId = decoded?.sub;

        if (!userId) {
            console.log("❌ Invalid token payload");
            return res.status(400).json({
                success: false,
                message: "Invalid token"
            });
        }

        console.log("👤 USER ID:", userId);

        // =====================================
        // GET USER
        // =====================================
        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();

        if (error || !user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        console.log("💰 BEFORE:", user.remaining_seconds);

        // =====================================
        // DEBIT 20 SECONDS
        // =====================================
        const before = user.remaining_seconds;
        const debited = 20;
        const after = Math.max(0, before - debited);

        const { error: updateError } = await supabase
            .from("users")
            .update({
                remaining_seconds: after
            })
            .eq("id", userId);

        if (updateError) {
            console.log("❌ DB ERROR:", updateError.message);

            return res.status(500).json({
                success: false,
                message: "DB update failed"
            });
        }

        console.log("💰 DEBIT SUCCESS", {
            before,
            debited,
            after
        });

        return res.json({
            success: true,
            before,
            debited,
            after
        });

    } catch (err) {
        console.log("❌ END SESSION ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

export default router;