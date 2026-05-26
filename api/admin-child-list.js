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
        // VERIFY JWT
        // =====================================================
        const {
            data: { user },
            error: authError
        } =
            await supabaseAdmin
                .auth
                .getUser(token);

        console.log(
            "🧠 VERIFY USER:",
            user?.email
        );

        console.log(
            "🧠 VERIFY ERROR:",
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
        // VERIFY ADMIN TABLE
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
            "❌ VERIFY ADMIN FAILURE:",
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
   FETCH ALL USERS
========================================================= */
router.get(
    "/list",
    verifyAdminAccess,
    async (req, res) => {

        try {

            const signature =
                req.query.signature;

            console.log(
                "📥 FETCH USERS SIGNATURE:",
                signature
            );

            // =================================================
            // VALIDATION
            // =================================================
            if (!signature) {

                return res.json({
                    success: "false",
                    message:
                        "Missing signature parameter."
                });
            }

            // =================================================
            // FETCH USERS
            // =================================================
            const {
                data,
                error
            } =
                await supabaseAdmin
                    .from("users")
                    .select("*")
                    .eq(
                        "signature",
                        "origin"
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            console.log(
                "🧠 USERS FOUND:",
                data?.length
            );

            console.log(
                "🧠 FETCH ERROR:",
                error
            );

            if (error) {

                throw error;
            }

            return res.json({
                success: "true",
                total:
                    data?.length || 0,
                data:
                    data || []
            });

        } catch (err) {

            console.error(
                "❌ FETCH USERS FAILURE:",
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