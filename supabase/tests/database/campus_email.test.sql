-- Equivalence partitions and boundary values for private.require_campus_email().
-- Rule: exactly <local>@vanderbilt.edu, one @, no whitespace, case-insensitive domain.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Accepted partitions
select lives_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000001', 'a@vanderbilt.edu')$$,
  'A one-character local part is accepted');
select lives_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000002', 'Alice@VANDERBILT.EDU')$$,
  'The domain is matched case-insensitively');

-- Rejected partitions
select throws_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000003', 'a@vanderbilt.ed')$$,
  'P0001', 'Use your Vanderbilt email address.', 'A truncated domain is rejected');
select throws_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000004', 'a@mail.vanderbilt.edu')$$,
  'P0001', 'Use your Vanderbilt email address.', 'A subdomain is rejected');
select throws_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000012', 'a@.vanderbilt.edu')$$,
  'P0001', 'Use your Vanderbilt email address.', 'An empty subdomain label is rejected');
select throws_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000005', 'a@vanderbilt.edu.evil.com')$$,
  'P0001', 'Use your Vanderbilt email address.', 'A look-alike suffix is rejected');
select throws_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000006', 'a@vanderbilt.educ')$$,
  'P0001', 'Use your Vanderbilt email address.', 'One extra character after the domain is rejected');
select throws_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000007', 'a@vanderbiltXedu')$$,
  'P0001', 'Use your Vanderbilt email address.', 'The dot in the domain is literal');
select throws_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000008', '@vanderbilt.edu')$$,
  'P0001', 'Use your Vanderbilt email address.', 'An empty local part is rejected');
select throws_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000009', 'a b@vanderbilt.edu')$$,
  'P0001', 'Use your Vanderbilt email address.', 'Whitespace in the local part is rejected');
select throws_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000010', 'a@vanderbilt.edu ')$$,
  'P0001', 'Use your Vanderbilt email address.', 'A trailing space is rejected');
select throws_ok($$insert into auth.users(id, email) values ('91000000-0000-4000-8000-000000000011', 'a@b@vanderbilt.edu')$$,
  'P0001', 'Use your Vanderbilt email address.', 'More than one @ is rejected');

select * from finish();
rollback;
