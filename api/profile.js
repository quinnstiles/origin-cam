import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// =========================================================
// 👤 FETCH USER PROFILE & MATCHING ADMIN CONFIG ASSETS
// =========================================================
router.get("/profile", async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.json({ success: "false", message: "Parameter userId is required." });
        }

        // 1. Fetch main user profile attributes
        const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("id, email, name, remaining_seconds, created_at, updated_at, signature, status")
            .eq("id", userId)
            .single();

        if (profileError || !userProfile) {
            console.log(`❌ Profile sync lookup error for UID ${userId}:`, profileError?.message);
            return res.json({ success: "false", message: "Profile context data target not found." });
        }

        // 2. Fetch global settings matching the user's signature matrix string
        let adminConfig = null;
        if (userProfile.signature) {
            // 🌟 UPDATED: Selecting exact new matching columns (window_download_link and macOS_download_link)
            const { data: configData, error: configError } = await supabase
                .from("admin")
                .select("id, created_at, signature, payment_instruction, selling_price, window_download_link, macOS_download_link")
                .eq("signature", userProfile.signature)
                .maybeSingle();

            if (configError) {
                console.log(`⚠️ Admin table fallback configuration warning for signature [${userProfile.signature}]:`, configError.message);
            } else if (configData) {
                adminConfig = configData;
            }
        }

        // 🎯 Return the complete compound entity pack to the frontend dashboard website
        return res.json({
            success: "true",
            profile: userProfile,
            adminSettings: adminConfig
        });

    } catch (err) {
        console.error("❌ PROFILE FETCH EXCEPTION:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

// =========================================================
// ✏️ UPDATE PROFILE DETAILS (NAME FIELD)
// =========================================================
router.put("/profile/update-name", async (req, res) => {
    try {
        const { userId, name } = req.body;

        if (!userId || !name || name.trim() === "") {
            return res.json({ success: "false", message: "Parameters userId and a valid name are required." });
        }

        // Update the public database row entry
        const { data, error } = await supabase
            .from("users")
            .update({ name: name.trim() })
            .eq("id", userId)
            .select();

        if (error || !data || data.length === 0) {
            return res.json({ success: "false", message: error ? error.message : "No row matches found to update." });
        }

        console.log(`✅ Profile display name updated for UID: ${userId} to "${name.trim()}"`);
        return res.json({
            success: "true",
            message: "Display name modified successfully.",
            updatedUser: data[0]
        });

    } catch (err) {
        console.error("❌ PROFILE UPDATE EXCEPTION:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

export default router;