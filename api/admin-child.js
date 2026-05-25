import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// 🔒 SECURITY MIDDLEWARE: VALIDATE INCOMING ADMIN REQUESTS
async function verifyAdminAccess(req, res, next) {
    const adminUuid = req.headers["admin-uuid"];
    if (!adminUuid) {
        return res.status(401).json({ success: "false", message: "Administrative authorization token missing." });
    }

    const { data: adminRow, error } = await supabase
        .from("admin")
        .select("uuid")
        .eq("uuid", adminUuid)
        .maybeSingle();

    if (error || !adminRow) {
        return res.status(403).json({ success: "false", message: "Access Denied. Invalid administrative footprint." });
    }

    req.adminUuid = adminUuid;
    next();
}

// 1️⃣ ADMIN LOGIN WITH STRING-PAD AND CASING OVERRIDES
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.json({ success: "false", message: "Email and password are required." });
        }

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) return res.json({ success: "false", message: authError.message });

        // Normalizing the Auth core ID into a clean lowercase text string
        const userUuid = authData.user.id.toLowerCase().trim();

        // Query the admin table using an explicit lowercase text transformation query
        const { data: adminProfile, error: dbError } = await supabase
            .from("admin")
            .select("*")
            .ilike("uuid", userUuid) // 🌟 Using ilike handles case-insensitive string matching flawlessly
            .maybeSingle();

        if (dbError || !adminProfile) {
            console.log(`❌ Admin lookup failed for clean string: ${userUuid}`);
            await supabase.auth.signOut(); // Wipe session instantly
            return res.json({ success: "false", message: "Access rejected: Invalid admin authorization profile." });
        }

        return res.json({
            success: "true",
            session: authData.session,
            adminProfile: adminProfile
        });
    } catch (err) {
        return res.json({ success: "false", message: err.message });
    }
});


// 2️⃣ DYNAMIC GET ROUTER (LIST OR PROFILE BASED ON PASSED SIGNATURE)
router.get("/data", verifyAdminAccess, async (req, res) => {
    try {
        const { type, uuid, signature } = req.query;

        if (!signature) {
            return res.json({ success: "false", message: "Missing required signature parameter." });
        }

        // 📋 CASE: Fetch all users matching the frontend's signature
        if (type === "list") {
            const { data: usersList, error } = await supabase
                .from("users")
                .select("*")
                .eq("signature", signature)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return res.json({ success: "true", data: usersList });
        }

        // 👤 CASE: Fetch an individual user matching the signature
        if (type === "profile") {
            if (!uuid) return res.json({ success: "false", message: "Target profile user UUID parameter is required." });

            const { data: userProfile, error } = await supabase
                .from("users")
                .select("*")
                .eq("id", uuid)
                .eq("signature", signature)
                .maybeSingle();

            if (error) throw error;
            if (!userProfile) return res.json({ success: "false", message: "No user found matching this UUID and signature." });

            return res.json({ success: "true", data: userProfile });
        }

        return res.json({ success: "false", message: "Invalid query operations type parameters specified." });
    } catch (err) {
        return res.json({ success: "false", message: err.message });
    }
});

// 3️⃣ UPDATE TARGET USER (MATCHES UUID + SIGNATURE)
router.put("/user/update", verifyAdminAccess, async (req, res) => {
    try {
        const { uuid, signature, name, remaining_seconds } = req.body;

        if (!uuid || !signature) {
            return res.json({ success: "false", message: "Target user uuid and signature parameters are required." });
        }

        const updatePayload = {};
        if (name !== undefined) updatePayload.name = name;
        if (remaining_seconds !== undefined) updatePayload.remaining_seconds = remaining_seconds;

        const { data: updatedUser, error } = await supabase
            .from("users")
            .update(updatePayload)
            .eq("id", uuid)
            .eq("signature", signature)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!updatedUser) return res.json({ success: "false", message: "No matching record found to update." });

        return res.json({ success: "true", message: "User parameters updated successfully.", data: updatedUser });
    } catch (err) {
        return res.json({ success: "false", message: err.message });
    }
});

// 4️⃣ PURGE/DELETE TARGET USER (MATCHES UUID + SIGNATURE)
router.delete("/user/delete", verifyAdminAccess, async (req, res) => {
    try {
        const { uuid, signature } = req.body;

        if (!uuid || !signature) {
            return res.json({ success: "false", message: "Target user uuid and signature fields are required." });
        }

        // Verify user exists with that signature first to protect other app signatures
        const { data: userCheck } = await supabase
            .from("users")
            .select("id")
            .eq("id", uuid)
            .eq("signature", signature)
            .maybeSingle();

        if (!userCheck) {
            return res.json({ success: "false", message: "User not found under this signature application profile." });
        }

        // Delete public profile row
        const { error: dbError } = await supabase.from("users").delete().eq("id", uuid);
        if (dbError) throw dbError;

        // Delete core Auth profile
        const { error: authError } = await supabase.auth.admin.deleteUser(uuid);
        if (authError) console.warn(`⚠️ Auth record warning: ${authError.message}`);

        return res.json({ success: "true", message: "Target user account completely purged." });
    } catch (err) {
        return res.json({ success: "false", message: err.message });
    }
});

// 5️⃣ FETCH ADMIN SINGLE ROW DATA
router.get("/profile", verifyAdminAccess, async (req, res) => {
    try {
        const { data: adminData, error } = await supabase
            .from("admin")
            .select("*")
            .eq("uuid", req.adminUuid)
            .maybeSingle();

        if (error) throw error;
        return res.json({ success: "true", data: adminData });
    } catch (err) {
        return res.json({ success: "false", message: err.message });
    }
});

export default router;