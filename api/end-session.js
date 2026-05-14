import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

router.post('/', async (req, res) => {

    try {

        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Missing sessionId'
            });
        }

        console.log("🔥 END SESSION TRIGGERED:", sessionId);

        // ====================================
        // HARD TEST UPDATE (NO LOGIC)
        // ====================================
        const { data, error } = await supabase
            .from('sessions')
            .update({
                billed_seconds: 20,
                ended_at: Date.now(),
                status: 'closed'
            })
            .eq('id', sessionId)
            .select();

        if (error) {
            console.log("❌ SUPABASE UPDATE FAILED:", error.message);

            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        console.log("✅ DB UPDATED SUCCESSFULLY:", data);

        return res.json({
            success: true,
            billedSeconds: 20,
            sessionId
        });

    } catch (err) {

        console.log("END SESSION ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

export default router;