import express from "express";
import { supabaseAdmin } from "../lib/supabase.js";

const router = express.Router();

/* =========================================================
   VERIFY ADMIN ACCESS
========================================================= */
async function verifyAdminAccess(req, res, next) {

    try {

        // =====================================================
        // AUTHORIZATION HEADER
        // =====================================================
        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Missing authorization token."
            });
        }

        // =====================================================
        // ACCESS TOKEN
        // =====================================================
        const token =
            authHeader.split(" ")[1];

        if (!token) {

            return res.status(401).json({
                success: false,
                message:
                    "Missing authentication token."
            });
        }

        console.log(
            "🧠 LOGOUT TOKEN:",
            token.slice(0, 40)
        );

        // =====================================================
        // VERIFY AUTH USER
        // =====================================================
        const {
            data: authData,
            error: authError
        } =
            await supabaseAdmin
                .auth
                .getUser(token);

        console.log(
            "🧠 AUTH DATA:",
            authData
        );

        console.log(
            "🧠 AUTH ERROR:",
            authError
        );

        const user =
            authData?.user;

        console.log(
            "🧠 AUTH USER:",
            user
        );

        if (
            authError ||
            !user
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid authentication token."
            });
        }

        // =====================================================
        // NORMALIZE EMAIL
        // =====================================================
        const normalizedEmail =
            user.email
                ?.trim()
                ?.toLowerCase();

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
                    "origin"
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

            return res.status(401).json({
                success: false,
                message:
                    "invalid admin"
            });
        }

        // =====================================================
        // STORE CONTEXT
        // =====================================================
        req.admin =
            adminProfile;

        req.authUser =
            user;

        req.token =
            token;

        console.log(
            "✅ ADMIN LOGOUT VERIFY SUCCESS"
        );

        console.log(
            "================================"
        );

        next();

    } catch (err) {

        console.error(
            "❌ LOGOUT VERIFY FAILURE:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                err.message
        });
    }
}

/* =========================================================
   ADMIN LOGOUT
========================================================= */
router.post(
    "/logout",
    verifyAdminAccess,
    async (req, res) => {

        try {

            console.log(
                `👋 ADMIN LOGOUT: ${req.authUser?.email}`
            );

            // =================================================
            // IMPORTANT:
            // FRONTEND CLEARS LOCAL STORAGE.
            // SERVER DOES NOT FORCE REVOKE TOKENS.
            // =================================================

            return res.json({
                success: true,
                message:
                    "Admin logged out successfully."
            });

        } catch (err) {

            console.error(
                "❌ ADMIN LOGOUT FAILURE:",
                err
            );

            return res.status(500).json({
                success: false,
                message:
                    err.message
            });
        }
    }
);

export default router;