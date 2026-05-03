insert into courses (id, name, club_name, holes_count, total_par)
values ('11111111-1111-1111-1111-111111111111', 'Kårsta GK', 'Kårsta Golfklubb', 18, 70)
on conflict (id) do nothing;

insert into course_tees (course_id, tee_key, label, course_rating, slope_rating, tee_par)
values
('11111111-1111-1111-1111-111111111111', 'yellow', 'Gul tee', 66.3, 117, 70),
('11111111-1111-1111-1111-111111111111', 'red', 'Röd tee', 64.5, 114, 70)
on conflict (course_id, tee_key) do update
set label = excluded.label,
    course_rating = excluded.course_rating,
    slope_rating = excluded.slope_rating,
    tee_par = excluded.tee_par;

insert into course_holes (course_id, hole_number, par, hcp_index, length_yellow, length_red, description)
values
('11111111-1111-1111-1111-111111111111', 1, 4, 12, 397, 301, 'Öppningshål på Kårsta GK.'),
('11111111-1111-1111-1111-111111111111', 2, 4, 18, 305, 288, 'Lättaste indexhålet enligt scorekortet.'),
('11111111-1111-1111-1111-111111111111', 3, 3, 8, 189, 98, 'Kort par 3 med precision som nyckel.'),
('11111111-1111-1111-1111-111111111111', 4, 4, 10, 289, 278, 'Par 4 där bra position i fairway hjälper mycket.'),
('11111111-1111-1111-1111-111111111111', 5, 4, 2, 319, 278, 'Svårare par 4 med lågt index.'),
('11111111-1111-1111-1111-111111111111', 6, 3, 14, 140, 105, 'Kort par 3.'),
('11111111-1111-1111-1111-111111111111', 7, 5, 4, 407, 341, 'Ut-nians par 5.'),
('11111111-1111-1111-1111-111111111111', 8, 3, 16, 136, 57, 'Kort par 3 där greenträff är allt.'),
('11111111-1111-1111-1111-111111111111', 9, 4, 6, 336, 239, 'Avslutning på ut-nian.'),
('11111111-1111-1111-1111-111111111111', 10, 4, 15, 366, 335, 'Stabil start på in-nian.'),
('11111111-1111-1111-1111-111111111111', 11, 4, 3, 329, 260, 'Långt par 4 med lågt index.'),
('11111111-1111-1111-1111-111111111111', 12, 3, 13, 157, 80, 'Par 3 på in-nian.'),
('11111111-1111-1111-1111-111111111111', 13, 5, 5, 290, 130, 'Par 5 med chans till poäng.'),
('11111111-1111-1111-1111-111111111111', 14, 4, 17, 206, 77, 'Kortare par 4 med högt index.'),
('11111111-1111-1111-1111-111111111111', 15, 4, 1, 305, 245, 'Banans svåraste hål enligt index.'),
('11111111-1111-1111-1111-111111111111', 16, 3, 9, 193, 104, 'Par 3 med krav på rätt klubba.'),
('11111111-1111-1111-1111-111111111111', 17, 4, 11, 393, 306, 'Stabilt par 4.'),
('11111111-1111-1111-1111-111111111111', 18, 5, 7, 132, 110, 'Avslutande par 5 mot klubbhuset.')
on conflict (course_id, hole_number) do update
set par = excluded.par,
    hcp_index = excluded.hcp_index,
    length_yellow = excluded.length_yellow,
    length_red = excluded.length_red,
    description = excluded.description;

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
