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

            // Explicitly cast to Numbers to prevent string concatenation bugs
            const dbSecs = Number(existingSession.dbSeconds || 0);
            const graceSecs = Number(existingSession.graceSeconds || 0);
            const createdAtMs = Number(existingSession.createdAt);

            // Your exact logic: convert total duration to milliseconds
            const totalAllowedDurationMs = (dbSecs + graceSecs) * 1000;
            const absoluteExpirationTime = createdAtMs + totalAllowedDurationMs;

            if (now < absoluteExpirationTime) {
                // Legitimate Active Session: The duration hasn't passed yet.
                // Strict Protection: Block duplicate/concurrent streaming attempts.
                return res.status(400).json({
                    success: false,
                    message: "Active session already running. Close current session first."
                });
            } else {
                // Long Dead Session: Time has completely passed!
                console.log(`🧹 Stale session ${existingSession.sessionId} exceeded its lifespan. Auto-finalizing ledger.`);
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

        const dbSeconds = Number(dbUser.remaining_seconds || 0);

        // 🛠️ FIX: Read dynamically from .env and cast to an intentional Number (Fallback to 15 if missing)
        const graceSeconds = Number(process.env.SESSION_GRACE_SECONDS || 5);

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
            graceSeconds // Now accurately saving the dynamic environment variable value
        };

        createSession(newSession);

        // ====================================
        // 6. AUTHORITATIVE SERVER-SIDE TIMEOUT
        // ====================================
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