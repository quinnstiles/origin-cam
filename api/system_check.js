import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { signature, version } = req.body;

        if (!signature || version === undefined) {
            return res.json({
                supported: "false", // 🌟 WRAPPED IN QUOTES FOR C++ PARSER
                message: "Missing version validation parameters."
            });
        }

        // Query the table using your exact column name containing the space
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

        // Rule 1: Version signature entry doesn't exist
        if (!record) {
            return res.json({
                supported: "false", // 🌟 WRAPPED IN QUOTES
                message: "This version is no longer supported."
            });
        }

        // Rule 2: Version is explicitly disabled
        if (record.version_state === false) {
            return res.json({
                supported: "false", // 🌟 WRAPPED IN QUOTES
                message: "This version is no longer supported."
            });
        }

        // Success Clearance Barrier Passed
        return res.json({
            supported: "true", // 🌟 WRAPPED IN QUOTES: Matches ExtractString expectation perfectly
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