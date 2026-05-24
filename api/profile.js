import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// =========================================================
// 👤 FETCH USER PROFILE AND SESSION HISTORY LOGS
// =========================================================
router.get("/profile", async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.json({ success: "false", message: "Parameter userId is required." });
        }

        // 1. Fetch main user profile statistics
        const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();

        if (profileError || !userProfile) {
            return res.json({ success: "false", message: "Profile context data target not found." });
        }

        // 2. Fetch linked log entries sorted by latest interaction timestamp
        const { data: userHistory, error: historyError } = await supabase
            .from("history")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        return res.json({
            success: "true",
            profile: userProfile,
            history: historyError ? [] : userHistory
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