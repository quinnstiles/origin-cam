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
    try {
        const { token } = req.body;

        const { data: { user }, error } =
            await supabase.auth.getUser(token);

        if (error || !user) {
            return res.json({ success: false });
        }

        const userId = user.id;

        const { data } = await supabase
            .from('profiles')
            .select('full_name, remaining_seconds')
            .eq('id', decoded.user_id)
            .single();

        return res.json({
            success: true,
            user: data.full_name,
            seconds: data.remaining_seconds
        });

    } catch {
        return res.json({ success: false });
    }
}