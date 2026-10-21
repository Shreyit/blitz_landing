-- Run manually only AFTER deploying deliver-mail. Enable pg_cron and pg_net in
-- Database > Extensions. In Vault, create the secrets blitz_project_url (the
-- https://PROJECT.supabase.co URL) and blitz_mail_worker_secret (the SAME random
-- MAIL_WORKER_SECRET used by the function). No credentials belong in this file.
do $$
begin
  if (select count(*) from vault.decrypted_secrets
      where name in ('blitz_project_url','blitz_mail_worker_secret')) <> 2 then
    raise exception 'Create both BLITZ Vault secrets before scheduling mail.';
  end if;
end $$;

-- A named job updates the existing schedule if this operation is repeated.
select cron.schedule('blitz-deliver-mail', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='blitz_project_url')
      || '/functions/v1/deliver-mail',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='blitz_mail_worker_secret')),
    body := '{}'::jsonb
  );
$$);
