import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// =========================================================
// 🔓 ENDPOINT 1: SECURE USER LOGIN & STATUS VALIDATION
// =========================================================
router.post("/login", async (req, res) => {
    try {
        console.log("🔑 LOGIN REQUEST INGRESS");
        const { email, password, signature } = req.body;

        if (!email || !password || !signature) {
            return res.json({ success: "false", message: "Email, password, and signature are required." });
        }

        // 1. Authenticate credentials against Supabase Auth core
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError || !authData.user) {
            console.log(`❌ Authentication failed for ${email}:`, authError?.message);
            return res.json({ success: "false", message: "Invalid email or password configuration." });
        }

        const userId = authData.user.id;

        // 2. Query your public users table to verify the status clearance gate
        const { data: dbUser, error: dbError } = await supabase
            .from("users")
            .select("status, signature")
            .eq("id", userId)
            .single();

        if (dbError || !dbUser) {
            console.log(`❌ Profile sync lookup error for UID ${userId}:`, dbError?.message);
            // Force fully logging out the session context from server if data structure is missing
            await supabase.auth.admin.signOut(authData.session.access_token);
            return res.json({ success: "false", message: "User workspace configuration profile not found." });
        }

        // 🌟 CRITICAL ENFORCEMENT GATE: Verify status state and application signatures
        if (dbUser.status !== true || dbUser.status === "false") {
            console.log(`🚫 ACCESS DENIED: Account for ${email} is explicitly blocked or restricted.`);

            // 🌟 FORCE LOGOUT: Instantly invalidate the token session context so they are severed completely
            await supabase.auth.admin.signOut(authData.session.access_token);

            return res.json({
                success: "false",
                message: "Your account has been restricted or blocked. Please contact support."
            });
        }

        // 3. Verify Signature Match (Ensures environment isolation cross-talk protection)
        if (dbUser.signature !== signature) {
            console.log(`⚠️ Signature mismatch for ${email}. Expected: ${dbUser.signature}, Got: ${signature}`);
            await supabase.auth.admin.signOut(authData.session.access_token);
            return res.json({ success: "false", message: "Application platform signature verification failed." });
        }

        // Success: Account clear, passed checks, fully authenticated for RLS context access
        console.log(`🎯 Successful authentication match verified for: ${email}`);
        return res.json({
            success: "true",
            message: "Login successful.",
            session: authData.session // Pass this directly to website storage or desktop cache
        });

    } catch (err) {
        console.error("❌ CRITICAL LOGIN ROUTE EXCEPTION:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

// =========================================================
// 📨 ENDPOINT 2: FORGOT PASSWORD RESET DISPATCHER
// =========================================================
router.post("/forgot-password", async (req, res) => {
    try {
        console.log("📨 FORGOT PASSWORD REQUESTED");
        const { email } = req.body;

        if (!email) {
            return res.json({ success: "false", message: "Email address is required." });
        }

        // Initialize Supabase password recovery reset email pipeline flow
        // The redirection URL points back to your deployed production website domain recovery view
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: "https://your-origin-cam-website.com/update-password",
        });

        if (resetError) {
            console.log(`❌ Password recovery invitation creation failed for ${email}:`, resetError.message);
            return res.json({ success: "false", message: resetError.message });
        }

        console.log(`✅ Recovery instruction assets dispatched successfully towards: ${email}`);
        return res.json({
            success: "true",
            message: "A password reset link has been successfully sent to your email address."
        });

    } catch (err) {
        console.error("❌ FORGOT PASSWORD EXCEPTION:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

export default router;