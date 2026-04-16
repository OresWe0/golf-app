with target_course as (
  select id
  from public.courses
  where lower(name) = lower('Lindesbergs GK')
  limit 1
),
gps_rows(hole_number, center_lat, center_lng) as (
  values
    (1, 59.5834454, 15.2483077),
    (2, 59.5816722, 15.2489027),
    (3, 59.5838724, 15.2460136),
    (4, 59.5803671, 15.2489477),
    (5, 59.5830532, 15.2445490),
    (6, 59.5828081, 15.2424755),
    (7, 59.5793854, 15.2423171),
    (8, 59.5801502, 15.2385192),
    (9, 59.5839972, 15.2420092),
    (10, 59.5869738, 15.2516193),
    (11, 59.5862666, 15.2539164),
    (12, 59.5881847, 15.2625405),
    (13, 59.5856164, 15.2668423),
    (14, 59.5821160, 15.2638358),
    (15, 59.5846036, 15.2622760),
    (16, 59.5864768, 15.2591992),
    (17, 59.5855201, 15.2518077),
    (18, 59.5844854, 15.2461955)
)
insert into public.course_hole_gps (
  course_id,
  hole_number,
  front_lat,
  front_lng,
  center_lat,
  center_lng,
  back_lat,
  back_lng
)
select
  tc.id,
  g.hole_number,
  g.center_lat,
  g.center_lng,
  g.center_lat,
  g.center_lng,
  g.center_lat,
  g.center_lng
from target_course tc
cross join gps_rows g
on conflict (course_id, hole_number)
do update set
  front_lat = excluded.front_lat,
  front_lng = excluded.front_lng,
  center_lat = excluded.center_lat,
  center_lng = excluded.center_lng,
  back_lat = excluded.back_lat,
  back_lng = excluded.back_lng;

select
  chg.hole_number,
  chg.front_lat,
  chg.front_lng,
  chg.center_lat,
  chg.center_lng,
  chg.back_lat,
  chg.back_lng
from public.course_hole_gps chg
join public.courses c on c.id = chg.course_id
where lower(c.name) = lower('Lindesbergs GK')
order by chg.hole_number;
