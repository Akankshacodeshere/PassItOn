-- PassItOn database. Supabase: SQL Editor > New query > paste ALL of this > Run.
-- Change bennett.edu.in below if your college domain is different (3 places).

-- ===== tables =====
create table listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  seller_email text not null default (auth.jwt()->>'email'),
  title text not null check (char_length(title) between 3 and 60),
  category text not null,
  price int not null check (price >= 0),
  condition text not null,
  pickup text not null check (char_length(pickup) between 2 and 40),
  description text check (char_length(description) <= 300),
  image_url text,
  status text not null default 'available' check (status in ('available','sold')),
  approval text not null default 'pending' check (approval in ('pending','approved','rejected')),
  reject_reason text,
  reports int not null default 0,
  created_at timestamptz not null default now()
);
create table reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings on delete cascade,
  reporter uuid references auth.users default auth.uid(),
  reason text, created_at timestamptz default now(),
  unique (listing_id, reporter)
);
-- moderators: students who approve posts. Add them in Table Editor or with SQL (see SETUP.md)
create table moderators (email text primary key);

alter table listings enable row level security;
alter table reports enable row level security;
alter table moderators enable row level security;   -- nobody can read this table through the website

-- ===== who is a moderator =====
create function is_mod() returns boolean language sql security definer stable as $$
  select exists (select 1 from moderators where lower(email) = lower(auth.jwt()->>'email'));
$$;

-- ===== who can do what =====
-- see listings: moderators see everything, owners see their own, everyone else sees only approved ones
create policy "read" on listings for select to authenticated using (
  (auth.jwt()->>'email') like '%@bennett.edu.in'
  and (is_mod() or user_id = auth.uid() or (approval = 'approved' and reports < 3)));
-- anyone (even logged out) can browse approved listings, but never sees the seller's email or id
create policy "public read" on listings for select to anon using (approval = 'approved' and reports < 3);
revoke all on listings from anon;
grant select (id, title, category, price, condition, pickup, description, image_url, status, approval, reports, created_at) on listings to anon;
create policy "insert" on listings for insert to authenticated with check (
  user_id = auth.uid() and (auth.jwt()->>'email') like '%@bennett.edu.in');
create policy "update" on listings for update to authenticated using (user_id = auth.uid() or is_mod());
create policy "delete" on listings for delete to authenticated using (user_id = auth.uid() or is_mod());
create policy "report" on reports for insert to authenticated with check (reporter = auth.uid());

-- ===== new posts always start as "pending" + basic checks =====
create function on_new_listing() returns trigger language plpgsql as $$
begin
  new.approval := 'pending'; new.reject_reason := null; new.reports := 0; new.status := 'available';
  if new.price > 50000 then raise exception 'Price can''t be more than 50,000.'; end if;
  if length(coalesce(new.description, '')) < 10 then raise exception 'Add a few details (at least 10 characters).'; end if;
  if new.price >= 1000 and new.image_url is null then raise exception 'Add a photo for items priced 1,000 or more.'; end if;
  if (select count(*) from listings where user_id = new.user_id and status = 'available'
        and approval <> 'rejected' and created_at > now() - interval '30 days') >= 5 then
    raise exception 'You already have 5 active posts. Mark one as sold or delete it first.';
  end if;
  return new;
end $$;
create trigger new_listing before insert on listings for each row execute function on_new_listing();

-- ===== students can't approve their own posts or edit them after approval =====
create function on_edit_listing() returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and not is_mod() then
    new.user_id := old.user_id; new.seller_email := old.seller_email; new.title := old.title;
    new.category := old.category; new.price := old.price; new.condition := old.condition; new.pickup := old.pickup;
    new.description := old.description; new.image_url := old.image_url;
    new.approval := old.approval; new.reject_reason := old.reject_reason; new.reports := old.reports;
  end if;
  return new;   -- (owners can still change status = sold/available and repost with created_at)
end $$;
create trigger edit_listing before update on listings for each row execute function on_edit_listing();

-- ===== counting reports =====
create function bump() returns trigger language plpgsql security definer as $$
begin update listings set reports = reports + 1 where id = new.listing_id; return new; end $$;
create trigger on_report after insert on reports for each row execute function bump();

-- ===== photo storage =====
insert into storage.buckets (id, name, public) values ('item-photos', 'item-photos', true);
create policy "upload" on storage.objects for insert to authenticated with check (bucket_id = 'item-photos');
create policy "view" on storage.objects for select using (bucket_id = 'item-photos');

-- ===== only college emails can sign up =====
create function only_college() returns trigger language plpgsql security definer as $$
begin
  if lower(new.email) not like '%@bennett.edu.in' then raise exception 'Only college emails can sign up'; end if;
  return new;
end $$;
create trigger college_only before insert on auth.users for each row execute function only_college();

-- ===== make yourself a moderator (put a real college email, run this line too) =====
-- insert into moderators (email) values ('your-name@bennett.edu.in');
