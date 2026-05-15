import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

console.log("🔥 END SESSION ROUTE ACTIVE");

router.post("/", async (req, res) => {

    console.log("🔥 END SESSION HIT");
    console.log("🔥 RAW BODY:", req.body);

    const { token } = req.body || {};

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "Missing token"
        });
    }

    let userId;

    try {
        const payload = JSON.parse(
            Buffer.from(token.split(".")[1], "base64").toString()
        );

        userId = payload.sub;

        console.log("👤 USER ID:", userId);

    } catch (e) {
        console.log("❌ TOKEN DECODE FAILED");
        return res.status(400).json({
            success: false,
            message: "Invalid token"
        });
    }

    // =========================================
    // GET USER
    // =========================================
    const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

    if (error || !user) {
        console.log("❌ USER NOT FOUND");
        return res.status(404).json({
            success: false,
            message: "User not found"
        });
    }

    console.log("💰 BEFORE:", user.remaining_seconds);

    // =========================================
    // DEBIT 20 SECONDS
    // =========================================
    const debited = 20;

    const after = Math.max(
        0,
        user.remaining_seconds - debited
    );

    const { error: updateError } = await supabase
        .from("users")
        .update({
            remaining_seconds: after
        })
        .eq("id", userId);

    if (updateError) {
        console.log("❌ UPDATE FAILED:", updateError.message);

        return res.status(500).json({
            success: false,
            message: "DB update failed"
        });
    }

    console.log("💰 DEBIT SUCCESS:", {
        before: user.remaining_seconds,
        debited,
        after
    });

    return res.json({
        success: true,
        before: user.remaining_seconds,
        debited,
        after
    });
});

export default router;