import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession, getSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🟢 AUTHORITATIVE START SESSION HIT");

        // BACKWARDS COMPATIBLE payloads to match your working version
        let token = null;
        if (req.body.token) {
            token = req.body.token; // Prioritize original JSON body payload
        } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }

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
            const totalAllowedDuration = (existingSession.dbSeconds + existingSession.graceSeconds) * 1000;
            const absoluteExpirationTime = existingSession.createdAt + totalAllowedDuration;

            // pass strictly by sessionId to perfectly align with your reversed finalizer
            if (now < absoluteExpirationTime) {
                console.log(`🔄 Active session ${existingSession.sessionId} interrupted. Force-finalizing sequentially.`);
                await finalizeSession(existingSession.sessionId, "manual");
            } else {
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
        const graceSeconds = Number(process.env.SESSION_GRACE_SECONDS || 5);

        if (dbSeconds <= 0) {
            return res.status(403).json({ success: false, message: "Insufficient balance. Please recharge." });
        }

        // ====================================
        // 4. REQUEST DECART CLIENT TOKEN
        // ====================================
        const decartResponse = await fetch("https://api.decart.ai/v1/client/tokens", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.DECART_API_KEY
            },
            body: JSON.stringify({
                expiresIn: dbSeconds,
                allowedModels: ["lucy-2"]
            })
        });

        const decartJson = await decartResponse.json();
        console.log("🧠 DECART RESPONSE:", decartJson);

        if (!decartResponse.ok || !decartJson?.apiKey) {
            return res.status(500).json({ success: false, message: "Failed creating Decart token" });
        }

        // ====================================
        // MEMORY STATE REGISTRATION
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
        // AUTHORITATIVE TIMEOUT (SAFETY NET)
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
                await finalizeSession(sessionId, "timeout");
            } catch (timeoutErr) {
                console.log(`❌ ERROR INSIDE TIMEOUT HANDLER FOR ${sessionId}:`, timeoutErr.message);
            }
        }, serverTimeoutDuration);

        // ====================================
        // 7. RETURN TO UNTRUSTED NODE/C++
        // ====================================
        return res.json({
            success: true,
            sessionId,
            sessionDuration: dbSeconds,
            decartToken: decartJson.apiKey // Keep the exact clean property name Node expects!
        });

    } catch (err) {
        console.log("❌ START SESSION ERROR:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;