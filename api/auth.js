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

        const {
            type,
            email,
            password,
            name
        } = req.body;

        if (!type || !email || !password) {
            res.writeHead(400, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                error: 'Missing fields'
            }));

            return;
        }

        // ====================================
        // REGISTER
        // ====================================

        if (type === 'register') {

            if (!name) {
                res.writeHead(400, {
                    'Content-Type': 'application/json'
                });

                res.end(JSON.stringify({
                    error: 'Missing fields'
                }));

                return;
            }

            const {
                data,
                error
            } =
                await supabase.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true
                });

            if (error) {
                res.writeHead(400, {
                    'Content-Type': 'application/json'
                });

                res.end(JSON.stringify({
                    error: 'Missing fields'
                }));

                return;
            }

            // create profile
            await supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    full_name: name,
                    remaining_seconds: 0,
                    total_used_seconds: 0
                });

            res.writeHead(200, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                success: true
            }));

            return;
        }

        // ====================================
        // LOGIN
        // ====================================

        if (type === 'login') {

            const {
                data,
                error
            } =
                await supabase.auth.signInWithPassword({
                    email,
                    password
                });

            if (error || !data.session) {
                res.writeHead(401, {
                    'Content-Type': 'application/json'
                });

                res.end(JSON.stringify({
                    error: 'Invalid login'
                }));

                return;
            }

            const user = data.user;

            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from('profiles')
                    .select(`
                    id,
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
                    error: 'Profile not found'
                }));

                return;

            }

            res.writeHead(200, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({

                sessionToken:
                    data.session.access_token,

                profile: {
                    id: profile.id,
                    name: profile.full_name || '',
                    seconds:
                        profile.remaining_seconds
                }
            }));

            return;
        }

        res.writeHead(400, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            error: 'Missing fields'
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