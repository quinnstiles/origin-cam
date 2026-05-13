import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// =====================================================
// LOGIN
// =====================================================

router.post('/', async (req, res) => {

    try {

        const {
            type,
            email,
            password
        } = req.body;

        // =============================================
        // VALIDATE
        // =============================================

        if (type !== 'login') {

            return res.status(400).json({
                success: false,
                message: 'Invalid request type'
            });
        }

        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message: 'Missing credentials'
            });
        }

        // =============================================
        // AUTH CLIENT
        // =============================================

        const authClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // =============================================
        // LOGIN
        // =============================================

        const {
            data,
            error
        } = await authClient.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.user || !data.session) {

            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // =============================================
        // GET USER PROFILE
        // =============================================

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError || !profile) {

            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }

        // =============================================
        // SUCCESS RESPONSE
        // IMPORTANT:
        // MATCH C++ EXPECTATION EXACTLY
        // =============================================

        return res.json({

            success: true,

            token:
                data.session.access_token,

            profile: {

                id:
                    profile.id,

                name:
                    profile.name || '',

                email:
                    profile.email,

                seconds:
                    profile.remaining_seconds
            }
        });

    } catch (err) {

        console.error(
            'AUTH ERROR:',
            err
        );

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

export default router;