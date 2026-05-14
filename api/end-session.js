import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { userId } = req.body;

        // ====================================
        // VALIDATION
        // ====================================
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "Missing userId"
            });
        }

        const debitAmount = 20;

        // ====================================
        // GET USER
        // ====================================
        const { data: user, error: fetchError } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", userId)
            .single();

        if (fetchError || !user) {
            console.log("❌ USER NOT FOUND:", fetchError?.message);

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const before = user.remaining_seconds || 0;
        const after = Math.max(0, before - debitAmount);

        // ====================================
        // UPDATE USER (DEBIT)
        // ====================================
        const { data: updated, error: updateError } = await supabase
            .from("users")
            .update({
                remaining_seconds: after,
                updated_at: new Date().toISOString()
            })
            .eq("id", userId)
            .select("*");

        if (updateError) {
            console.log("❌ UPDATE FAILED:", updateError.message);

            return res.status(500).json({
                success: false,
                message: "Update failed",
                error: updateError.message
            });
        }

        console.log("💰 END SESSION DEBIT SUCCESS:", {
            userId,
            before,
            debited: debitAmount,
            after
        });

        return res.json({
            success: true,
            userId,
            before,
            debited: debitAmount,
            after
        });

    } catch (err) {
        console.log("❌ END SESSION ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
});

export default router;