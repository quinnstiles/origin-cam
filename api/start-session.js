import express from "express";
import { createSession } from "../lib/sessionStore.js";

const router = express.Router();

router.post('/', async (req, res) => {

    try {

        const { token } = req.body;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Missing auth token'
            });
        }

        // ========================================
        // REAL USER ID FROM TOKEN (DO NOT HARDCODE)
        // ========================================
        let userId;

        try {
            const payload = JSON.parse(
                Buffer.from(token.split('.')[1], 'base64').toString()
            );

            userId = payload.sub;

        } catch (e) {
            return res.status(400).json({
                success: false,
                message: 'Invalid token'
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing userId'
            });
        }

        // ========================================
        // DB TIME (replace later with Supabase)
        // ========================================
        const dbSeconds = 99999;

        if (dbSeconds <= 0) {
            return res.status(403).json({
                success: false,
                message: 'No remaining time'
            });
        }

        // ========================================
        // GRACE TIME (SECONDS)
        // ========================================
        const graceSeconds = 10;

        const sessionId = `session_${Date.now()}`;

        createSession({
            sessionId,
            userId,
            dbSeconds,
            graceSeconds
        });

        const decartApiKey = process.env.DECART_API_KEY;

        if (!decartApiKey) {
            return res.status(500).json({
                success: false,
                message: 'Missing DECart API key'
            });
        }

        return res.json({
            success: true,
            sessionId,
            decartToken: process.env.DECART_API_KEY
        });



    } catch (err) {
        console.log('START SESSION ERROR:', err.message);

        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

export default router;