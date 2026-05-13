import express from 'express';

const router = express.Router();

// ========================================
// START SESSION
// ========================================

router.post('/', async (req, res) => {

    try {

        const { token } = req.body;

        if (!token) {

            return res.status(401).json({
                success: false,
                message: 'Missing token'
            });
        }

        return res.json({
            success: true,

            token,

            sessionId:
                `session_${Date.now()}`
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;