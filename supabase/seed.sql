-- Dining halls are inserted by the migration so local and hosted projects agree.
-- Create demo users through email OTP; local mail is captured at localhost:54324.

-- Demo menu items for local development and tests, taken from the scraped NetNutrition data.
-- Real menus will come from the importer (Story 15). Hosted projects do not run this file.
insert into public.menu_items (id, dining_hall_id, name, category) values
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Achiote Chicken', 'Fresh Mex Main'),
('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Sweet Potato Sofrito', 'Fresh Mex Main'),
('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Cilantro-Lime Rice', 'Fresh Mex Base'),
('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Beef Lasagna', 'Chef''s Table Main'),
('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Vegetable Lasagna', 'Chef''s Table Main'),
('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'Pepperoni Pizza', 'Pizza'),
('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'Mediterranean Grilled Chicken', 'Global Meats'),
('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000003', 'Beef Ragu', 'Global Meats'),
('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000003', 'Brownies', 'Bakery'),
('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000004', 'Blended Beef Burger Patty', 'Grill Main'),
('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000004', 'Black Bean Burger Patty', 'Grill Main'),
('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000004', 'Straight Cut Fries', 'Grill Side'),
('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000005', 'Chicken Salad', 'Deli Meat'),
('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000005', 'Tofu Pastrami', 'Deli Meat'),
('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000005', 'Sourdough Bread', 'Deli Bread')
on conflict (id) do nothing;
