-- Supabase grants EXECUTE on every public function to anon by default.
-- delete_lead_cascade is destructive — only logged-in team members should
-- ever be able to call it. Revoke from anon explicitly.

REVOKE EXECUTE ON FUNCTION public.delete_lead_cascade(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_lead_cascade(uuid) TO authenticated;
