import dotenv from 'dotenv';
dotenv.config();

import ws from 'ws';

import {
    createClient
} from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        realtime: {
            transport: ws
        }
    }
);

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {

        const { token } = req.body;

        if (!token) {
            return res.status(401).json({
                success: false
            });
        }

        // ====================================
        // VALIDATE TOKEN
        // ====================================

        const {
            data: { user },
            error
        } =
            await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                success: false
            });
        }

        // ====================================
        // GET PROFILE
        // ====================================

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from('profiles')
                .select(`
                full_name,
                remaining_seconds
            `)
                .eq('id', user.id)
                .single();

        if (profileError || !profile) {
            return res.status(404).json({
                success: false
            });
        }

        return res.status(200).json({
            success: true,
            user: profile.full_name,
            seconds:
                profile.remaining_seconds
        });

    }
    catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false
        });
    }
}