import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { userId } = req.body;

        console.log("🔥 END SESSION:", userId);

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

        const before = user.remaining_seconds;
        const after = Math.max(0, before - 20);

        const { error: updateError } = await supabase
            .from("users")
            .update({
                remaining_seconds: after
            })
            .eq("id", userId);

        if (updateError) {
            return res.status(500).json({
                success: false,
                message: updateError.message
            });
        }

        console.log("💰 DEBIT OK:", { before, after });

        return res.json({
            success: true,
            before,
            debited: 20,
            after
        });

    } catch (e) {
        console.log("CRASH:", e.message);

        return res.status(500).json({
            success: false
        });
    }
});

export default router;