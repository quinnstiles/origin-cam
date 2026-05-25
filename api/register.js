import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("📝 REGISTRATION REQUEST RECEIVED");

        const { email, password, name, signature } = req.body;

        // 1. Basic validation check
        if (!email || !password || !name || !signature) {
            return res.json({
                success: "false",
                message: "All fields (email, password, name, signature) are required."
            });
        }

        // =========================================================
        // 2. CREATE THE USER IN SUPABASE AUTH (ADMIN BYPASS MODE)
        // =========================================================
        // We use admin.createUser so the user is instantly confirmed 
        // without forcing an email verification loop during testing.
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto-confirming the email address
            user_metadata: { display_name: name }
        });

        if (authError) {
            console.log("❌ Supabase Auth engine creation rejected:", authError.message);

            // Check if error is due to an existing account conflict
            if (authError.message.toLowerCase().includes("already exists") || authError.status === 422) {
                return res.json({
                    success: "false",
                    message: "account already exist or restricted email, please use another email"
                });
            }

            return res.json({
                success: "false",
                message: authError.message
            });
        }

        const authId = authData.user.id;
        console.log(`🔑 Auth Account generated successfully. UID: ${authId}`);

        // =========================================================
        // 3. SYNC CREDENTIAL DETAILS TO YOUR PUBLIC USERS TABLE
        // =========================================================
        const { error: dbError } = await supabase
            .from("users")
            .insert([
                {
                    id: authId,                       // Primary Key linking back to Auth User UUID
                    email: email,
                    name: name,
                    signature: signature,
                    remaining_seconds: 0,
                }
            ]);

        if (dbError) {
            console.error("❌ Profile table synchronization failed:", dbError.message);

            // Rollback auth creation if public entry injection fails to prevent ghost profiles
            await supabase.auth.admin.deleteUser(authId);

            return res.json({
                success: "false",
                message: "Failed to allocate local profile structure database tables."
            });
        }

        // =========================================================
        // 4. SIGN THE USER IN TO GENERATE WEBSITES COMPATIBLE JWT
        // =========================================================
        // Now that the structural tables are mapped, log them in to fetch the token assets
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (loginError) {
            // Account is built, but token acquisition had an infrastructure slip
            return res.json({
                success: "true",
                message: "Account registered successfully! Please log in manually.",
                session: null
            });
        }

        // Return successful registration details along with active session data
        console.log(`🎯 Registration pipeline completely unified for ${email}`);
        return res.json({
            success: "true",
            message: "Registration completed successfully.",
            session: loginData.session // 🌟 Pass this straight to your website frontend storage!
        });

    } catch (err) {
        console.error("❌ UNCAUGHT EXCEPTION IN REGISTRATION ROUTE:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

export default router;