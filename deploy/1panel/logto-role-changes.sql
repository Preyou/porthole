\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';

SELECT t.db_user AS logto_tenant_db_user, current_database() AS logto_db_name
FROM public.tenants AS t
WHERE t.id = 'default'
\gset

CREATE SCHEMA IF NOT EXISTS porthole_identity;
REVOKE ALL ON SCHEMA porthole_identity FROM PUBLIC;
CREATE TABLE IF NOT EXISTS porthole_identity.membership_changes (
  subject text PRIMARY KEY,
  changed_at bigint NOT NULL
);

GRANT USAGE ON SCHEMA porthole_identity TO :"logto_tenant_db_user", :"porthole_db_user";
GRANT SELECT (subject, changed_at), INSERT (subject, changed_at), UPDATE (changed_at)
  ON porthole_identity.membership_changes TO :"logto_tenant_db_user";
GRANT SELECT (subject, changed_at) ON porthole_identity.membership_changes TO :"porthole_db_user";
GRANT CONNECT ON DATABASE :"logto_db_name" TO :"porthole_db_user";

CREATE OR REPLACE FUNCTION porthole_identity.record_membership_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  changed_subject text;
  changed_at_ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
BEGIN
  FOR changed_subject IN
    SELECT DISTINCT subject
    FROM (
      SELECT OLD.user_id AS subject WHERE TG_OP <> 'INSERT' AND OLD.tenant_id = 'default'
      UNION ALL
      SELECT NEW.user_id AS subject WHERE TG_OP <> 'DELETE' AND NEW.tenant_id = 'default'
    ) AS subjects
    ORDER BY subject
  LOOP
    INSERT INTO porthole_identity.membership_changes AS m (subject, changed_at)
    VALUES (changed_subject, changed_at_ms)
    ON CONFLICT (subject) DO UPDATE SET changed_at = greatest(m.changed_at, excluded.changed_at);
  END LOOP;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION porthole_identity.record_membership_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION porthole_identity.record_membership_change() TO :"logto_tenant_db_user";

CREATE OR REPLACE TRIGGER porthole_users_roles_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.users_roles
  FOR EACH ROW EXECUTE FUNCTION porthole_identity.record_membership_change();
CREATE OR REPLACE TRIGGER porthole_organization_roles_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_role_user_relations
  FOR EACH ROW EXECUTE FUNCTION porthole_identity.record_membership_change();
CREATE OR REPLACE TRIGGER porthole_organization_membership_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_user_relations
  FOR EACH ROW EXECUTE FUNCTION porthole_identity.record_membership_change();

COMMIT;
