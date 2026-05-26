import express from "express";
import { supabaseAdmin } from "../lib/supabase.js";

const router = express.Router();

/* =========================================================
   🔒 VERIFY ADMIN ACCESS
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
        // VERIFY JWT TOKEN
        // =====================================================
        const {
            data: { user },
            error: authError
        } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            console.log("❌ TOKEN VERIFY FAILED:", authError);

            return res.status(401).json({
                success: "false",
                message: "Invalid authentication token."
            });
        }

        console.log("✅ AUTH USER:", user.email);

        // =====================================================
        // VERIFY ADMIN TABLE ENTRY
        // =====================================================
        const { data: adminRow, error: adminError } =
            await supabaseAdmin
                .from("admin")
                .select("*")
                .eq("email", user.email)
                .eq("signature", "origin")
                .maybeSingle();

        console.log("🧠 ADMIN LOOKUP:", adminRow);
        console.log("🧠 ADMIN ERROR:", adminError);

        if (adminError || !adminRow) {
            return res.status(403).json({
                success: "false",
                message: "invalid admin"
            });
        }

        req.admin = adminRow;

        next();

    } catch (err) {

        console.error("❌ ADMIN VERIFY FAILURE:", err);

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

        const {
            email,
            password,
            signature
        } = req.body;

        console.log("📥 ADMIN LOGIN REQUEST:", {
            email,
            signature
        });

        if (!email || !password || !signature) {
            return res.json({
                success: "false",
                message: "Email, password and signature are required."
            });
        }

        // =====================================================
        // LOGIN USER
        // =====================================================
        const {
            data: authData,
            error: authError
        } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password
        });

        console.log("🧠 AUTH LOGIN RESPONSE:", authData);
        console.log("🧠 AUTH LOGIN ERROR:", authError);

        if (authError) {
            return res.json({
                success: "false",
                message: authError.message
            });
        }

        // =====================================================
        // VERIFY ADMIN EMAIL + SIGNATURE
        // =====================================================
        const normalizedEmail = email.trim().toLowerCase();

        console.log("🔍 SEARCHING ADMIN:", normalizedEmail);

        const {
            data: adminProfile,
            error: adminError
        } = await supabaseAdmin
            .from("admin")
            .select("*")
            .eq("email", normalizedEmail)
            .eq("signature", signature)
            .maybeSingle();

        console.log("🧠 ADMIN PROFILE:", adminProfile);
        console.log("🧠 ADMIN PROFILE ERROR:", adminError);

        if (adminError || !adminProfile) {

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

        console.error("❌ ADMIN LOGIN FAILURE:", err);

        return res.json({
            success: "false",
            message: err.message
        });
    }
});


/* =========================================================
   2️⃣ DYNAMIC DATA ENDPOINT
========================================================= */
router.get("/data", verifyAdminAccess, async (req, res) => {

    try {

        const {
            type,
            uuid,
            signature
        } = req.query;

        if (!type || !signature) {
            return res.json({
                success: "false",
                message: "Missing required parameters."
            });
        }

        // =====================================================
        // LIST USERS
        // =====================================================
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

        // =====================================================
        // SINGLE USER PROFILE
        // =====================================================
        if (type === "profile") {

            const { data, error } =
                await supabaseAdmin
                    .from("users")
                    .select("*")
                    .eq("id", uuid)
                    .eq("signature", signature)
                    .maybeSingle();

            if (error) throw error;

            return res.json({
                success: "true",
                data
            });
        }

        return res.json({
            success: "false",
            message: "Invalid type."
        });

    } catch (err) {

        console.error("❌ ADMIN DATA FAILURE:", err);

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

        const updatePayload = {
            updated_at: new Date().toISOString()
        };

        if (name !== undefined) {
            updatePayload.name = name;
        }

        if (remaining_seconds !== undefined) {
            updatePayload.remaining_seconds = remaining_seconds;
        }

        const { data, error } =
            await supabaseAdmin
                .from("users")
                .update(updatePayload)
                .eq("id", uuid)
                .eq("signature", signature)
                .select()
                .maybeSingle();

        if (error) throw error;

        return res.json({
            success: "true",
            data
        });

    } catch (err) {

        console.error("❌ UPDATE USER FAILURE:", err);

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

        const {
            uuid
        } = req.body;

        await supabaseAdmin
            .from("users")
            .delete()
            .eq("id", uuid);

        await supabaseAdmin.auth.admin.deleteUser(uuid);

        return res.json({
            success: "true",
            message: "User deleted successfully."
        });

    } catch (err) {

        console.error("❌ DELETE USER FAILURE:", err);

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

    return res.json({
        success: "true",
        data: req.admin
    });

});

export default router;