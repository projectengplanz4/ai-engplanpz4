/*
# Fix profiles RLS recursion + protect_profile_role trigger

1. Problem
   The admin RLS policies on `profiles` used `EXISTS (SELECT 1 FROM profiles ...)`
   which causes infinite recursion — PostgreSQL evaluates the subquery under RLS,
   which re-evaluates the same policy, ad infinitum. This made ALL selects on
   `profiles` fail, including a user reading their own profile, so the frontend
   could never determine the user's role.

2. Fix
   - Create `is_admin()` as a SECURITY DEFINER function. SECURITY DEFINER runs
     with the function owner's (postgres) privileges, bypassing RLS, so the
     internal SELECT on profiles does not recurse.
   - Rewrite all admin policies to use `is_admin()` instead of inline subqueries.
   - Rewrite `protect_profile_role()` trigger to use `is_admin()`.
   - Rewrite `handle_new_user()` trigger to use a SECURITY DEFINER approach for
     the preassigned_admins lookup (already SECURITY DEFINER, just confirming).

3. Security
   - `is_admin()` is read-only and only checks the caller's role.
   - No changes to the `select_own_profile` or `update_own_profile` policies.
*/

-- Create is_admin() security definer function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop and recreate admin SELECT policy using is_admin()
DROP POLICY IF EXISTS "admin_select_all_profiles" ON profiles;
CREATE POLICY "admin_select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (is_admin());

-- Drop and recreate admin UPDATE policy using is_admin()
DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;
CREATE POLICY "admin_update_all_profiles" ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Rewrite protect_profile_role trigger to use is_admin()
CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'Hanya admin yang dapat mengubah role';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
