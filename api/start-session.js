import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession } from "../lib/sessions.js";
import crypto from "crypto";

const router = express.Router();

const GRACE_TIME_SECONDS = 10;

router.post("/", async (req, res) => {

    try {

        const { token } = req.body;

        if (!token) {
            return res.json({ success: false });
        }

        // =====================================
        // VERIFY USER (Supabase JWT)
        // =====================================

        const { data, error } =
            await supabase.auth.getUser(token);

        if (error || !data?.user) {
            return res.json({ success: false });
        }

        const user = data.user;

        // =====================================
        // GENERATE SERVER SESSION ID
        // =====================================

        const sessionId = crypto.randomUUID();

        // =====================================
        // CREATE SERVER SESSION
        // =====================================

        createSession(sessionId, {
            userId: user.id
        });

        // =====================================
        // RETURN SESSION TO CLIENT
        // =====================================

        return res.json({

            success: true,

            sessionId,

            grace_time: GRACE_TIME_SECONDS,

            message: "session started"
        });

    } catch (err) {

        console.log("START SESSION ERROR:", err);

        return res.json({
            success: false
        });
    }
});

export default router;