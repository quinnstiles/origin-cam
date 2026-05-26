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

        console.log("📥 ADMIN LOGIN REQUEST:", {
            email,
            signature
        });

        // =====================================================
        // VALIDATION
        // =====================================================
        if (
            !email ||
            !password ||
            !signature
        ) {

            return res.json({
                success: "false",
                message:
                    "Email, password and signature are required."
            });
        }

        // =====================================================
        // LOGIN
        // =====================================================
        const {
            data: authData,
            error: authError
        } =
            await supabaseAdmin.auth.signInWithPassword({
                email,
                password
            });

        console.log(
            "🧠 AUTH LOGIN:",
            authData
        );

        console.log(
            "🧠 AUTH ERROR:",
            authError
        );

        if (authError) {

            return res.json({
                success: "false",
                message:
                    authError.message
            });
        }

        // =====================================================
        // VERIFY ADMIN
        // =====================================================
        const normalizedEmail =
            email
                .trim()
                .toLowerCase();

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
                    signature
                )
                .maybeSingle();

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
                success: "false",
                message:
                    "invalid admin"
            });
        }

        // =====================================================
        // FETCH ADMIN USER ROW
        // =====================================================
        const {
            data: adminUser,
            error: adminUserError
        } =
            await supabaseAdmin
                .from("users")
                .select("*")
                .eq(
                    "email",
                    normalizedEmail
                )
                .eq(
                    "signature",
                    signature
                )
                .maybeSingle();

        console.log(
            "🧠 ADMIN USER:",
            adminUser
        );

        console.log(
            "🧠 ADMIN USER ERROR:",
            adminUserError
        );

        return res.json({
            success: "true",

            access_token:
                authData.session.access_token,

            refresh_token:
                authData.session.refresh_token,

            session:
                authData.session,

            adminProfile,

            adminUser
        });

    } catch (err) {

        console.error(
            "❌ ADMIN LOGIN FAILURE:",
            err
        );

        return res.json({
            success: "false",
            message:
                err.message
        });
    }
});

export default router;