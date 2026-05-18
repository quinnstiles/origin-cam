import express from "express";
import { supabase } from "../lib/supabase.js";
import { getUserSession, createSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🟢 AUTHORITATIVE START SESSION HIT");

        const { token } = req.body; // C++ / Node passes the User auth token
        if (!token) {
            return res.status(400).json({ success: false, message: "Missing token" });
        }

        // ====================================
        // 1. AUTHENTICATE & GET USER ID
        // ====================================
        // Replace this with your exact JWT decoding/Supabase auth verification logic
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ success: false, message: "Unauthorized token" });
        }
        const userId = user.id;

        // ====================================
        // 2. AUTHORITATIVE SESSION CONFLICT CHECK
        // ====================================
        const existingSession = getUserSession(userId);

        if (existingSession) {
            const now = Date.now();
            const totalAllowedDuration = (existingSession.dbSeconds + existingSession.graceSeconds) * 1000;
            const absoluteExpirationTime = existingSession.createdAt + totalAllowedDuration;

            if (now < absoluteExpirationTime) {
                // Session is legitimately active. Reject new concurrency.
                return res.status(400).json({
                    success: false,
                    message: "Active session already running. Close current session first."
                });
            } else {
                // Session is stale! Force a clean finalization to update DB and clear memory
                console.log(`🧹 Stale session ${existingSession.sessionId} found during startup. Auto-finalizing.`);
                await finalizeSession(existingSession.sessionId, "timeout");
            }
        }

        // ====================================
        // 3. FETCH & VERIFY BALANCE FROM DATABASE
        // ====================================
        const { data: dbUser, error: dbError } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", userId)
            .single();

        if (dbError || !dbUser) {
            return res.status(500).json({ success: false, message: "Could not fetch user billing data" });
        }

        const dbSeconds = dbUser.remaining_seconds;
        const graceSeconds = 15; // 15-second server grace allowance for spin-up

        if (dbSeconds <= 0) {
            return res.status(403).json({ success: false, message: "Insufficient balance. Please recharge." });
        }

        // ====================================
        // 4. REQUEST DECART CLIENT TOKEN
        // ====================================
        // Rule: Decart only receives dbSeconds. Never add graceSeconds here.
        const decartResponse = await fetch("https://api.decart.ai/v1/client/tokens", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.DECART_API_KEY
            },
            body: JSON.stringify({
                expiresIn: dbSeconds, // Authoritative Decart cutoff
                allowedModels: ["lucy-2"]
            })
        });

        const decartJson = await decartResponse.json();
        console.log("🧠 DECART RESPONSE:", decartJson);

        if (!decartResponse.ok || !decartJson?.apiKey) {
            return res.status(500).json({ success: false, message: "Failed creating Decart token" });
        }

        // ====================================
        // 5. MEMORY STATE REGISTRATION
        // ====================================
        const sessionId = `session_${Date.now()}`;

        const newSession = {
            sessionId,
            userId,
            createdAt: Date.now(),
            dbSeconds,
            graceSeconds
        };

        createSession(newSession);

        // ====================================
        // 6. AUTHORITATIVE SERVER-SIDE TIMEOUT
        // ====================================
        // The server acts as the executioner if the client vanishes or stays connected too long.
        const serverTimeoutDuration = (dbSeconds + graceSeconds) * 1000;
        setTimeout(async () => {
            console.log(`⏰ Server-side absolute timeout reached for session: ${sessionId}`);
            await finalizeSession(sessionId, "timeout");
        }, serverTimeoutDuration);

        // ====================================
        // 7. RETURN TO UNTRUSTED NODE/C++
        // ====================================
        return res.json({
            success: true,
            sessionId,
            sessionDuration: dbSeconds,
            decartToken: decartJson.apiKey
        });

    } catch (err) {
        console.log("❌ START SESSION ERROR:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;