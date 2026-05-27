import express from "express";
import {
    supabaseAdmin,
    supabaseAuth
} from "../lib/supabase.js";

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
            "🧠 VERIFY TOKEN:",
            token.slice(0, 40)
        );

        // =====================================================
        // VERIFY SUPABASE USER
        // =====================================================
        const {
            data: authData,
            error: authError
        } =
            await supabaseAuth.auth.getUser(token)

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
        // VERIFY ADMIN EXISTS
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
        // STORE ADMIN
        // =====================================================
        req.admin =
            adminProfile;

        req.token =
            token;

        req.authUser =
            user;

        console.log(
            "✅ VERIFY ADMIN ACCESS SUCCESS"
        );

        console.log(
            "================================"
        );

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
            admin:
                req.admin
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

            // =================================================
            // SIGNATURE
            // =================================================
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

                return res.status(400).json({
                    success: false,
                    message:
                        "Missing signature parameter."
                });
            }

            // =================================================
            // NORMALIZE SIGNATURE
            // =================================================
            const normalizedSignature =
                signature
                    .trim()
                    .toLowerCase();

            console.log(
                "🧠 NORMALIZED SIGNATURE:",
                normalizedSignature
            );

            // =================================================
            // FETCH USERS
            // =================================================
            const {
                data: users,
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
                        normalizedSignature
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            console.log(
                "🧠 USERS FOUND:",
                users?.length || 0
            );

            console.log(
                "🧠 USERS ERROR:",
                error
            );

            if (error) {

                throw error;
            }

            // =================================================
            // SUCCESS
            // =================================================
            return res.json({
                success: true,
                total:
                    users?.length || 0,
                data:
                    users || []
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