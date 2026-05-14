import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// ========================================
// AUTH
// ========================================

router.post('/', async (req, res) => {

    try {

        const {
            type,
            email,
            password
        } = req.body;

        // ====================================
        // LOGIN ONLY
        // ====================================

        if (type !== 'login') {

            return res.json({
                success: false
            });
        }

        // ====================================
        // SUPABASE LOGIN
        // ====================================

        const {
            data,
            error
        } = await supabase.auth
            .signInWithPassword({
                email,
                password
            });

        if (error || !data.session) {

            console.log(
                'AUTH ERROR:',
                error?.message
            );

            return res.json({
                success: false
            });
        }

        const userId =
            data.user.id;

        // ====================================
        // GET USER RECORD
        // ====================================

        const {
            data: user,
            error: userError
        } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !user) {

            console.log(
                'USER FETCH ERROR:',
                userError?.message
            );

            return res.json({
                success: false
            });
        }

        // ====================================
        // BANNED CHECK
        // ====================================

        if (user.is_banned) {

            return res.json({
                success: false,
                banned: true
            });
        }

        // ====================================
        // RESPONSE
        // ====================================

        return res.json({

            success: true,

            token:
                data.session.access_token,

            user: {
                id:
                    user.id,

                name:
                    user.name || "",

                seconds:
                    user.remaining_seconds
            }
        });

    } catch (err) {

        console.log(
            'AUTH ERROR:',
            err.message
        );

        return res.json({
            success: false
        });
    }
});

export default router;