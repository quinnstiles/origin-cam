import express from "express";
import { supabaseAdmin } from "../lib/supabase.js";

const router = express.Router();

/* =========================================================
   ADMIN LOGIN
========================================================= */
router.post("/login", async (req, res) => {

    try {

        const {
            email,
            password,
            signature
        } = req.body;

        console.log(
            "📥 ADMIN LOGIN REQUEST:",
            {
                email,
                signature
            }
        );

        // =====================================================
        // VALIDATION
        // =====================================================
        if (
            !email ||
            !password ||
            !signature
        ) {

            return res.json({
                success: false,
                message:
                    "Email, password and signature are required."
            });
        }

        const normalizedEmail =
            email
                .trim()
                .toLowerCase();

        const normalizedSignature =
            signature
                .trim()
                .toLowerCase();

        // =====================================================
        // LOGIN
        // =====================================================
        const {
            data: authData,
            error: authError
        } =
            await supabaseAdmin.auth.signInWithPassword({
                email: normalizedEmail,
                password
            });

        console.log(
            "🧠 AUTH USER:",
            authData?.user?.email
        );

        console.log(
            "🧠 AUTH ERROR:",
            authError
        );

        if (
            authError ||
            !authData?.session
        ) {

            return res.json({
                success: false,
                message:
                    authError?.message ||
                    "Authentication failed."
            });
        }

        // =====================================================
        // VERIFY ADMIN
        // =====================================================
        const {
            data: adminProfile,
            error: adminError
        } =
            await supabaseAdmin
                .from("admin")
                .select("*")
                .eq(
                    "email",
                    normalizedEmail
                )
                .eq(
                    "signature",
                    normalizedSignature
                )
                .single();

        console.log(
            "🧠 ADMIN PROFILE:",
            adminProfile
        );

        console.log(
            "🧠 ADMIN ERROR:",
            adminError
        );

        if (
            adminError ||
            !adminProfile
        ) {

            return res.json({
                success: false,
                message:
                    "invalid admin"
            });
        }

        // =====================================================
        // SUCCESS
        // =====================================================
        return res.json({

            success: true,

            access_token:
                authData.session.access_token,

            refresh_token:
                authData.session.refresh_token,

            session:
                authData.session,

            adminProfile

        });

    } catch (err) {

        console.error(
            "❌ ADMIN LOGIN FAILURE:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                err.message
        });
    }
});

export default router;