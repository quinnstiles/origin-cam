import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🟢 FALLBACK START SESSION HIT");

        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Missing token" });
        }

        // 1. Authenticate user with Supabase
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ success: false, message: "Unauthorized token" });
        }

        // 2. Request token straight from Decart (Hardcoded fallback duration, e.g., 1 hour)
        const decartResponse = await fetch("https://api.decart.ai/v1/client/tokens", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.DECART_API_KEY
            },
            body: JSON.stringify({
                expiresIn: 3600, // 1 hour flat
                allowedModels: ["lucy-2"]
            })
        });

        const decartJson = await decartResponse.json();
        console.log("🧠 DECART RESPONSE:", decartJson);

        if (!decartResponse.ok || !decartJson?.apiKey) {
            return res.status(500).json({ success: false, message: "Failed creating Decart token" });
        }

        // 3. Hand token back to Node
        return res.json({
            success: true,
            decartToken: decartJson.apiKey
        });

    } catch (err) {
        console.log("❌ FALLBACK START SESSION ERROR:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;