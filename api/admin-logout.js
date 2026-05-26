import express from "express";
import { supabaseAdmin } from "../lib/supabase.js";

const router = express.Router();

/* =========================================================
   VERIFY ADMIN ACCESS
========================================================= */
async function verifyAdminAccess(req, res, next) {

    try {

        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return res.status(401).json({
                success: "false",
                message:
                    "Missing authorization token."
            });
        }

        const token =
            authHeader.split(" ")[1];

        // =====================================================
        // VERIFY TOKEN
        // =====================================================
        const {
            data: { user },
            error: authError
        } =
            await supabaseAdmin
                .auth
                .getUser(token);

        console.log(
            "🧠 LOGOUT VERIFY USER:",
            user?.email
        );

        console.log(
            "🧠 LOGOUT VERIFY ERROR:",
            authError
        );

        if (
            authError ||
            !user
        ) {

            return res.status(401).json({
                success: "false",
                message:
                    "Invalid authentication token."
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
                    user.email
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
                success: "false",
                message:
                    "invalid admin"
            });
        }

        req.admin =
            adminProfile;

        next();

    } catch (err) {

        console.error(
            "❌ LOGOUT VERIFY FAILURE:",
            err
        );

        return res.status(500).json({
            success: "false",
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

            return res.json({
                success: "true",
                message:
                    "Admin logged out successfully."
            });

        } catch (err) {

            console.error(
                "❌ ADMIN LOGOUT FAILURE:",
                err
            );

            return res.status(500).json({
                success: "false",
                message:
                    err.message
            });
        }
    }
);

export default router;