import express from 'express';

const router = express.Router();

// ========================================
// START SESSION
// ========================================

router.post('/', async (req, res) => {

    try {

        const { token } = req.body;

        // ====================================
        // VALIDATE LOGIN TOKEN
        // ====================================

        if (!token) {

            return res.status(401).json({
                success: false,
                message: 'Missing auth token'
            });
        }

        // ====================================
        // TODO:
        // VERIFY SUPABASE USER HERE
        // ====================================

        // temporary accepted user

        const userId =
            'temporary-user';

        // ====================================
        // TODO:
        // CHECK REMAINING SECONDS
        // ====================================

        const remainingSeconds = 99999;

        if (remainingSeconds <= 0) {

            return res.status(403).json({
                success: false,
                message: 'No remaining time'
            });
        }

        // ====================================
        // CREATE INTERNAL SESSION
        // ====================================

        const sessionId =
            `session_${Date.now()}`;

        // ====================================
        // REAL DECart API KEY
        // ====================================

        const decartApiKey =
            process.env.DECART_API_KEY;

        if (!decartApiKey) {

            return res.status(500).json({
                success: false,
                message: 'Missing DECart API key'
            });
        }

        // ====================================
        // RESPONSE
        // ====================================

        return res.json({
            success: true,

            sessionId,

            decartToken:
                decartApiKey,

            userId
        });

    } catch (err) {

        console.log(
            'START SESSION ERROR:',
            err.message
        );

        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

export default router;