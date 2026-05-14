import express from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../lib/supabase.js";

const router = express.Router();
console.log("🔥 END SESSION ROUTE ACTIVE");


router.post("/", async (req, res) => {

    console.log("🔥 END SESSION HIT");
    console.log("🔥 RAW BODY:", req.body);

    const { token, secondsUsed } = req.body || {};

    console.log("🔑 TOKEN EXISTS:", !!token);

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

        console.log("👤 DECODED USER ID:", userId);

    } catch (e) {
        console.log("❌ TOKEN DECODE FAILED");
    }

    if (!userId) {
        console.log("❌ STILL NO USER ID");
        return res.status(400).json({
            success: false,
            message: "No userId extracted"
        });
    }

    return res.json({
        success: true,
        userId
    });
});

export default router;