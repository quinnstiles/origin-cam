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

        const token =
            authHeader.split(" ")[1];

        // =====================================================
        // VERIFY USER TOKEN
        // =====================================================
        const {
            data: { user },
            error: authError
        } =
            await supabaseAuth.auth.getUser(
                token
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
        // VERIFY ADMIN TABLE
        // =====================================================
        const {
            data: admin,
            error: adminError
        } =
            await supabaseAdmin
                .from("admin")
                .select("*")
                .eq(
                    "uuid",
                    user.id
                )
                .eq(
                    "signature",
                    "origin"
                )
                .maybeSingle();

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

        req.authUser =
            user;

        req.admin =
            admin;

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
// GET ADMIN SETTINGS
// =========================================================
router.get(
    "/profile",
    verifyAdminAccess,
    async (req, res) => {

        try {

            const admin =
                req.admin;

            // =================================================
            // FETCH USER BALANCE
            // =================================================
            const {
                data: userProfile,
                error: userError
            } =
                await supabaseAdmin
                    .from("users")
                    .select(`
                        remaining_seconds
                    `)
                    .eq(
                        "id",
                        admin.uuid
                    )
                    .maybeSingle();

            if (userError) {

                throw userError;
            }

            return res.json({
                success: true,

                data: {

                    email:
                        admin.email || "",

                    selling_price:
                        admin.selling_price || "",

                    payment_instruction:
                        admin.payment_instruction || "",

                    window_download_link:
                        admin.window_download_link || "",

                    macOS_download_link:
                        admin.macOS_download_link || "",

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

            const {
                selling_price,
                payment_instruction,
                window_download_link,
                macOS_download_link
            } = req.body;

            const updatePayload = {

                updated_at:
                    new Date().toISOString()
            };

            // =================================================
            // OPTIONAL FIELDS
            // =================================================
            if (
                selling_price !== undefined
            ) {

                updatePayload.selling_price =
                    selling_price;
            }

            if (
                payment_instruction !== undefined
            ) {

                updatePayload.payment_instruction =
                    payment_instruction;
            }

            if (
                window_download_link !== undefined
            ) {

                updatePayload.window_download_link =
                    window_download_link;
            }

            if (
                macOS_download_link !== undefined
            ) {

                updatePayload.macOS_download_link =
                    macOS_download_link;
            }

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
                        "origin"
                    )
                    .select()
                    .maybeSingle();

            if (error) {

                throw error;
            }

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