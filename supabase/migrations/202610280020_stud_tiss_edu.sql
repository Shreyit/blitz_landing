-- The second student domain is stud.tiss.edu, not tiss.edu. New registrations
-- must use @stud.tiss.ac.in or @stud.tiss.edu. NOT VALID keeps any existing
-- @tiss.edu rows untouched instead of failing the migration.
do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'blitz.registrations'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%tiss%';
  if c is not null then execute format('alter table blitz.registrations drop constraint %I', c); end if;
end $$;
alter table blitz.registrations add constraint registrations_email_domain check (
  email = lower(email) and length(email) <= 200
  and email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@(stud\.tiss\.ac\.in|stud\.tiss\.edu)$'
) not valid;
