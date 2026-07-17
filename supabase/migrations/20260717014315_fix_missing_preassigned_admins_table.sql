/*
# Fix: create missing preassigned_admins table

The original migration only created preassigned_admins inside a DO block
when the admin user didn't exist yet in auth.users. Since the user already
existed, the table was never created. But handle_new_user() references it,
causing every new signup to fail with a database error.

This migration creates the table unconditionally and re-ensures the admin
email is preassigned.
*/

CREATE TABLE IF NOT EXISTS preassigned_admins (
  email text PRIMARY KEY,
  role text NOT NULL DEFAULT 'admin',
  assigned_at timestamptz DEFAULT now()
);

INSERT INTO preassigned_admins (email, role)
VALUES ('projectengplanz4@gmail.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Make handle_new_user resilient: if preassigned_admins somehow doesn't exist,
-- default to 'user' instead of crashing
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
  ON CONFLICT (id) DO UPDATE SET role = COALESCE(assigned_role, profiles.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
