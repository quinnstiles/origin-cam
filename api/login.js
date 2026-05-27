import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// =========================================================
// LOGIN
// =========================================================
router.post("/", async (req, res) => {

    try {

        console.log("🔑 LOGIN REQUEST");

        const {
            email,
            password,
            signature
        } = req.body;

        if (
            !email ||
            !password ||
            !signature
        ) {

            return res.json({
                success: "false",
                message:
                    "Email, password, and signature are required."
            });
        }

        // =====================================================
        // AUTH LOGIN
        // =====================================================
        const {
            data: authData,
            error: authError
        } =
            await supabase.auth.signInWithPassword({
                email,
                password
            });

        if (
            authError ||
            !authData?.user
        ) {

            console.log(
                "❌ LOGIN FAILED:",
                authError?.message
            );

            return res.json({
                success: "false",
                message:
                    "Invalid email or password."
            });
        }

        const userId =
            authData.user.id;

        // =====================================================
        // VERIFY USERS TABLE
        // =====================================================
        const {
            data: dbUser,
            error: dbError
        } =
            await supabase
                .from("users")
                .select(`
                    id,
                    status,
                    signature
                `)
                .eq("id", userId)
                .maybeSingle();

        if (
            dbError ||
            !dbUser
        ) {

            console.log(
                "❌ USER PROFILE NOT FOUND"
            );

            return res.json({
                success: "false",
                message:
                    "User profile not found."
            });
        }

        // =====================================================
        // STATUS VALIDATION
        // =====================================================
        if (
            dbUser.status !== true
        ) {

            return res.json({
                success: "false",
                message:
                    "Your account has been blocked."
            });
        }

        // =====================================================
        // SIGNATURE VALIDATION
        // =====================================================
        if (
            dbUser.signature !== signature
        ) {

            return res.json({
                success: "false",
                message:
                    "Application signature mismatch."
            });
        }

        // =====================================================
        // SUCCESS
        // =====================================================
        return res.json({
            success: "true",
            message:
                "Login successful.",
            session:
                authData.session
        });

    } catch (err) {

        console.error(
            "❌ LOGIN ERROR:",
            err
        );

        return res.json({
            success: "false",
            message:
                err.message
        });
    }
});

// =========================================================
// LOGOUT
// =========================================================
router.post(
    "/logout",
    async (req, res) => {

        try {

            return res.json({
                success: "true",
                message:
                    "Logged out successfully."
            });

        } catch (err) {

            return res.json({
                success: "false",
                message:
                    err.message
            });
        }
    }
);

// =========================================================
// FORGOT PASSWORD
// =========================================================
router.post(
    "/forgot-password",
    async (req, res) => {

        try {

            const { email } =
                req.body;

            if (!email) {

                return res.json({
                    success: "false",
                    message:
                        "Email required."
                });
            }

            const {
                error
            } =
                await supabase.auth
                    .resetPasswordForEmail(
                        email
                    );

            if (error) {

                return res.json({
                    success: "false",
                    message:
                        error.message
                });
            }

            return res.json({
                success: "true",
                message:
                    "Password reset email sent."
            });

        } catch (err) {

            return res.json({
                success: "false",
                message:
                    err.message
            });
        }
    }
);

export default router;