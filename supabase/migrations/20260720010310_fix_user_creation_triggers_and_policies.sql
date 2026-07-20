/*
# Fix user creation: simplify triggers + add admin INSERT policy on profiles

1. Problem
   Creating new users (both via admin edge function and public sign-up) fails
   because of complex interactions between handle_new_user() and
   protect_profile_role() triggers. handle_new_user() does an
   INSERT ... ON CONFLICT (id) DO UPDATE SET role = ..., which fires
   protect_profile_role() on the UPDATE branch. While the previous migration
   allowed auth.uid() IS NULL (service role) through, the combination is
   fragile and hard to reason about.

   Additionally, the admin edge function needs to INSERT new profile rows
   (when the trigger hasn't created them yet), but there is NO INSERT policy
   on profiles for admins — only SELECT and UPDATE. So if the trigger fails
   or is slow, the edge function's INSERT into profiles is blocked by RLS.

2. Changes
   a. Simplify handle_new_user(): plain INSERT with ON CONFLICT DO NOTHING.
      No UPDATE branch means protect_profile_role() never fires from the
      trigger. For preassigned admins, the role is set to the assigned role
      on first INSERT. For existing users who somehow don't have a profile,
      the edge function handles the upsert with the service role key (which
      bypasses RLS and the trigger allows via auth.uid() IS NULL).
   b. protect_profile_role(): keep the current fix (allow auth.uid() IS NULL
      for service role). No further changes needed.
   c. Add INSERT policy on profiles for admins: "admin_insert_profiles".
      This allows an admin (authenticated, is_admin()) to INSERT new profile
      rows directly. The service role bypasses RLS entirely, but having this
      policy makes the intent explicit and allows future admin-authenticated
      inserts if needed.

3. Security
   - handle_new_user() is SECURITY DEFINER, runs as postgres, bypasses RLS.
   - protect_profile_role() allows service role (auth.uid() IS NULL) to
     change roles — only the service role key bypasses RLS, so this is safe.
   - New INSERT policy is scoped to is_admin() (authenticated admins only).
*/

-- Simplify handle_new_user: plain INSERT, no UPDATE branch
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_role text;
BEGIN
  BEGIN
    SELECT role INTO assigned_role FROM preassigned_admins WHERE email = NEW.email;
  EXCEPTION WHEN undefined_table THEN
    assigned_role := NULL;
  END;
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(assigned_role, 'user'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add INSERT policy on profiles for admins
DROP POLICY IF EXISTS "admin_insert_profiles" ON profiles;
CREATE POLICY "admin_insert_profiles" ON profiles FOR INSERT
  TO authenticated WITH CHECK (is_admin());
