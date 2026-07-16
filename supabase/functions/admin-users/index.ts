import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is an admin by checking their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Check if caller is admin
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !callerProfile || callerProfile.role !== "admin") {
      return jsonResponse({ error: "Forbidden: admin access required" }, 403);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── LIST USERS ──────────────────────────────────────────────
    if (req.method === "GET") {
      const { data: profiles, error: profilesError } = await adminClient
        .from("profiles")
        .select("id, email, role, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) {
        return jsonResponse({ error: profilesError.message }, 500);
      }

      return jsonResponse({ users: profiles as AdminUser[] });
    }

    // ── CHANGE ROLE ─────────────────────────────────────────────
    if (req.method === "POST" && action === "change-role") {
      const { targetUserId, newRole } = await req.json();

      if (!targetUserId || !newRole || !["user", "admin"].includes(newRole)) {
        return jsonResponse({ error: "Invalid parameters" }, 400);
      }

      // Prevent admin from demoting themselves
      if (targetUserId === userData.user.id) {
        return jsonResponse({ error: "Tidak dapat mengubah role akun sendiri" }, 400);
      }

      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", targetUserId);

      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500);
      }

      return jsonResponse({ success: true, message: `Role diubah menjadi ${newRole}` });
    }

    // ── DELETE USER ─────────────────────────────────────────────
    if (req.method === "DELETE") {
      const { targetUserId } = await req.json();

      if (!targetUserId) {
        return jsonResponse({ error: "User ID required" }, 400);
      }

      // Prevent admin from deleting themselves
      if (targetUserId === userData.user.id) {
        return jsonResponse({ error: "Tidak dapat menghapus akun sendiri" }, 400);
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);

      if (deleteError) {
        return jsonResponse({ error: deleteError.message }, 500);
      }

      // Profile row is auto-deleted via ON DELETE CASCADE
      return jsonResponse({ success: true, message: "User berhasil dihapus" });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal server error" },
      500,
    );
  }
});

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
