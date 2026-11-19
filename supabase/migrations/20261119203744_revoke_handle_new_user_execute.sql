-- handle_new_user solo debe ejecutarse desde el trigger on_auth_user_created,
-- nunca vía /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
