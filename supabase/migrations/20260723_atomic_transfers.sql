-- Keep budgets, player ownership, and transfer history consistent even if a
-- request fails. These functions execute as one PostgreSQL transaction.
alter table public.transfers alter column to_club drop not null;

create or replace function public.buy_player_atomic(
  p_player_id uuid,
  p_to_club_id uuid,
  p_from_club_id uuid,
  p_fee bigint
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  buyer_budget bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_fee < 0 then raise exception 'INVALID_FEE'; end if;

  select budget into buyer_budget from clubs where id = p_to_club_id for update;
  if buyer_budget is null then raise exception 'BUYER_NOT_FOUND'; end if;
  if buyer_budget < p_fee then
    raise exception 'INSUFFICIENT_BUDGET:%:%', p_fee, buyer_budget;
  end if;

  update clubs set budget = budget - p_fee where id = p_to_club_id;
  if p_from_club_id is not null then
    update clubs set budget = budget + p_fee where id = p_from_club_id;
    if not found then raise exception 'SELLER_NOT_FOUND'; end if;
  end if;

  update players set club_id = p_to_club_id, market_value = p_fee where id = p_player_id;
  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;

  insert into transfers(player_id, from_club, to_club, fee)
  values (p_player_id, p_from_club_id, p_to_club_id, p_fee);
end;
$$;

create or replace function public.release_player_atomic(
  p_player_id uuid,
  p_from_club_id uuid,
  p_cost bigint
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_cost < 0 then raise exception 'INVALID_COST'; end if;

  update clubs set budget = budget - p_cost where id = p_from_club_id;
  if not found then raise exception 'CLUB_NOT_FOUND'; end if;

  update players set club_id = null where id = p_player_id and club_id = p_from_club_id;
  if not found then raise exception 'PLAYER_NOT_IN_CLUB'; end if;

  insert into transfers(player_id, from_club, to_club, fee)
  values (p_player_id, p_from_club_id, null, p_cost);
end;
$$;

revoke all on function public.buy_player_atomic(uuid, uuid, uuid, bigint) from public;
revoke all on function public.release_player_atomic(uuid, uuid, bigint) from public;
grant execute on function public.buy_player_atomic(uuid, uuid, uuid, bigint) to authenticated;
grant execute on function public.release_player_atomic(uuid, uuid, bigint) to authenticated;
