import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// ========================================
// SYSTEM VERSION CONTROL GATEWAY
// ========================================
router.post('/', async (req, res) => {
    try {
        const { signature, version } = req.body;

        // Ensure incoming payload has required properties
        if (!signature || version === undefined) {
            return res.json({
                supported: false,
                message: "Missing version validation parameters."
            });
        }

        // Query the public version control matrix table
        const { data: record, error } = await supabase
            .from('system_version_control')
            .select('*')
            .eq('signature_version_name', signature)
            .eq('version_ release', parseFloat(version)) // Matches numeric data type mapping
            .maybeSingle();

        if (error) {
            console.error('DATABASE VERSION ERROR:', error.message);
            return res.json({
                supported: false,
                message: "Server verification error. Please try again."
            });
        }

        // Rule 1: If the signature + version combination doesn't exist in the DB
        if (!record) {
            return res.json({
                supported: false,
                message: "This version is no longer supported."
            });
        }

        // Rule 2: If the record exists, but version_state is explicitly turned off (false)
        if (record.version_state === false) {
            return res.json({
                supported: false,
                message: "This version is no longer supported."
            });
        }

        // All clearance barriers passed successfully
        return res.json({ supported: true });

    } catch (err) {
        console.error('SYSTEM FAULT IN CHECK ROUTE:', err.message);
        return res.json({
            supported: false,
            message: "Critical server error processing system verification."
        });
    }
});

export default router;