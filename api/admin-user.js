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

            const { uuid } = req.params;

            // =================================================
            // FETCH CURRENT ADMIN
            // =================================================
            const {
                data: admin,
                error: adminError
            } =
                await supabaseAdmin
                    .from("users")
                    .select("*")
                    .eq(
                        "email",
                        req.admin.email
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

                return res.status(404).json({
                    success: false,
                    message:
                        "Admin profile not found."
                });
            }

            // =================================================
            // FETCH TARGET USER
            // =================================================
            const {
                data: user,
                error: userError
            } =
                await supabaseAdmin
                    .from("users")
                    .select("*")
                    .eq(
                        "id",
                        uuid
                    )
                    .eq(
                        "signature",
                        "origin"
                    )
                    .maybeSingle();

            if (
                userError ||
                !user
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "User not found."
                });
            }

            return res.json({
                success: true,
                admin,
                user
            });

        } catch (err) {

            console.error(
                "❌ PROFILE FAILURE:",
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

            const { uuid } = req.params;

            const {
                name,
                status,
                add_seconds
            } = req.body;

            // =============================================
            // FETCH ADMIN
            // =============================================
            const {
                data: admin,
                error: adminError
            } =
                await supabaseAdmin
                    .from("users")
                    .select("*")
                    .eq(
                        "email",
                        req.admin.email
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

                return res.status(404).json({
                    success: false,
                    message:
                        "Admin not found."
                });
            }

            // =============================================
            // FETCH TARGET USER
            // =============================================
            const {
                data: user,
                error: userError
            } =
                await supabaseAdmin
                    .from("users")
                    .select("*")
                    .eq(
                        "id",
                        uuid
                    )
                    .eq(
                        "signature",
                        "origin"
                    )
                    .maybeSingle();

            if (
                userError ||
                !user
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "User not found."
                });
            }

            const donation =
                Number(add_seconds) || 0;

            // =============================================
            // VALIDATE ADMIN BALANCE
            // =============================================
            if (
                donation >
                admin.remaining_seconds
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Admin balance too low."
                });
            }

            // =============================================
            // UPDATE USER
            // =============================================
            const newUserSeconds =
                Number(
                    user.remaining_seconds
                ) + donation;

            const {
                error: updateUserError
            } =
                await supabaseAdmin
                    .from("users")
                    .update({
                        name,
                        status,
                        remaining_seconds:
                            newUserSeconds,
                        updated_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        uuid
                    );

            if (updateUserError) {
                throw updateUserError;
            }

            // =============================================
            // DEDUCT ADMIN
            // =============================================
            const newAdminSeconds =
                Number(
                    admin.remaining_seconds
                ) - donation;

            const {
                error: updateAdminError
            } =
                await supabaseAdmin
                    .from("users")
                    .update({
                        remaining_seconds:
                            newAdminSeconds,
                        updated_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        admin.id
                    );

            if (updateAdminError) {
                throw updateAdminError;
            }

            return res.json({
                success: true,
                message:
                    "User updated successfully."
            });

        } catch (err) {

            console.error(
                "❌ UPDATE FAILURE:",
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