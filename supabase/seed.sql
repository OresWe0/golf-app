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
