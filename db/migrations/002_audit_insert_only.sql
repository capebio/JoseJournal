-- Enforce the append-only audit ledger at the database level (§3.8, §11):
-- no UPDATE/DELETE on audit_ledger, even by the app role. INSERT + SELECT only.
-- Run as the migration (superuser) role; the app connects as `jose`.

DO $$
BEGIN
  -- Revoke mutating grants from the application role if present.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jose') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_ledger FROM jose;
    GRANT INSERT, SELECT ON audit_ledger TO jose;
    GRANT USAGE, SELECT ON SEQUENCE audit_ledger_id_seq TO jose;
  END IF;
END $$;

-- Belt-and-braces: a rule that rejects UPDATE/DELETE outright.
CREATE OR REPLACE RULE audit_ledger_no_update AS ON UPDATE TO audit_ledger DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_ledger_no_delete AS ON DELETE TO audit_ledger DO INSTEAD NOTHING;
