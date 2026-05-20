import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession, getSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🚀 AUTHORITATIVE START SESSION HIT");

        const { token } = req.body; // Passed up from Node / C++
        if (!token) {
            return res.status(400).json({ success: false, message: "Missing token" });
        }

        // ====================================
        // 1. AUTHENTICATE USER WITH SUPABASE JWT
        // ====================================
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.log("❌ Token authentication rejected:", authError?.message);
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
                // Force-finalize the active session and await it!
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
        // 💡 Note: Using your authoritative schema query ('profiles' and 'seconds')
        const { data: profile, error: dbError } = await supabase
            .from("profiles")
            .select("seconds")
            .eq("id", userId)
            .single();

        if (dbError || !profile) {
            console.log("❌ Profile balance lookup failed:", dbError?.message);
            return res.status(500).json({ success: false, message: "Could not fetch user billing data" });
        }

        const dbSeconds = Number(profile.seconds || 0);
        const graceSeconds = Number(process.env.SESSION_GRACE_SECONDS || 5);

        if (dbSeconds <= 0) {
            console.log(`❌ Denied user ${userId}: Insufficient balance (${dbSeconds}s available).`);
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
                expiresIn: Math.max(60, dbSeconds), // Keep safe minimum floor boundary
                allowedModels: ["lucy-2"]
            })
        });

        const decartJson = await decartResponse.json();
        if (!decartResponse.ok || !decartJson?.apiKey) {
            console.log("❌ Decart token generation failed:", decartJson);
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
            lastHeartbeat: Date.now(),
            dbSeconds,
            graceSeconds
        };

        createSession(newSession);

        // ====================================
        // 6. AUTHORITATIVE TIMEOUT (SELF-AWARE SAFETY NET)
        // ====================================
        const serverTimeoutDuration = (dbSeconds + graceSeconds) * 1000;

        setTimeout(async () => {
            try {
                const verifySession = getSession(sessionId);

                if (!verifySession) {
                    console.log(`⏰ Safety timer woke up for ${sessionId}, but it was already closed. Ignoring task.`);
                    return;
                }

                console.log(`⏰ Server absolute cutoff limit reached for active session: ${sessionId}`);
                await finalizeSession(sessionId, "timeout", false);
            } catch (timeoutErr) {
                console.log(`❌ ERROR INSIDE TIMEOUT HANDLER FOR ${sessionId}:`, timeoutErr.message);
            }
        }, serverTimeoutDuration);

        // ====================================
        // 7. RETURN TO BACKUP BRIDGE.JS EXPLICIT LAYOUT
        // ====================================
        console.log(`✅ Session ${sessionId} generated successfully. Returning credentials.`);

        return res.json({
            success: true,
            sessionId: sessionId,
            decartToken: decartJson.apiKey,
            remainingSeconds: dbSeconds // Structural key expected by backup bridge.js
        });

    } catch (err) {
        console.log("❌ START SESSION ERROR:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;