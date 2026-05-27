import express from "express";
import { supabaseAdmin } from "../lib/supabase.js";

const router = express.Router();

/* =========================================================
   ADMIN LOGIN
========================================================= */
router.post(
    "/login",
    async (req, res) => {

        try {

            // =================================================
            // REQUEST BODY
            // =================================================
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

            // =================================================
            // VALIDATION
            // =================================================
            if (
                !email ||
                !password ||
                !signature
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Email, password and signature are required."
                });
            }

            // =================================================
            // NORMALIZE INPUTS
            // =================================================
            const normalizedEmail =
                email
                    .trim()
                    .toLowerCase();

            const normalizedSignature =
                signature
                    .trim()
                    .toLowerCase();

            // =================================================
            // AUTHENTICATE ADMIN
            // =================================================
            const {
                data: authData,
                error: authError
            } =
                await supabaseAdmin
                    .auth
                    .signInWithPassword({
                        email:
                            normalizedEmail,
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

                return res.status(401).json({
                    success: false,
                    message:
                        authError?.message ||
                        "Authentication failed."
                });
            }

            // =================================================
            // VERIFY ADMIN RECORD
            // =================================================
            const {
                data: adminProfile,
                error: adminError
            } =
                await supabaseAdmin
                    .from("admin")
                    .select(`
                        id,
                        email,
                        signature,
                        created_at,
                        payment_instruction
                    `)
                    .eq(
                        "email",
                        normalizedEmail
                    )
                    .eq(
                        "signature",
                        normalizedSignature
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

            // =================================================
            // INVALID ADMIN
            // =================================================
            if (
                adminError ||
                !adminProfile
            ) {

                return res.status(401).json({
                    success: false,
                    message:
                        "invalid admin"
                });
            }

            // =================================================
            // TOKENS
            // =================================================
            const accessToken =
                authData.session.access_token;

            const refreshToken =
                authData.session.refresh_token;

            // =================================================
            // SUCCESS
            // =================================================
            console.log(
                `✅ ADMIN LOGIN SUCCESS: ${normalizedEmail}`
            );

            return res.json({

                success: true,

                access_token:
                    accessToken,

                refresh_token:
                    refreshToken,

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
                    err.message ||
                    "Internal server error."
            });
        }
    }
);

export default router;