import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// 🌟 NEW: Lightweight Keep-Alive & Wake-Up Endpoint
// Bypasses database logic entirely to respond instantly once the container boots.
router.get('/', (req, res) => {
    return res.json({ status: "online", message: "Render instance is awake." });
});

// Existing POST validation rule pipeline...
router.post('/', async (req, res) => {
    try {
        const { signature, version } = req.body;

        if (!signature || version === undefined) {
            return res.json({
                supported: "false",
                message: "Missing version validation parameters."
            });
        }

        const { data: record, error } = await supabase
            .from('system_version_control')
            .select('*')
            .eq('signature_version_name', signature)
            .eq('version_ release', parseFloat(version))
            .maybeSingle();

        if (error) {
            console.error('DATABASE VERSION ERROR:', error.message);
            return res.json({
                supported: "false",
                message: "Server verification error. Please try again."
            });
        }

        if (!record || record.version_state === false) {
            return res.json({
                supported: "false",
                message: "This version is no longer supported."
            });
        }

        return res.json({
            supported: "true",
            message: "Success"
        });

    } catch (err) {
        console.error('SYSTEM FAULT IN CHECK ROUTE:', err.message);
        return res.json({
            supported: "false",
            message: "Critical server error processing system verification."
        });
    }
});

export default router;