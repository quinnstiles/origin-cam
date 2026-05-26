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
                success: false,
                message:
                    "Missing authorization token."
            });
        }

        const token =
            authHeader.split(" ")[1];

        // =====================================================
        // VERIFY USER
        // =====================================================
        const {
            data: adminProfiles,
            error: adminError
        } =
            await supabaseAdmin
                .from("admin")
                .select("*")
                .eq(
                    "signature",
                    "origin"
                );

        console.log(
            "🧠 TOKEN:",
            token?.slice(0, 40)
        );

        console.log(
            "🧠 VERIFY USER:",
            user?.email
        );

        console.log(
            "🧠 VERIFY ERROR:",
            authError
        );

        if (!token) {

            return res.status(401).json({
                success: false,
                message:
                    "Missing authentication token."
            });
        }

        if (
            authError ||
            !data ||
            !user
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid authentication token."
            });
        }

        // =====================================================
        // VERIFY ADMIN EXISTS
        // =====================================================
        const {
            data: adminProfiles,
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
                );

        console.log(
            "🧠 ADMIN PROFILES:",
            adminProfiles
        );

        console.log(
            "🧠 ADMIN ERROR:",
            adminError
        );

        if (
            adminError ||
            !adminProfiles ||
            adminProfiles.length === 0
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "invalid admin"
            });
        }

        req.admin =
            adminProfiles[0];

        next();

    } catch (err) {

        console.error(
            "❌ VERIFY ADMIN FAILURE:",
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
   AUTH STATE
========================================================= */
router.get(
    "/auth-state",
    verifyAdminAccess,
    async (req, res) => {

        return res.json({
            success: true,
            admin: req.admin
        });
    }
);

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

            if (!signature) {

                return res.json({
                    success: false,
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
                    .select(`
                        id,
                        email,
                        name,
                        remaining_seconds,
                        created_at,
                        updated_at,
                        signature,
                        status
                    `)
                    .eq(
                        "signature",
                        signature.trim()
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
                "🧠 USERS DATA:",
                data
            );

            console.log(
                "🧠 FETCH ERROR:",
                error
            );

            if (error) {
                throw error;
            }

            return res.json({
                success: true,
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
                success: false,
                message:
                    err.message
            });
        }
    }
);

export default router;