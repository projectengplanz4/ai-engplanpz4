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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

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

    // ── CREATE USER ─────────────────────────────────────────────
    if (req.method === "POST" && action === "create-user") {
      const body = await req.json();
      const email = (body.email as string)?.toLowerCase().trim();
      const password = body.password as string;
      const role = body.role as string;

      if (!email || !password) {
        return jsonResponse({ error: "Email dan kata sandi wajib diisi" }, 400);
      }
      // Basic email format validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ error: "Format email tidak valid" }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ error: "Kata sandi minimal 6 karakter" }, 400);
      }
      const assignedRole = role === "admin" ? "admin" : "user";

      // Check if email already exists in auth.users
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const exists = existingUsers?.users?.some(
        (u: { email: string }) => u.email === email,
      );
      if (exists) {
        return jsonResponse({ error: "Email sudah terdaftar" }, 400);
      }

      // Create the auth user
      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return jsonResponse({ error: createError.message }, 500);
      }

      if (!createdUser.user) {
        return jsonResponse({ error: "Gagal membuat user" }, 500);
      }

      const newUserId = createdUser.user.id;

      // Upsert profile with the assigned role.
      // The handle_new_user trigger may have already inserted a row with role='user'
      // (or the preassigned admin role). We update it to the explicitly assigned role.
      // Service role bypasses RLS; protect_profile_role trigger allows auth.uid() IS NULL.
      const { error: upsertError } = await adminClient
        .from("profiles")
        .upsert(
          { id: newUserId, email, role: assignedRole },
          { onConflict: "id" },
        );

      if (upsertError) {
        // If upsert fails, the user is already created in auth.users.
        // Don't try to delete — just report the error so admin can retry the role change.
        return jsonResponse(
          { error: `User dibuat tapi gagal mengatur role: ${upsertError.message}` },
          500,
        );
      }

      // For admin users, also add to preassigned_admins for consistency
      if (assignedRole === "admin") {
        await adminClient
          .from("preassigned_admins")
          .upsert({ email, role: "admin" }, { onConflict: "email" });
      }

      // Fetch the final profile to return accurate data
      const { data: finalProfile } = await adminClient
        .from("profiles")
        .select("id, email, role, created_at")
        .eq("id", newUserId)
        .maybeSingle();

      return jsonResponse({
        success: true,
        message: `User ${email} berhasil dibuat`,
        user: {
          id: newUserId,
          email,
          role: assignedRole,
          created_at: finalProfile?.created_at ?? new Date().toISOString(),
        },
      });
    }

    // ── CHANGE ROLE ─────────────────────────────────────────────
    if (req.method === "POST" && action === "change-role") {
      const body = await req.json();
      const targetUserId = body.targetUserId as string;
      const newRole = body.newRole as string;

      if (!targetUserId || !newRole || !["user", "admin"].includes(newRole)) {
        return jsonResponse({ error: "Parameter tidak valid" }, 400);
      }

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

      // Sync preassigned_admins
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("email")
        .eq("id", targetUserId)
        .maybeSingle();

      if (targetProfile) {
        if (newRole === "admin") {
          await adminClient
            .from("preassigned_admins")
            .upsert({ email: targetProfile.email, role: "admin" }, { onConflict: "email" });
        } else {
          await adminClient
            .from("preassigned_admins")
            .delete()
            .eq("email", targetProfile.email);
        }
      }

      return jsonResponse({ success: true, message: `Role diubah menjadi ${newRole}` });
    }

    // ── DELETE USER ─────────────────────────────────────────────
    if (req.method === "DELETE") {
      const body = await req.json();
      const targetUserId = body.targetUserId as string;

      if (!targetUserId) {
        return jsonResponse({ error: "User ID diperlukan" }, 400);
      }

      if (targetUserId === userData.user.id) {
        return jsonResponse({ error: "Tidak dapat menghapus akun sendiri" }, 400);
      }

      // Get email before deletion to clean up preassigned_admins
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("email")
        .eq("id", targetUserId)
        .maybeSingle();

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);

      if (deleteError) {
        return jsonResponse({ error: deleteError.message }, 500);
      }

      // Profile row is auto-deleted via ON DELETE CASCADE
      // Clean up preassigned_admins
      if (targetProfile) {
        await adminClient
          .from("preassigned_admins")
          .delete()
          .eq("email", targetProfile.email);
      }

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
