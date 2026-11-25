/** 本地用户更新时间的数据库事实来源；任何写入路径均由触发器维护。 */
export const authLifecycleSQL = `
CREATE OR REPLACE FUNCTION yuumi_auth_before_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    NEW.updated_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER users_before_update BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION yuumi_auth_before_update();
`
