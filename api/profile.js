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

        const { token } = req.body;

        if (!token) {
            res.writeHead(401, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                success: true
            }));

            return;
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
            res.writeHead(401, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                success: true
            }));

            return;
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

            res.writeHead(404, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                success: false
            }));

            return;
        }

        res.writeHead(200, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            success: true,
            user: profile.full_name,
            seconds:
                profile.remaining_seconds
        }));

        return;

    }
    catch (err) {

        console.error(err);

        res.writeHead(500, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            error: err.message
        }));

        return;
    }
}