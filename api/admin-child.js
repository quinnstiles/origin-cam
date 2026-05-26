import express from "express";
import { supabaseAdmin } from "../lib/supabase.js";

const router = express.Router();

/* =========================================================
   🔒 ADMIN AUTHORIZATION MIDDLEWARE
========================================================= */
async function verifyAdminAccess(req, res, next) {
    try {

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: "false",
                message: "Missing authorization token."
            });
        }

        const token = authHeader.split(" ")[1];

        // =====================================================
        // VERIFY AUTH TOKEN
        // =====================================================
        const {
            data: { user },
            error: authError
        } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                success: "false",
                message: "Invalid authentication token."
            });
        }

        // =====================================================
        // VERIFY USER EXISTS INSIDE ADMIN TABLE
        // =====================================================
        const { data: adminRow, error: adminError } =
            await supabaseAdmin
                .from("admin")
                .select("*")
                .eq("uuid", user.id)
                .maybeSingle();

        if (adminError || !adminRow) {
            return res.status(403).json({
                success: "false",
                message: "invalid admin"
            });
        }

        req.admin = adminRow;
        req.adminUuid = user.id;

        next();

    } catch (err) {
        console.error("ADMIN AUTH MIDDLEWARE FAILURE:", err);

        return res.status(500).json({
            success: "false",
            message: err.message
        });
    }
}


/* =========================================================
   1️⃣ ADMIN LOGIN
========================================================= */
router.post("/login", async (req, res) => {
    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.json({
                success: "false",
                message: "Email and password are required."
            });
        }

        // =====================================================
        // LOGIN USER
        // =====================================================
        const { data: authData, error: authError } =
            await supabaseAdmin.auth.signInWithPassword({
                email,
                password
            });

        if (authError) {
            return res.json({
                success: "false",
                message: authError.message
            });
        }

        const userUuid = authData.user.id;

        // =====================================================
        // VERIFY ADMIN EXISTS
        // =====================================================
        const { data: adminProfile, error: adminError } =
            await supabaseAdmin
                .from("admin")
                .select("*")
                .eq("uuid", userUuid)
                .maybeSingle();

        if (adminError || !adminProfile) {

            // destroy session
            await supabaseAdmin.auth.signOut();

            return res.json({
                success: "false",
                message: "invalid admin"
            });
        }

        return res.json({
            success: "true",
            session: authData.session,
            adminProfile
        });

    } catch (err) {

        console.error("ADMIN LOGIN FAILURE:", err);

        return res.json({
            success: "false",
            message: err.message
        });
    }
});


/* =========================================================
   2️⃣ DYNAMIC DATA ENDPOINT
   type=list
   type=profile
========================================================= */
router.get("/data", verifyAdminAccess, async (req, res) => {
    try {

        const { type, uuid, signature } = req.query;

        if (!type) {
            return res.json({
                success: "false",
                message: "Missing type parameter."
            });
        }

        if (!signature) {
            return res.json({
                success: "false",
                message: "Missing signature parameter."
            });
        }

        /* =====================================================
           FETCH USER LIST
        ===================================================== */
        if (type === "list") {

            const { data, error } =
                await supabaseAdmin
                    .from("users")
                    .select("*")
                    .eq("signature", signature)
                    .order("created_at", { ascending: false });

            if (error) throw error;

            return res.json({
                success: "true",
                data
            });
        }

        /* =====================================================
           FETCH SINGLE PROFILE
        ===================================================== */
        if (type === "profile") {

            if (!uuid) {
                return res.json({
                    success: "false",
                    message: "Missing user uuid."
                });
            }

            const { data, error } =
                await supabaseAdmin
                    .from("users")
                    .select("*")
                    .eq("id", uuid)
                    .eq("signature", signature)
                    .maybeSingle();

            if (error) throw error;

            if (!data) {
                return res.json({
                    success: "false",
                    message: "User not found."
                });
            }

            return res.json({
                success: "true",
                data
            });
        }

        return res.json({
            success: "false",
            message: "Invalid type parameter."
        });

    } catch (err) {

        console.error("ADMIN DATA ROUTE FAILURE:", err);

        return res.json({
            success: "false",
            message: err.message
        });
    }
});


/* =========================================================
   3️⃣ UPDATE USER
========================================================= */
router.put("/user/update", verifyAdminAccess, async (req, res) => {
    try {

        const {
            uuid,
            signature,
            name,
            remaining_seconds
        } = req.body;

        if (!uuid || !signature) {
            return res.json({
                success: "false",
                message: "uuid and signature are required."
            });
        }

        const updatePayload = {};

        if (name !== undefined) {
            updatePayload.name = name;
        }

        if (remaining_seconds !== undefined) {
            updatePayload.remaining_seconds = remaining_seconds;
        }

        updatePayload.updated_at = new Date().toISOString();

        const { data, error } =
            await supabaseAdmin
                .from("users")
                .update(updatePayload)
                .eq("id", uuid)
                .eq("signature", signature)
                .select()
                .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.json({
                success: "false",
                message: "User not found."
            });
        }

        return res.json({
            success: "true",
            message: "User updated successfully.",
            data
        });

    } catch (err) {

        console.error("ADMIN UPDATE USER FAILURE:", err);

        return res.json({
            success: "false",
            message: err.message
        });
    }
});


/* =========================================================
   4️⃣ DELETE USER
========================================================= */
router.delete("/user/delete", verifyAdminAccess, async (req, res) => {
    try {

        const { uuid, signature } = req.body;

        if (!uuid || !signature) {
            return res.json({
                success: "false",
                message: "uuid and signature are required."
            });
        }

        // =====================================================
        // VERIFY USER EXISTS
        // =====================================================
        const { data: userData } =
            await supabaseAdmin
                .from("users")
                .select("id")
                .eq("id", uuid)
                .eq("signature", signature)
                .maybeSingle();

        if (!userData) {
            return res.json({
                success: "false",
                message: "User not found."
            });
        }

        // =====================================================
        // DELETE PUBLIC USER ROW
        // =====================================================
        const { error: deleteError } =
            await supabaseAdmin
                .from("users")
                .delete()
                .eq("id", uuid);

        if (deleteError) throw deleteError;

        // =====================================================
        // DELETE AUTH USER
        // =====================================================
        const { error: authDeleteError } =
            await supabaseAdmin.auth.admin.deleteUser(uuid);

        if (authDeleteError) {
            console.warn(
                "AUTH DELETE WARNING:",
                authDeleteError.message
            );
        }

        return res.json({
            success: "true",
            message: "User deleted successfully."
        });

    } catch (err) {

        console.error("ADMIN DELETE USER FAILURE:", err);

        return res.json({
            success: "false",
            message: err.message
        });
    }
});


/* =========================================================
   5️⃣ FETCH ADMIN PROFILE
========================================================= */
router.get("/profile", verifyAdminAccess, async (req, res) => {
    try {

        const { data, error } =
            await supabaseAdmin
                .from("admin")
                .select("*")
                .eq("uuid", req.adminUuid)
                .maybeSingle();

        if (error) throw error;

        return res.json({
            success: "true",
            data
        });

    } catch (err) {

        console.error("ADMIN PROFILE FETCH FAILURE:", err);

        return res.json({
            success: "false",
            message: err.message
        });
    }
});

export default router;