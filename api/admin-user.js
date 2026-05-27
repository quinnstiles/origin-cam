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
        // VERIFY TOKEN
        // =====================================================
        const {
            data: { user },
            error: authError
        } =
            await supabaseAuth.auth.getUser(token);

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

        if (
            adminError ||
            !adminProfile
        ) {

            return res.status(403).json({
                success: false,
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
            success: false,
            message:
                err.message
        });
    }
}

/* =========================================================
   FETCH SINGLE USER PROFILE
========================================================= */
router.get(
    "/profile/:uuid",
    verifyAdminAccess,
    async (req, res) => {

        try {

            const {
                uuid
            } = req.params;

            const {
                data,
                error
            } =
                await supabaseAdmin
                    .from("users")
                    .select("*")
                    .eq(
                        "id",
                        uuid
                    )
                    .maybeSingle();

            if (
                error ||
                !data
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "User not found."
                });
            }

            return res.json({
                success: true,
                data
            });

        } catch (err) {

            console.error(
                "❌ FETCH PROFILE FAILURE:",
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

/* =========================================================
   UPDATE USER
========================================================= */
router.put(
    "/update/:uuid",
    verifyAdminAccess,
    async (req, res) => {

        try {

            const {
                uuid
            } = req.params;

            const {
                name,
                remaining_seconds,
                status
            } = req.body;

            const updatePayload = {
                updated_at:
                    new Date().toISOString()
            };

            if (name !== undefined) {
                updatePayload.name = name;
            }

            if (remaining_seconds !== undefined) {
                updatePayload.remaining_seconds =
                    remaining_seconds;
            }

            if (status !== undefined) {
                updatePayload.status = status;
            }

            const {
                data,
                error
            } =
                await supabaseAdmin
                    .from("users")
                    .update(updatePayload)
                    .eq(
                        "id",
                        uuid
                    )
                    .select()
                    .maybeSingle();

            if (error) {
                throw error;
            }

            return res.json({
                success: true,
                data
            });

        } catch (err) {

            console.error(
                "❌ UPDATE USER FAILURE:",
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

/* =========================================================
   DELETE USER
========================================================= */
router.delete(
    "/delete/:uuid",
    verifyAdminAccess,
    async (req, res) => {

        try {

            const {
                uuid
            } = req.params;

            // delete profile
            await supabaseAdmin
                .from("users")
                .delete()
                .eq(
                    "id",
                    uuid
                );

            // delete auth account
            await supabaseAdmin
                .auth
                .admin
                .deleteUser(uuid);

            return res.json({
                success: true,
                message:
                    "User deleted successfully."
            });

        } catch (err) {

            console.error(
                "❌ DELETE USER FAILURE:",
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