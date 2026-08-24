-- RLS expressions execute as the authenticated caller and therefore need
-- EXECUTE on the boolean helper functions they reference. The private schema
-- remains outside PostgREST's exposed schemas, and each function only answers
-- an authorization question about auth.uid().

grant execute on function private.is_platform_super_admin()
  to authenticated;

grant execute on function private.can_manage_fellowship(bigint, text)
  to authenticated;
