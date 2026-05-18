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
        // 2. AUTHORITATIVE SESSION CONFLICT CHECK (SERIALIZED CLEANUP)
        // ====================================
        const existingSession = getUserSession(userId);

        if (existingSession) {
            const now = Date.now();
            const totalAllowedDuration = (existingSession.dbSeconds + existingSession.graceSeconds) * 1000;
            const absoluteExpirationTime = existingSession.createdAt + totalAllowedDuration;

            if (now < absoluteExpirationTime) {
                // Force-finalize the active session and CRITICAL: await it!
                // This forces Node/Server to wait until the DB write and memory clear are 100% complete.
                console.log(`🔄 Active session ${existingSession.sessionId} interrupted by new start request. Force-finalizing sequentially.`);
                await finalizeSession(existingSession.sessionId, "manual");
            } else {
                // Session is stale! Clean it up completely before moving forward
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
            graceSeconds,
            timerId: null // We will populate this in a moment
        };

        // ====================================
        // 6. AUTHORITATIVE SERVER-SIDE TIMEOUT
        // ====================================
        const serverTimeoutDuration = (dbSeconds + graceSeconds) * 1000;

        setTimeout(async () => {
            // Check the authoritative memory map right as the timer wakes up
            const sessionVerification = getSession(sessionId);

            if (!sessionVerification) {
                console.log(`⏰ Stale safety timer woke up for ${sessionId}, but session is already long dead. Ignoring duty.`);
                return;
            }

            console.log(`⏰ Server-side absolute timeout reached for active session: ${sessionId}`);
            await finalizeSession(sessionId, "timeout");
        }, serverTimeoutDuration);

        createSession(newSession);

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