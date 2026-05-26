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
        // VERIFY TOKEN
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
        // VERIFY ADMIN TABLE
        // =====================================================
        const {
            data: adminRow,
            error: adminError
        } = await supabaseAdmin
            .from("admin")
            .select("*")
            .eq("email", user.email.toLowerCase())
            .eq("signature", "origin")
            .maybeSingle();

        if (adminError || !adminRow) {

            console.log("❌ INVALID ADMIN:", adminError);

            return res.status(403).json({
                success: "false",
                message: "invalid admin"
            });
        }

        // =====================================================
        // FETCH ADMIN USER TABLE ROW
        // =====================================================
        const {
            data: adminUserRow,
            error: adminUserError
        } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("email", user.email.toLowerCase())
            .eq("signature", "origin")
            .maybeSingle();

        if (adminUserError || !adminUserRow) {

            console.log("❌ ADMIN USER ROW NOT FOUND:", adminUserError);

            return res.status(403).json({
                success: "false",
                message: "Admin user row not found."
            });
        }

        req.admin = adminRow;
        req.adminUser = adminUserRow;
        req.accessToken = token;

        next();

    } catch (err) {

        console.error("❌ VERIFY ADMIN FAILURE:", err);

        return res.status(500).json({
            success: "false",
            message: err.message
        });
    }
}

/* =========================================================
   ⏱️ FORMAT SECONDS
========================================================= */
function formatSeconds(seconds = 0) {

    const total = Number(seconds) || 0;

    const hrs = Math.floor(total / 3600)
        .toString()
        .padStart(2, "0");

    const mins = Math.floor((total % 3600) / 60)
        .toString()
        .padStart(2, "0");

    return `${hrs}:${mins}`;
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

        if (!email || !password || !signature) {
            return res.json({
                success: "false",
                message: "Email, password and signature are required."
            });
        }

        // =====================================================
        // LOGIN
        // =====================================================
        const {
            data: authData,
            error: authError
        } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            return res.json({
                success: "false",
                message: authError.message
            });
        }

        // =====================================================
        // VERIFY ADMIN
        // =====================================================
        const {
            data: adminProfile,
            error: adminError
        } = await supabaseAdmin
            .from("admin")
            .select("*")
            .eq("email", email.toLowerCase())
            .eq("signature", signature)
            .maybeSingle();

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
   2️⃣ FETCH DATA
========================================================= */
router.get("/data", verifyAdminAccess, async (req, res) => {

    try {

        const {
            type,
            uuid,
            signature
        } = req.query;

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
           FETCH ALL USERS
        ===================================================== */
        if (type === "list") {

            const {
                data,
                error
            } = await supabaseAdmin
                .from("users")
                .select("*")
                .eq("signature", signature)
                .order("created_at", {
                    ascending: false
                });

            if (error) {
                throw error;
            }

            return res.json({
                success: "true",
                total: data.length,
                data
            });
        }

        /* =====================================================
           FETCH PROFILE PAGE DATA
        ===================================================== */
        if (type === "profile") {

            if (!uuid) {
                return res.json({
                    success: "false",
                    message: "Missing uuid parameter."
                });
            }

            // =================================================
            // FETCH TARGET USER
            // =================================================
            const {
                data: targetUser,
                error: targetError
            } = await supabaseAdmin
                .from("users")
                .select("*")
                .eq("id", uuid)
                .eq("signature", signature)
                .maybeSingle();

            if (targetError) {
                throw targetError;
            }

            if (!targetUser) {
                return res.json({
                    success: "false",
                    message: "User not found."
                });
            }

            // =================================================
            // FETCH CURRENT ADMIN USER ROW
            // =================================================
            const adminUser = req.adminUser;

            return res.json({
                success: "true",
                data: {
                    user: {
                        ...targetUser,
                        formatted_time: formatSeconds(
                            targetUser.remaining_seconds
                        )
                    },
                    admin: {
                        id: adminUser.id,
                        email: adminUser.email,
                        name: adminUser.name,
                        remaining_seconds: adminUser.remaining_seconds,
                        formatted_time: formatSeconds(
                            adminUser.remaining_seconds
                        )
                    }
                }
            });
        }

        return res.json({
            success: "false",
            message: "Invalid type parameter."
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
            status,
            add_minutes
        } = req.body;

        if (!uuid || !signature) {
            return res.json({
                success: "false",
                message: "Missing required parameters."
            });
        }

        // =====================================================
        // FETCH TARGET USER
        // =====================================================
        const {
            data: targetUser,
            error: targetError
        } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("id", uuid)
            .eq("signature", signature)
            .maybeSingle();

        if (targetError || !targetUser) {

            return res.json({
                success: "false",
                message: "User not found."
            });
        }

        // =====================================================
        // FETCH ADMIN USER
        // =====================================================
        const adminUser = req.adminUser;

        const adminSeconds =
            Number(adminUser.remaining_seconds) || 0;

        const minutesToAdd =
            Number(add_minutes) || 0;

        const secondsToAdd =
            minutesToAdd * 60;

        // =====================================================
        // ADMIN CAN'T GIVE MORE THAN OWN BALANCE
        // =====================================================
        if (secondsToAdd > adminSeconds) {

            return res.json({
                success: "false",
                message: "Admin does not have enough time."
            });
        }

        // =====================================================
        // NEW USER TIME
        // =====================================================
        const currentUserSeconds =
            Number(targetUser.remaining_seconds) || 0;

        const newUserSeconds =
            currentUserSeconds + secondsToAdd;

        // =====================================================
        // NEW ADMIN TIME
        // =====================================================
        const newAdminSeconds =
            adminSeconds - secondsToAdd;

        // =====================================================
        // UPDATE TARGET USER
        // =====================================================
        const updatePayload = {
            updated_at: new Date().toISOString()
        };

        if (name !== undefined) {
            updatePayload.name = name;
        }

        if (status !== undefined) {
            updatePayload.status =
                status === true ||
                status === "true";
        }

        updatePayload.remaining_seconds =
            newUserSeconds;

        const {
            data: updatedUser,
            error: updateError
        } = await supabaseAdmin
            .from("users")
            .update(updatePayload)
            .eq("id", uuid)
            .eq("signature", signature)
            .select()
            .maybeSingle();

        if (updateError) {
            throw updateError;
        }

        // =====================================================
        // UPDATE ADMIN TIME
        // =====================================================
        const {
            error: adminUpdateError
        } = await supabaseAdmin
            .from("users")
            .update({
                remaining_seconds: newAdminSeconds,
                updated_at: new Date().toISOString()
            })
            .eq("id", adminUser.id);

        if (adminUpdateError) {
            throw adminUpdateError;
        }

        return res.json({
            success: "true",
            message: "User updated successfully.",
            data: {
                user: updatedUser,
                admin_remaining_seconds: newAdminSeconds,
                admin_formatted_time:
                    formatSeconds(newAdminSeconds)
            }
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

        if (!uuid) {
            return res.json({
                success: "false",
                message: "Missing user uuid."
            });
        }

        // =====================================================
        // DELETE FROM USERS TABLE
        // =====================================================
        const {
            error: deleteUserTableError
        } = await supabaseAdmin
            .from("users")
            .delete()
            .eq("id", uuid);

        if (deleteUserTableError) {
            throw deleteUserTableError;
        }

        // =====================================================
        // DELETE AUTH USER
        // =====================================================
        const {
            error: authDeleteError
        } = await supabaseAdmin
            .auth
            .admin
            .deleteUser(uuid);

        if (authDeleteError) {
            throw authDeleteError;
        }

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
   5️⃣ ADMIN PROFILE
========================================================= */
router.get("/profile", verifyAdminAccess, async (req, res) => {

    try {

        return res.json({
            success: "true",
            data: {
                admin: req.admin,
                adminUser: {
                    ...req.adminUser,
                    formatted_time: formatSeconds(
                        req.adminUser.remaining_seconds
                    )
                }
            }
        });

    } catch (err) {

        console.error("❌ ADMIN PROFILE FAILURE:", err);

        return res.json({
            success: "false",
            message: err.message
        });
    }
});

/* =========================================================
   6️⃣ ADMIN LOGOUT
========================================================= */
router.post("/logout", verifyAdminAccess, async (req, res) => {

    try {

        // =====================================================
        // OPTIONAL SIGN OUT
        // =====================================================
        await supabaseAdmin.auth.signOut();

        return res.json({
            success: "true",
            message: "Admin logged out successfully."
        });

    } catch (err) {

        console.error("❌ ADMIN LOGOUT FAILURE:", err);

        return res.json({
            success: "false",
            message: err.message
        });
    }
});

export default router;