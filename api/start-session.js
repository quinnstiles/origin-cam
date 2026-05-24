import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession, clearUserSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🚀 AUTHORITATIVE START SESSION HIT");

        const { token, duration_limit_sec } = req.body;
        if (!token) {
            return res.json({ success: "false", message: "Missing authorization token." });
        }

        // ====================================
        // 1. AUTHENTICATE USER WITH SUPABASE JWT
        // ====================================
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.log("❌ Token authentication rejected:", authError?.message);
            return res.json({ success: "false", message: "Unauthorized token status." });
        }
        const userId = user.id;

        // ====================================
        // 2. FORCE CLEAN SLATE (NO MORE HANGING AWAITS)
        // ====================================
        const existingSession = getUserSession(userId);

        if (existingSession) {
            console.log(`⚠️ Conflict detected for user ${userId}. Active session ID: ${existingSession.sessionId}`);

            finalizeSession(existingSession.sessionId, "manual", false)
                .then(() => console.log(`🔄 Background auto-cleanup of ${existingSession.sessionId} finished.`))
                .catch(err => console.log(`⚠️ Background cleanup notice:`, err.message));

            clearUserSession(userId);
        }

        // ====================================
        // 3. FETCH & VERIFY BALANCE FROM DATABASE
        // ====================================
        const { data: dbUser, error: dbError } = await supabase
            .from("users")
            .select("remaining_seconds, status")
            .eq("id", userId)
            .single();

        if (dbError || !dbUser) {
            console.log("❌ Database balance lookup failed:", dbError?.message);
            return res.json({ success: "false", message: "Could not fetch user billing data." });
        }

        // 🌟 CHECK 1: Verify account status is active
        if (dbUser.status !== true && dbUser.status !== "true") {
            console.log(`🚫 Denied user ${userId}: Account is restricted/blocked.`);
            return res.json({ success: "false", message: "Account already exists or restricted email, please use another email." });
        }

        const dbSeconds = Number(dbUser.remaining_seconds || 0);
        const graceSeconds = Number(process.env.SESSION_GRACE_SECONDS || 5);

        // 🌟 CHECK 2: Minimum 10-Second Balance Gate
        if (dbSeconds <= 10) {
            console.log(`❌ Denied user ${userId}: Insufficient balance for initialization (${dbSeconds}s available).`);
            return res.json({
                success: "false",
                message: `Cannot start session. A minimum of 11 seconds is required to initialize Origin-Cam AI. (You have ${dbSeconds}s)`
            });
        }

        const targetedDurationCeiling = duration_limit_sec ? Number(duration_limit_sec) : dbSeconds;

        // ====================================
        // 4. REQUEST DECART CLIENT TOKEN
        // ====================================
        if (!process.env.DECART_API_KEY) {
            console.log("❌ CRITICAL CONFIG ERROR: DECART_API_KEY environment variable is missing.");
            return res.json({ success: "false", message: "Server configuration error: Missing infrastructure keys." });
        }

        console.log(`🧠 Requesting Decart token with dynamic duration: ${targetedDurationCeiling}s`);

        let decartJson;
        try {
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

            decartJson = await decartResponse.json();

            if (!decartResponse.ok || !decartJson?.apiKey) {
                console.log("❌ Decart provider rejected request:", decartJson);
                return res.json({ success: "false", message: "External AI stream token allocation rejected." });
            }
        } catch (fetchErr) {
            console.log("❌ DECART NETWORK TIMEOUT OR FAILURE:", fetchErr.message);
            // 🌟 PREVENTS APP HANG: Immediately sends a response back to C++ if the external API is unreachable
            return res.json({ success: "false", message: "Network connection timeout to AI model broker." });
        }

        // ====================================
        // 5. MEMORY STATE REGISTRATION
        // ====================================
        const sessionId = `session_${Date.now()}`;

        const newSession = {
            sessionId: sessionId,
            userId: userId,
            createdAt: Date.now(),
            lastHeartbeat: Date.now(),
            dbSeconds: dbSeconds,
            graceSeconds: graceSeconds,
            timeoutHandle: null
        };

        const totalAllowedMs = (newSession.dbSeconds + newSession.graceSeconds) * 1000;

        newSession.timeoutHandle = setTimeout(async () => {
            console.log(`🚨 CRASH DETECTED: Session ${newSession.sessionId} went dark for ${newSession.dbSeconds}s.`);
            await finalizeSession(newSession.sessionId, "timeout", false);
        }, totalAllowedMs);

        createSession(newSession);

        // ====================================
        // 6. RETURN TO BRIDGE
        // ====================================
        console.log(`✅ Session ${sessionId} generated successfully.`);

        return res.json({
            success: "true",
            sessionId: sessionId,
            decartToken: decartJson.apiKey,
            remainingSeconds: dbSeconds
        });

    } catch (err) {
        console.log("❌ START SESSION ERROR:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

export default router;