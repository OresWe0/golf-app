-- Lindesbergs GK: beräknade front/center/back från OSM green-ytor + tee-riktning
-- Källa: OpenStreetMap way geometri inom banans område
with target_course as (
  select id
  from public.courses
  where lower(name) = lower('Lindesbergs GK')
  limit 1
),
gps_rows(hole_number, front_lat, front_lng, center_lat, center_lng, back_lat, back_lng) as (
  values
    (1, 59.5834879, 15.2484627, 59.5834454, 15.2483077, 59.5833536, 15.2481687),
    (2, 59.5815968, 15.2486891, 59.5816722, 15.2489027, 59.5817664, 15.2490388),
    (3, 59.5839255, 15.2461608, 59.5838724, 15.2460136, 59.5838284, 15.2457799),
    (4, 59.5802253, 15.2490657, 59.5803671, 15.2489477, 59.5804816, 15.2488026),
    (5, 59.5831807, 15.2442793, 59.5830532, 15.2445490, 59.5829278, 15.2448172),
    (6, 59.5827779, 15.2422054, 59.5828081, 15.2424755, 59.5828299, 15.2427204),
    (7, 59.5792892, 15.2420993, 59.5793854, 15.2423171, 59.5794964, 15.2424480),
    (8, 59.5801332, 15.2387564, 59.5801502, 15.2385192, 59.5801726, 15.2382225),
    (9, 59.5838388, 15.2416896, 59.5839972, 15.2420092, 59.5841318, 15.2422530),
    (10, 59.5870075, 15.2518404, 59.5869738, 15.2516193, 59.5869220, 15.2513441),
    (11, 59.5863185, 15.2541368, 59.5862666, 15.2539164, 59.5862106, 15.2536446),
    (12, 59.5880721, 15.2627404, 59.5881847, 15.2625405, 59.5882671, 15.2623530),
    (13, 59.5856303, 15.2670440, 59.5856164, 15.2668423, 59.5855840, 15.2666012),
    (14, 59.5821988, 15.2636361, 59.5821160, 15.2638358, 59.5821051, 15.2640304),
    (15, 59.5846024, 15.2619838, 59.5846036, 15.2622760, 59.5845657, 15.2625766),
    (16, 59.5864359, 15.2590153, 59.5864768, 15.2591992, 59.5864046, 15.2594659),
    (17, 59.5855836, 15.2516944, 59.5855201, 15.2518077, 59.5854075, 15.2516477),
    (18, 59.5843519, 15.2460816, 59.5844854, 15.2461955, 59.5846017, 15.2462211)
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
  g.front_lat,
  g.front_lng,
  g.center_lat,
  g.center_lng,
  g.back_lat,
  g.back_lng
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
