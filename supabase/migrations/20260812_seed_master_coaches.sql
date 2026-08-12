with coach_seed(name, nationality, age, market_value, stat_tac, stat_mgt, stat_mot, stat_att, stat_def, stat_phy) as (
  values
    ('Pep Guardiola', 'Spain', 53, 15000000, 96, 94, 90, 95, 88, 85),
    ('Jurgen Klopp', 'Germany', 56, 14000000, 92, 96, 98, 94, 86, 90),
    ('Carlo Ancelotti', 'Italy', 64, 12000000, 93, 97, 92, 90, 89, 82),
    ('Zinedine Zidane', 'France', 51, 11000000, 89, 95, 93, 91, 87, 84),
    ('Sir Alex Ferguson', 'Scotland', 82, 20000000, 97, 99, 99, 93, 91, 88),
    ('Kiatisuk Senamuang', 'Thailand', 50, 5000000, 82, 85, 88, 84, 80, 81),
    ('Mikel Arteta', 'Spain', 42, 10000000, 91, 89, 92, 89, 88, 85),
    ('Jose Mourinho', 'Portugal', 61, 11000000, 94, 92, 95, 84, 96, 83),
    ('Xabi Alonso', 'Spain', 42, 12500000, 93, 90, 91, 92, 89, 86),
    ('Luis Enrique', 'Spain', 54, 9500000, 88, 89, 91, 92, 83, 85),
    ('Arne Slot', 'Netherlands', 45, 9000000, 89, 87, 88, 90, 84, 83),
    ('Simone Inzaghi', 'Italy', 48, 9800000, 92, 88, 89, 88, 93, 85),
    ('Unai Emery', 'Spain', 52, 8500000, 90, 86, 87, 87, 88, 82),
    ('Hans-Dieter Flick', 'Germany', 59, 10500000, 91, 90, 93, 95, 82, 89),
    ('Julian Nagelsmann', 'Germany', 36, 9500000, 92, 85, 86, 91, 85, 84),
    ('Diego Simeone', 'Argentina', 54, 11500000, 89, 94, 98, 82, 97, 92),
    ('Roberto De Zerbi', 'Italy', 44, 8000000, 90, 84, 86, 92, 78, 80),
    ('Arsene Wenger', 'France', 74, 13000000, 94, 96, 92, 96, 83, 81),
    ('Antonio Conte', 'Italy', 54, 10000000, 91, 90, 96, 86, 92, 91),
    ('Erik ten Hag', 'Netherlands', 54, 7500000, 86, 82, 83, 85, 84, 80),
    ('Ishii Masatada', 'Japan', 57, 6000000, 84, 87, 86, 81, 85, 83),
    ('Totchtawan Sripan', 'Thailand', 52, 4500000, 80, 83, 85, 82, 79, 80)
)
insert into public.coaches (name, nationality, age, market_value, stat_tac, stat_mgt, stat_mot, stat_att, stat_def, stat_phy, photo_url, club_id)
select seed.name, seed.nationality, seed.age, seed.market_value, seed.stat_tac, seed.stat_mgt, seed.stat_mot, seed.stat_att, seed.stat_def, seed.stat_phy, null, null
from coach_seed seed
where not exists (
  select 1 from public.coaches existing where lower(existing.name) = lower(seed.name)
);
