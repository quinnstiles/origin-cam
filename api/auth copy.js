import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// ========================================
// AUTH GATEWAY (WITH BRAND SIGNATURE CHECK)
// ========================================
router.post('/', async (req, res) => {
    try {
        const {
            type,
            email,
            password,
            signature // 🌟 NEW: Passed directly from hardcoded C++ configuration
        } = req.body;

        // ====================================
        // LOGIN TYPE EXCLUSIVITY CHECK
        // ====================================
        if (type !== 'login') {
            return res.json({ success: false, reason: "invalid_type" });
        }

        // Validate incoming payload metadata before burning Supabase request quotas
        if (!signature || typeof signature !== 'string') {
            return res.json({ success: false, reason: "missing_signature" });
        }

        // ====================================
        // SUPABASE AUTHENTICATION (RLS LAYER PASS)
        // ====================================
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.session) {
            console.log('AUTH ERROR:', error?.message);
            return res.json({ success: false, reason: "auth_failed" });
        }

        const userId = data.user.id;

        // ====================================
        // SCOPED PUBLIC USER RECORD ASSIGNMENT
        // ====================================
        // Supabase client uses the logged-in user context to bypass standard RLS restrictions safely
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            console.log('USER FETCH ERROR:', userError?.message);
            // If the record metadata fetch fails, forcefully signs out the active session immediately
            await supabase.auth.signOut();
            return res.json({ success: false, reason: "user_record_not_found" });
        }

        // ====================================
        // SECURITY GATE 1: BANNED/RESTRICTED STATUS CHECK
        // ====================================
        if (user.is_banned || user.status === false) {
            console.log(`🔒 ACCESS DENIED: Account ${email} is explicitly restricted.`);
            await supabase.auth.signOut();
            return res.json({ success: false, reason: "account_restricted" });
        }

        // ====================================
        // SECURITY GATE 2: SIGNATURE / COMPATIBILITY VERIFICATION
        // ====================================
        // Prevents users from utilizing account profiles registered on alternative white-label panels
        if (user.signature !== signature) {
            console.log(`🔒 BRAND MISMATCH: User signature '${user.signature}' does not match client payload '${signature}'`);
            await supabase.auth.signOut(); // Hard sever the newly created auth session
            return res.json({ success: false, reason: "platform_mismatch" });
        }

        // ====================================
        // RESPONSE (ALL CLEARANCES VERIFIED)
        // ====================================
        return res.json({
            success: true,
            token: data.session.access_token,
            user: {
                id: user.id,
                name: user.name || "",
                seconds: user.remaining_seconds
            }
        });

    } catch (err) {
        console.log('SYSTEM FAULT IN AUTH ROUTE:', err.message);
        return res.json({ success: false, reason: "server_error" });
    }
});

export default router;