-- Recreates the roles and grants a real Supabase project ships with, so that
-- supabase/schema.sql runs against the same starting conditions: anon and
-- authenticated hold broad table grants and RLS is what actually restricts
-- them; service_role bypasses RLS. Runs before the schema.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create role authenticator noinherit login password 'authpass';
grant anon to authenticator;
grant authenticated to authenticator;
grant service_role to authenticator;

grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
