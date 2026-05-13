import express from 'express';

const router = express.Router();

// ========================================
// END SESSION
// ========================================

router.post('/', async (req, res) => {

    try {

        return res.json({
            success: true,
            remaining_seconds: 0,
            used_seconds: 0
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;