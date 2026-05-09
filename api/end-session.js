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
        res.writeHead(405, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            error: 'Method not allowed'
        }));

        return;

    }

    try {
        // =========================
        // AUTH
        // =========================

        const token =
            req.headers.authorization?.split(' ')[1];

        if (!token) {

            res.writeHead(401, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                error: 'No token'
            }));

            return;
            res.writeHead(401, {
                'Content-Type': 'application/json'
            });

            return;
        }

        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser(token);

        if (authError || !user) {
            res.writeHead(401, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                error: 'Invalid token'
            }));

            return;

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

            res.writeHead(404, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                error: 'No active session'
            }));

            return;
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

            res.writeHead(404, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                error: 'Profile not found'
            }));

            return;
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

        res.writeHead(200, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            success: true,
            used_seconds: usedSeconds,
            remaining_seconds: newRemaining,
            expired
        }));

        return;
    }
    catch (err) {
        console.error(
            'END SESSION ERROR:',
            err
        );

        res.writeHead(500, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            error: err.message
        }));

        return;
    }
}