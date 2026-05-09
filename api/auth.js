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
    const { type, email, password, name } = req.body;

    if (!type || !email || !password) {
        return res.status(400).json({ error: "Missing fields" });
    }

    // ================= REGISTER =========
    if (type === "register") {
        if (!name) {
            return res.status(400).json({ error: "Name required" });
        }

        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true   // 🔥 THIS IS THE FIX
        });

        if (error) return res.status(400).json({ error: error.message });

        // 🔥 create profile row
        await supabase.from("profiles").insert({
            id: data.user.id,
            full_name: name,
        });

        return res.json({ success: true });
    }

    // ================= LOGIN =================
    if (type === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) return res.status(400).json({ error: error.message });

        const token = jwt.sign(
            { user_id: data.user.id },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return res.json({ token });
    }
}