import express from 'express';
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

        const userId = "temporary-user";

        // ========================================
        // DB TIME (seconds from DB)
        // ========================================
        const dbSeconds = 99999;

        if (dbSeconds <= 0) {
            return res.status(403).json({
                success: false,
                message: 'No remaining time'
            });
        }

        // ========================================
        // GRACE TIME (SECONDS → MS LATER)
        // NOTE: 10 = 10 seconds (NOT ms)
        // ========================================
        const graceSeconds = 10;

        const sessionDuration = dbSeconds + graceSeconds;

        const sessionId = `session_${Date.now()}`;

        createSession({
            sessionId,
            userId,
            dbSeconds,
            graceSeconds,
            sessionDuration
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
            decartToken: decartApiKey,
            userId
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