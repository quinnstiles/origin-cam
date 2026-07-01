// =========================================================
// ORIGIN CAM ADMIN USER API
// FILE:
// /api/admin-user.js
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

        console.log(
            "🧠 VERIFY ADMIN TOKEN"
        );

        // =====================================================
        // VERIFY AUTH USER
        // =====================================================
        const {
            data: authData,
            error: authError
        } =
            await supabaseAuth
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
        // SIGNATURE
        // =====================================================
        const signature = (
            req.headers["x-signature"] ||
            req.query.signature ||
            req.body?.signature
        )?.toString()?.trim()?.toLowerCase();

        // 🌟 EXTRACT DYNAMIC MASTER SIGNATURE FROM FRONTEND
        const masterSignature = (
            req.headers["x-master-signature"] ||
            req.query.masterSignature ||
            req.body?.masterSignature
        )?.toString()?.trim()?.toLowerCase();

        console.log("🧠 TENANT SIGNATURE:", signature);
        console.log("🧠 MASTER SIGNATURE:", masterSignature);

        if (!signature) {
            return res.status(400).json({ success: false, message: "Missing signature." });
        }
        if (!masterSignature) {
            return res.status(400).json({ success: false, message: "Missing master platform signature." });
        }

        // =====================================================
        // VERIFY ADMIN
        // =====================================================
        const { data: adminProfile, error: adminError } = await supabaseAdmin
            .from("admin")
            .select("*")
            .eq("email", user.email)
            .eq("signature", signature) // Verifies email is authorized for this tenant
            .maybeSingle();

        if (adminError || !adminProfile) {
            return res.status(403).json({ success: false, message: "invalid admin" });
        }

        // =====================================================
        // STORE CONTEXT
        // =====================================================
        req.admin = adminProfile;
        req.authUser = user;
        req.signature = signature;
        req.masterSignature = masterSignature;

        next();

    } catch (err) {
        console.error("❌ VERIFY ADMIN FAILURE:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}


// =========================================================
// FETCH SINGLE USER PROFILE
// =========================================================
router.get("/profile/:uuid", verifyAdminAccess, async (req, res) => {
    try {
        const { uuid } = req.params;
        const signature = req.signature;             // e.g., "lemuel"
        const masterSignature = req.masterSignature; // 🌟 e.g., "origin" from frontend

        console.log("🚀 FETCH USER PROFILE:", uuid);

        // =================================================
        // FETCH ADMIN USER PROFILE FROM USERS TABLE
        // =================================================
        const { data: admin, error: adminError } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("email", req.admin.email)
            .eq("signature", masterSignature) // 🌟 Checks for admin account with your frontend master parent key
            .maybeSingle();

        console.log("🧠 ADMIN USER:", admin);

        if (adminError || !admin) {
            return res.status(404).json({ success: false, message: "Admin profile not found inside master registry." });
        }

        // =================================================
        // FETCH TARGET USER
        // =================================================
        const { data: user, error: userError } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("id", uuid)
            .eq("signature", signature) // Enforces that the consumer belongs to this platform child split scope
            .maybeSingle();

        if (userError || !user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        return res.json({ success: true, admin, user });

    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// =========================================================
// UPDATE USER
// =========================================================
router.put("/update/:uuid", verifyAdminAccess, async (req, res) => {
    try {
        const { uuid } = req.params;
        const signature = req.signature;
        const masterSignature = req.masterSignature; // 🌟 Dynamic parent indicator
        const { name, status, add_seconds } = req.body;

        // Fetch Admin profile via master parent signature
        const { data: admin, error: adminError } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("email", req.admin.email)
            .eq("signature", masterSignature) // 🌟
            .maybeSingle();

        if (adminError || !admin) {
            return res.status(404).json({ success: false, message: "Admin not found." });
        }

        // Fetch target user to update via current tenant split
        const { data: user, error: userError } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("id", uuid)
            .eq("signature", signature)
            .maybeSingle();

        if (userError || !user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const donation = Number(add_seconds) || 0;
        if (donation < 0) {
            return res.status(400).json({ success: false, message: "Invalid donation amount." });
        }

        if (donation > Number(admin.remaining_seconds)) {
            return res.status(400).json({ success: false, message: "Admin balance too low." });
        }

        // Update target user time credits
        const newUserSeconds = Number(user.remaining_seconds) + donation;
        const { error: updateUserError } = await supabaseAdmin
            .from("users")
            .update({
                name: name?.trim?.() || "",
                status: Boolean(status),
                remaining_seconds: newUserSeconds,
                updated_at: new Date().toISOString()
            })
            .eq("id", uuid)
            .eq("signature", signature);

        if (updateUserError) throw updateUserError;

        // Deduct time balance directly from admin row located in users table
        const newAdminSeconds = Number(admin.remaining_seconds) - donation;
        const { error: updateAdminError } = await supabaseAdmin
            .from("users")
            .update({
                remaining_seconds: newAdminSeconds,
                updated_at: new Date().toISOString()
            })
            .eq("id", admin.id)
            .eq("signature", masterSignature); // 🌟 Enforces safe targeted updates

        if (updateAdminError) throw updateAdminError;

        return res.json({ success: true, message: "User updated successfully." });

    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});
// =========================================================
// DELETE USER
// =========================================================
router.delete(
    "/delete/:uuid",
    verifyAdminAccess,
    async (req, res) => {

        try {

            const { uuid } =
                req.params;

            const signature =
                req.signature;

            console.log(
                "🚀 DELETE USER:",
                uuid
            );

            // =================================================
            // VERIFY USER EXISTS
            // =================================================
            const {
                data: existingUser,
                error: existingUserError
            } =
                await supabaseAdmin
                    .from("users")
                    .select(`
                        id,
                        email,
                        signature
                    `)
                    .eq(
                        "id",
                        uuid
                    )
                    .eq(
                        "signature",
                        signature
                    )
                    .maybeSingle();

            console.log(
                "🧠 EXISTING USER:",
                existingUser
            );

            console.log(
                "🧠 EXISTING USER ERROR:",
                existingUserError
            );

            if (
                existingUserError ||
                !existingUser
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "User not found."
                });
            }

            // =================================================
            // DELETE USER PROFILE
            // =================================================
            const {
                error: deleteProfileError
            } =
                await supabaseAdmin
                    .from("users")
                    .delete()
                    .eq(
                        "id",
                        uuid
                    )
                    .eq(
                        "signature",
                        signature
                    );

            console.log(
                "🧠 DELETE PROFILE ERROR:",
                deleteProfileError
            );

            if (deleteProfileError) {

                throw deleteProfileError;
            }

            // =================================================
            // DELETE AUTH USER
            // =================================================
            const {
                error: deleteAuthError
            } =
                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(uuid);

            console.log(
                "🧠 DELETE AUTH ERROR:",
                deleteAuthError
            );

            if (deleteAuthError) {

                throw deleteAuthError;
            }

            // =================================================
            // SUCCESS
            // =================================================
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