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
        // =========================
        // AUTH
        // =========================

        const token =
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'No token'
            });
        }

        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                error: 'Invalid token'
            });
        }

        const userId = user.id;

        // =========================
        // GET ACTIVE SESSION
        // =========================

        const {
            data: session,
            error: sessionError
        } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

        if (sessionError || !session) {
            return res.status(404).json({
                error: 'No active session'
            });
        }

        // =========================
        // CALCULATE USED TIME
        // =========================

        const now = Date.now();

        const startTime =
            new Date(session.start_time).getTime();

        let usedSeconds =
            Math.floor((now - startTime) / 1000);

        // safety cap
        if (usedSeconds < 0)
            usedSeconds = 0;

        if (
            session.max_duration_seconds &&
            usedSeconds > session.max_duration_seconds
        ) {
            usedSeconds =
                session.max_duration_seconds;
        }

        // =========================
        // GET PROFILE
        // =========================

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from('profiles')
            .select(`
                remaining_seconds,
                total_used_seconds
            `)
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({
                error: 'Profile not found'
            });
        }

        // =========================
        // CALCULATE NEW BALANCE
        // =========================

        let newRemaining =
            session.remaining_at_start -
            usedSeconds;

        if (newRemaining < 0)
            newRemaining = 0;

        const expired =
            newRemaining <= 0;

        // =========================
        // UPDATE SESSION
        // =========================

        await supabase
            .from('sessions')
            .update({
                status: 'ended',
                end_time: new Date(now).toISOString(),
                used_seconds: usedSeconds,
                heartbeat_at: new Date(now).toISOString()
            })
            .eq('id', session.id);

        // =========================
        // UPDATE PROFILE
        // =========================

        await supabase
            .from('profiles')
            .update({
                remaining_seconds: newRemaining,

                total_used_seconds:
                    profile.total_used_seconds +
                    usedSeconds
            })
            .eq('id', userId);

        // =========================
        // RESPONSE
        // =========================

        return res.status(200).json({
            success: true,
            used_seconds: usedSeconds,
            remaining_seconds: newRemaining,
            expired
        });
    }
    catch (err) {
        console.error(
            'END SESSION ERROR:',
            err
        );

        return res.status(500).json({
            error: err.message
        });
    }
}