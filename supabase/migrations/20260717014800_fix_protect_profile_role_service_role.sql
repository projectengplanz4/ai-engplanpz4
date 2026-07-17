-- Fix: protect_profile_role trigger blocks service-role edge function updates.
--
-- The trigger calls is_admin() which checks auth.uid(). When the edge function
-- uses the service role key, auth.uid() is NULL, so is_admin() returns false,
-- and the trigger raises an exception — blocking user creation/role updates.
--
-- Fix: if auth.uid() IS NULL, the operation is from the service role (which
-- bypasses RLS). Allow it through. This is safe because:
--   1. Authenticated users always have auth.uid() set
--   2. Anon requests are blocked by RLS before the trigger fires
--   3. Only the service role key bypasses RLS and has auth.uid() = NULL

CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
      RAISE EXCEPTION 'Hanya admin yang dapat mengubah role';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
