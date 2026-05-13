import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

router.post('/', async (req, res) => {

    try {

        const { type, email, password } = req.body;

        if (type !== 'login') {
            return res.json({
                success: false
            });
        }

        // =====================================
        // LOGIN WITH SUPABASE
        // =====================================

        const { data, error } =
            await supabase.auth.signInWithPassword({
                email,
                password
            });

        if (error || !data.session) {
            return res.json({
                success: false
            });
        }

        const userId = data.user.id;

        // =====================================
        // GET PROFILE FROM USERS TABLE
        // =====================================

        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (!profile) {
            return res.json({
                success: false
            });
        }

        // =====================================
        // RETURN EXACT C++ FORMAT
        // =====================================

        return res.json({

            success: true,

            token: data.session.access_token,

            profile: {
                id: profile.id,
                name: profile.name || "",
                seconds: profile.remaining_seconds
            }
        });

    } catch (err) {

        console.log("AUTH ERROR:", err);

        return res.json({
            success: false
        });
    }
});

export default router;