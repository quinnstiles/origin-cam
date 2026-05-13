import express from "express";
import { supabase } from "../lib/supabase.js";
import { endSession, getSession } from "../lib/sessions.js";

const router = express.Router();

const GRACE_TIME_SECONDS = 10;

router.post("/", async (req, res) => {

    try {

        const { token, sessionId } = req.body;

        if (!token || !sessionId) {
            return res.json({ success: false });
        }

        // =====================================
        // VERIFY USER TOKEN
        // =====================================

        const { data, error } =
            await supabase.auth.getUser(token);

        if (error || !data?.user) {
            return res.json({ success: false });
        }

        const userId = data.user.id;

        // =====================================
        // GET SESSION
        // =====================================

        const session = getSession(sessionId);

        if (!session) {
            return res.json({
                success: false,
                reason: "session_not_found"
            });
        }

        // =====================================
        // FINALIZE SERVER SESSION
        // =====================================

        const ended = endSession(sessionId);

        if (!ended) {
            return res.json({ success: false });
        }

        // =====================================
        // BILLING CALCULATION (SERVER TRUTH)
        // =====================================

        let usedSeconds = ended.usedSeconds || 0;

        // apply grace rule
        usedSeconds = Math.max(
            0,
            usedSeconds - GRACE_TIME_SECONDS
        );

        // =====================================
        // GET USER FROM DB
        // =====================================

        const { data: profile } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();

        if (!profile) {
            return res.json({ success: false });
        }

        // =====================================
        // UPDATE REMAINING TIME
        // =====================================

        const remaining =
            Math.max(
                0,
                (profile.remaining_seconds || 0) - usedSeconds
            );

        await supabase
            .from("users")
            .update({
                remaining_seconds: remaining
            })
            .eq("id", userId);

        // =====================================
        // RESPONSE TO CLIENT
        // =====================================

        return res.json({

            success: true,

            used_seconds: usedSeconds,

            remaining_seconds: remaining
        });

    } catch (err) {

        console.log("END SESSION ERROR:", err);

        return res.json({
            success: false
        });
    }
});

export default router;