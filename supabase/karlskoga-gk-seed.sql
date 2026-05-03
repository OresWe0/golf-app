-- Karlskoga GK (18 hål) import
-- Källa: scorekort/PDF underlag från 2026-05-03

insert into courses (id, name, club_name, holes_count, total_par)
values ('22222222-2222-2222-2222-222222222222', 'Karlskoga GK', 'Karlskoga Golfklubb', 18, 72)
on conflict (id) do update
set name = excluded.name,
    club_name = excluded.club_name,
    holes_count = excluded.holes_count,
    total_par = excluded.total_par;

insert into course_tees (course_id, tee_key, label, course_rating, slope_rating, tee_par)
values
('22222222-2222-2222-2222-222222222222', 'yellow', 'Gul tee', 71.4, 128, 72),
('22222222-2222-2222-2222-222222222222', 'red', 'Röd tee', 67.3, 120, 72)
on conflict (course_id, tee_key) do update
set label = excluded.label,
    course_rating = excluded.course_rating,
    slope_rating = excluded.slope_rating,
    tee_par = excluded.tee_par;

insert into course_holes (course_id, hole_number, par, hcp_index, length_yellow, length_red, description)
values
('22222222-2222-2222-2222-222222222222', 1, 5, 7, 455, 426, 'Karlskoga GK hål 1.'),
('22222222-2222-2222-2222-222222222222', 2, 4, 15, 302, 120, 'Karlskoga GK hål 2.'),
('22222222-2222-2222-2222-222222222222', 3, 4, 5, 342, 265, 'Karlskoga GK hål 3.'),
('22222222-2222-2222-2222-222222222222', 4, 5, 13, 436, 376, 'Karlskoga GK hål 4.'),
('22222222-2222-2222-2222-222222222222', 5, 3, 3, 160, 334, 'Karlskoga GK hål 5.'),
('22222222-2222-2222-2222-222222222222', 6, 4, 11, 310, 239, 'Karlskoga GK hål 6.'),
('22222222-2222-2222-2222-222222222222', 7, 3, 9, 130, 109, 'Karlskoga GK hål 7.'),
('22222222-2222-2222-2222-222222222222', 8, 4, 17, 237, 282, 'Karlskoga GK hål 8.'),
('22222222-2222-2222-2222-222222222222', 9, 4, 1, 285, 305, 'Karlskoga GK hål 9.'),
('22222222-2222-2222-2222-222222222222', 10, 5, 14, 453, 396, 'Karlskoga GK hål 10.'),
('22222222-2222-2222-2222-222222222222', 11, 3, 4, 146, 281, 'Karlskoga GK hål 11.'),
('22222222-2222-2222-2222-222222222222', 12, 4, 12, 292, 316, 'Karlskoga GK hål 12.'),
('22222222-2222-2222-2222-222222222222', 13, 5, 10, 427, 414, 'Karlskoga GK hål 13.'),
('22222222-2222-2222-2222-222222222222', 14, 4, 2, 381, 156, 'Karlskoga GK hål 14.'),
('22222222-2222-2222-2222-222222222222', 15, 4, 18, 315, 305, 'Karlskoga GK hål 15.'),
('22222222-2222-2222-2222-222222222222', 16, 3, 8, 129, 109, 'Karlskoga GK hål 16.'),
('22222222-2222-2222-2222-222222222222', 17, 4, 16, 322, 207, 'Karlskoga GK hål 17.'),
('22222222-2222-2222-2222-222222222222', 18, 4, 6, 353, 285, 'Karlskoga GK hål 18.')
on conflict (course_id, hole_number) do update
set par = excluded.par,
    hcp_index = excluded.hcp_index,
    length_yellow = excluded.length_yellow,
    length_red = excluded.length_red,
    description = excluded.description;
