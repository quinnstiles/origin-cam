import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession, getSession, clearUserSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🚀 AUTHORITATIVE START SESSION HIT");

        const { token, duration_limit_sec } = req.body;
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
        // 2. FORCE CLEAN SLATE (NO MORE HANGING AWAITS)
        // ====================================
        const existingSession = getUserSession(userId);

        if (existingSession) {
            console.log(`⚠️ Conflict detected for user ${userId}. Active session ID: ${existingSession.sessionId}`);

            // 🌟 CRITICAL FIX 1: Run finalize in the background without blocking the response thread
            finalizeSession(existingSession.sessionId, "manual", false)
                .then(() => console.log(`🔄 Background auto-cleanup of ${existingSession.sessionId} finished.`))
                .catch(err => console.log(`⚠️ Background cleanup notice:`, err.message));

            // 🌟 CRITICAL FIX 2: Explicitly wipe the map instantly so memory is 100% clear right now
            clearUserSession(userId);
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
            console.log("❌ Database balance lookup failed:", dbError?.message);
            return res.status(500).json({ success: false, message: "Could not fetch user billing data" });
        }

        const dbSeconds = Number(dbUser.remaining_seconds || 0);
        const graceSeconds = Number(process.env.SESSION_GRACE_SECONDS || 5);

        if (dbSeconds < 10) {
            console.log(`❌ Denied user ${userId}: Insufficient balance for initialization (${dbSeconds}s available).`);
            return res.status(403).json({
                success: false,
                message: `Insufficient balance. A minimum of 10 seconds is required to initialize. You have ${dbSeconds}s.`
            });
        }

        const targetedDurationCeiling = duration_limit_sec ? Number(duration_limit_sec) : dbSeconds;

        // ====================================
        // 4. REQUEST DECART CLIENT TOKEN
        // ====================================
        console.log(`🧠 Requesting Decart token with dynamic duration: ${targetedDurationCeiling}s`);
        const decartResponse = await fetch("https://api.decart.ai/v1/client/tokens", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.DECART_API_KEY
            },
            body: JSON.stringify({
                expiresIn: Math.max(300, targetedDurationCeiling),
                allowedModels: ["lucy-2"],
                constraints: {
                    realtime: {
                        maxSessionDuration: targetedDurationCeiling
                    }
                }
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

        // INSIDE YOUR /api/start-session ROUTE HANDLER:

        const newSession = {
            sessionId: `session_${Date.now()}`,
            userId: req.body.userId,
            createdAt: Date.now(),
            lastHeartbeat: Date.now(),
            dbSeconds: userBalance,
            graceSeconds: 5,
            timeoutHandle: null // 🌟 1. Establish the register property
        };

        const totalAllowedMs = (newSession.dbSeconds + newSession.graceSeconds) * 1000;

        // 🌟 2. Assign the timeout loop handle directly to the object configuration
        newSession.timeoutHandle = setTimeout(async () => {
            console.log(`🚨 CRASH DETECTED: Session ${newSession.sessionId} went dark for ${newSession.dbSeconds}s.`);
            await finalizeSession(newSession.sessionId, "timeout", false);
        }, totalAllowedMs);

        // 🌟 3. Commit to memory store with the live timer handle attached
        createSession(newSession);

        // ====================================
        // 7. RETURN TO BRIDGE
        // ====================================
        console.log(`✅ Session ${sessionId} generated successfully.`);

        return res.json({
            success: true,
            sessionId: sessionId,
            decartToken: decartJson.apiKey,
            remainingSeconds: dbSeconds
        });

    } catch (err) {
        console.log("❌ START SESSION ERROR:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;