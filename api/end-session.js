import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        // ================================
        // HARD CODE TEST USER
        // ================================
        const userId = "47db905a-6207-4b7c-bd4e-84842e000477";
        const debitAmount = 20;

        // ================================
        // GET USER FIRST (VERIFY EXISTS)
        // ================================
        const { data: user, error: getError } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", userId)
            .single();

        if (getError || !user) {
            console.log("❌ USER NOT FOUND:", getError?.message);
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // ================================
        // CALCULATE NEW VALUE
        // ================================
        const current = user.remaining_seconds || 0;
        const updated = Math.max(0, current - debitAmount);

        // ================================
        // UPDATE USER
        // ================================
        const { data: updateData, error: updateError } = await supabase
            .from("users")
            .update({
                remaining_seconds: updated,
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

        console.log("💰 DEBIT SUCCESS:", {
            userId,
            before: current,
            debited: debitAmount,
            after: updated
        });

        return res.json({
            success: true,
            userId,
            before: current,
            debited: debitAmount,
            after: updated,
            db: updateData
        });

    } catch (err) {
        console.log("❌ SERVER ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
});

export default router;