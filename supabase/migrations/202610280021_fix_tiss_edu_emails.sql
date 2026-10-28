-- Two players registered with @tiss.edu before the domain became stud.tiss.edu.
-- Move them to the correct address. Scoped by exact email for safeupdate; a
-- no-op if they were already fixed by hand.
update blitz.registrations
set email = replace(email, '@tiss.edu', '@stud.tiss.edu')
where email in ('m2023bsw003@tiss.edu', 'm2023bsass004@tiss.edu');
