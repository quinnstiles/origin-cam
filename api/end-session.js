import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {

    console.log("🔥 RAW BODY:", req.body);

    const { userId } = req.body || {};

    if (!userId) {
        console.log("❌ Missing userId");
        return res.status(400).json({
            success: false,
            message: "Missing userId"
        });
    }

    console.log("🔥 END SESSION:", userId);

    return res.json({
        success: true,
        message: "received",
        userId
    });
});

export default router;