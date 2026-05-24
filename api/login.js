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
            await supabase.auth.admin.signOut(authData.session.access_token);
            return res.json({ success: "false", message: "User workspace configuration profile not found." });
        }

        // 🌟 CRITICAL ENFORCEMENT GATE: Verify status state and application signatures
        if (dbUser.status !== true || dbUser.status === "false") {
            console.log(`🚫 ACCESS DENIED: Account for ${email} is explicitly blocked or restricted.`);
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

        console.log(`🎯 Successful authentication match verified for: ${email}`);
        return res.json({
            success: "true",
            message: "Login successful.",
            session: authData.session
        });

    } catch (err) {
        console.error("❌ CRITICAL LOGIN ROUTE EXCEPTION:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

// =========================================================
// 🔒 ENDPOINT 3: GLOBAL LOGOUT ENGINE
// =========================================================
router.post("/logout", async (req, res) => {
    try {
        console.log("🔒 LOGOUT REQUEST RECEIVED");
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.json({ success: "false", message: "Active access token is required to log out." });
        }

        // Invalidate the session token on Supabase's auth service completely
        const { error } = await supabase.auth.admin.signOut(accessToken);

        if (error) {
            console.log("⚠️ Supabase engine logout warning:", error.message);
            // We continue anyway so the frontend can clear its local caches regardless
        }

        console.log("✅ Session token revoked successfully.");
        return res.json({
            success: "true",
            message: "Logged out successfully."
        });

    } catch (err) {
        console.error("❌ LOGOUT ROUTE EXCEPTION:", err.message);
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