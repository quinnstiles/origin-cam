// =========================================================
// ORIGIN CAM ADMIN SETTINGS API
// FILE:
// /api/admin-settings.js
// =========================================================

import express from "express";

import {
    supabaseAdmin,
    supabaseAuth
} from "../lib/supabase.js";

const router =
    express.Router();

// =========================================================
// VERIFY ADMIN ACCESS
// =========================================================
async function verifyAdminAccess(
    req,
    res,
    next
) {

    try {

        // =====================================================
        // AUTH HEADER
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
        // TOKEN
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
        const signature =
            req.query.signature ||
            req.body.signature;

        if (!signature) {

            return res.status(400).json({
                success: false,
                message:
                    "Missing signature."
            });
        }

        // =====================================================
        // NORMALIZE SIGNATURE
        // =====================================================
        const normalizedSignature =
            signature
                .trim()
                .toLowerCase();

        console.log(
            "🧠 VERIFY ADMIN TOKEN"
        );

        console.log(
            "🧠 SIGNATURE:",
            normalizedSignature
        );

        // =====================================================
        // VERIFY USER
        // =====================================================
        const {
            data: authData,
            error: authError
        } =
            await supabaseAuth.auth.getUser(
                token
            );

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
        // FIND ADMIN
        // =====================================================
        const {
            data: admin,
            error: adminError
        } =
            await supabaseAdmin
                .from("admin")
                .select(`
                    id,
                    uuid,
                    email,
                    signature,
                    selling_price,
                    payment_instruction,
                    window_download_link,
                    macOS_download_link,
                    created_at
                `)
                .eq(
                    "uuid",
                    user.id
                )
                .eq(
                    "signature",
                    normalizedSignature
                )
                .maybeSingle();

        console.log(
            "🧠 ADMIN:",
            admin
        );

        console.log(
            "🧠 ADMIN ERROR:",
            adminError
        );

        if (
            adminError ||
            !admin
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Invalid admin account."
            });
        }

        // =====================================================
        // FIND USER BALANCE
        // =====================================================
        const {
            data: userProfile,
            error: userError
        } =
            await supabaseAdmin
                .from("users")
                .select(`
                    id,
                    remaining_seconds,
                    email,
                    name,
                    signature
                `)
                .eq(
                    "id",
                    user.id
                )
                .eq(
                    "signature",
                    admin.signature
                )
                .maybeSingle();

        console.log(
            "🧠 USER PROFILE:",
            userProfile
        );

        console.log(
            "🧠 USER ERROR:",
            userError
        );

        if (userError) {

            return res.status(500).json({
                success: false,
                message:
                    userError.message
            });
        }

        // =====================================================
        // STORE VERIFIED CONTEXT
        // =====================================================
        req.token =
            token;

        req.authUser =
            user;

        req.admin =
            admin;

        req.userProfile =
            userProfile;

        console.log(
            "✅ VERIFY ADMIN ACCESS SUCCESS"
        );

        console.log(
            "================================"
        );

        next();

    } catch (err) {

        console.error(
            "❌ VERIFY ADMIN ACCESS ERROR:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                err.message
        });
    }
}

// =========================================================
// AUTH STATE
// =========================================================
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

// =========================================================
// GET ADMIN SETTINGS
// =========================================================
router.get(
    "/profile",
    verifyAdminAccess,
    async (req, res) => {

        try {

            console.log(
                "🚀 FETCH ADMIN SETTINGS"
            );

            const admin =
                req.admin;

            const userProfile =
                req.userProfile;

            // =================================================
            // RESPONSE
            // =================================================
            return res.json({

                success: true,

                data: {

                    // =========================================
                    // ADMIN TABLE
                    // =========================================
                    email:
                        admin?.email || "",

                    selling_price:
                        admin?.selling_price || "",

                    payment_instruction:
                        admin?.payment_instruction || "",

                    window_download_link:
                        admin?.window_download_link || "",

                    macOS_download_link:
                        admin?.macOS_download_link || "",

                    // =========================================
                    // USERS TABLE
                    // =========================================
                    remaining_seconds:
                        Number(
                            userProfile?.remaining_seconds
                        ) || 0
                }
            });

        } catch (err) {

            console.error(
                "❌ GET ADMIN SETTINGS ERROR:",
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

// =========================================================
// UPDATE ADMIN SETTINGS
// =========================================================
router.put(
    "/update",
    verifyAdminAccess,
    async (req, res) => {

        try {

            console.log(
                "🚀 UPDATE ADMIN SETTINGS"
            );

            const {
                selling_price,
                payment_instruction,
                window_download_link,
                macOS_download_link
            } = req.body;

            // =================================================
            // UPDATE PAYLOAD
            // =================================================
            const updatePayload = {};

            // =================================================
            // SELLING PRICE
            // =================================================
            if (
                selling_price !== undefined
            ) {

                updatePayload.selling_price =
                    Number(
                        selling_price
                    ) || 0;
            }

            // =================================================
            // PAYMENT INSTRUCTION
            // =================================================
            if (
                payment_instruction !== undefined
            ) {

                updatePayload.payment_instruction =
                    payment_instruction
                        ?.trim?.() || "";
            }

            // =================================================
            // WINDOWS DOWNLOAD
            // =================================================
            if (
                window_download_link !== undefined
            ) {

                updatePayload.window_download_link =
                    window_download_link
                        ?.trim?.() || "";
            }

            // =================================================
            // MAC DOWNLOAD
            // =================================================
            if (
                macOS_download_link !== undefined
            ) {

                updatePayload.macOS_download_link =
                    macOS_download_link
                        ?.trim?.() || "";
            }

            console.log(
                "🧠 UPDATE PAYLOAD:",
                updatePayload
            );

            // =================================================
            // UPDATE ADMIN TABLE
            // =================================================
            const {
                data,
                error
            } =
                await supabaseAdmin
                    .from("admin")
                    .update(
                        updatePayload
                    )
                    .eq(
                        "uuid",
                        req.admin.uuid
                    )
                    .eq(
                        "signature",
                        req.admin.signature
                    )
                    .select(`
                        id,
                        uuid,
                        email,
                        signature,
                        selling_price,
                        payment_instruction,
                        window_download_link,
                        macOS_download_link
                    `)
                    .maybeSingle();

            console.log(
                "🧠 UPDATED ADMIN:",
                data
            );

            console.log(
                "🧠 UPDATE ERROR:",
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
                message:
                    "Admin settings updated successfully.",
                data
            });

        } catch (err) {

            console.error(
                "❌ UPDATE ADMIN SETTINGS ERROR:",
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