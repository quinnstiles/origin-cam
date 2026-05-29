import express from "express";

import {
    supabaseAdmin,
    supabaseAuth
} from "../lib/supabase.js";

const router =
    express.Router();

/* =========================================================
   VERIFY ADMIN ACCESS
========================================================= */
async function verifyAdminAccess(
    req,
    res,
    next
) {

    try {

        // =====================================================
        // AUTHORIZATION HEADER
        // =====================================================
        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith(
                "Bearer "
            )
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

        // =====================================================
        // SIGNATURE
        // =====================================================
        const rawSignature =
            req.query.signature ||
            req.body.signature ||
            req.headers["x-signature"];

        if (!rawSignature) {

            return res.status(400).json({
                success: false,
                message:
                    "Missing signature."
            });
        }

        const signature =
            rawSignature
                .trim()
                .toLowerCase();

        console.log(
            "🧠 VERIFY SIGNATURE:",
            signature
        );

        // =====================================================
        // VERIFY USER TOKEN
        // =====================================================
        const {
            data: authData,
            error: authError
        } =
            await supabaseAuth.auth.getUser(
                token
            );

        const user =
            authData?.user;

        console.log(
            "🧠 AUTH USER:",
            user?.email
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

            return res.status(401).json({
                success: false,
                message:
                    "invalid admin"
            });
        }

        // =====================================================
        // STORE
        // =====================================================
        req.admin =
            adminProfile;

        req.authUser =
            user;

        req.signature =
            signature;

        req.token =
            token;

        console.log(
            "✅ ADMIN VERIFIED"
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
   FETCH USERS
========================================================= */
router.get(
    "/list",
    verifyAdminAccess,
    async (req, res) => {

        try {

            const signature =
                req.signature;

            console.log(
                "📥 FETCH USERS SIGNATURE:",
                signature
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
                        signature
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            if (error) {

                throw error;
            }

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