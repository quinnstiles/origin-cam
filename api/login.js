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
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Missing credentials' });
        }

        // =========================
        // AUTHENTICATE USER
        // =========================
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.session) {
            return res.status(401).json({ error: 'Invalid login' });
        }

        const user = data.user;
        const session = data.session;

        // =========================
        // FETCH PROFILE
        // =========================
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, remaining_seconds')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // =========================
        // RESPONSE (MATCH C++)
        // =========================
        return res.status(200).json({
            sessionToken: session.access_token, // 🔥 THIS IS YOUR JWT
            profile: {
                id: profile.id,
                name: profile.full_name || "",
                seconds: profile.remaining_seconds
            }
        });

    } catch (err) {
        console.error("LOGIN CRASH:", err);
        return res.status(500).json({ error: 'Server error' });
    }
}