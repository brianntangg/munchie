// Static placeholder data for the prototype. Replace with Supabase queries later.

export type Meal = 'breakfast' | 'lunch' | 'dinner';

export type DiningHall = {
  id: string;
  name: string;
  hours: Record<Meal, string>;
  rating: number;
  menu: string[];
};

export type User = {
  id: string;
  name: string;
  handle: string;
  isFriend: boolean;
};

export type Comment = { id: string; userId: string; text: string };

export type Post = {
  id: string;
  userId: string;
  hallId: string;
  meal: Meal;
  dish: string;
  emoji: string;
  tint: string;
  caption: string;
  rating: number;
  likes: number;
  minutesAgo: number;
  comments: Comment[];
};

export const MEAL_WINDOWS: Record<Meal, { label: string; start: number; end: number }> = {
  breakfast: { label: 'Breakfast', start: 7, end: 10.5 },
  lunch: { label: 'Lunch', start: 11, end: 14 },
  dinner: { label: 'Dinner', start: 17, end: 20 },
};

export function currentMeal(date = new Date()): Meal | null {
  const hour = date.getHours() + date.getMinutes() / 60;
  const match = (Object.keys(MEAL_WINDOWS) as Meal[]).find(
    (meal) => hour >= MEAL_WINDOWS[meal].start && hour < MEAL_WINDOWS[meal].end,
  );
  return match ?? null;
}

export const currentUser: User = { id: 'me', name: 'Demo Student', handle: 'demo', isFriend: false };

export const users: User[] = [
  { id: 'u1', name: 'Brian Tang', handle: 'briant', isFriend: true },
  { id: 'u2', name: 'David Lee', handle: 'dlee', isFriend: true },
  { id: 'u3', name: 'Tevin Park', handle: 'tevinp', isFriend: true },
  { id: 'u4', name: 'Maya Chen', handle: 'mayac', isFriend: false },
  { id: 'u5', name: 'Jordan Ellis', handle: 'jellis', isFriend: false },
  { id: 'u6', name: 'Priya Shah', handle: 'priyas', isFriend: false },
];

export const diningHalls: DiningHall[] = [
  {
    id: 'rand',
    name: 'Rand Dining Center',
    hours: { breakfast: '7:00–10:30', lunch: '11:00–2:00', dinner: 'Closed' },
    rating: 4.1,
    menu: ['Grill: cheeseburgers', 'Mongolian stir fry', 'Salad bar', 'Soup of the day'],
  },
  {
    id: 'commons',
    name: 'Commons Dining',
    hours: { breakfast: '7:00–10:30', lunch: '11:00–2:00', dinner: '5:00–8:00' },
    rating: 3.8,
    menu: ['Pasta station', 'Rotisserie chicken', 'Vegan bowls', 'Waffle bar'],
  },
  {
    id: 'ebi',
    name: 'EBI Dining',
    hours: { breakfast: '7:00–10:30', lunch: '11:00–2:00', dinner: '5:00–8:00' },
    rating: 4.3,
    menu: ['Farm-to-table plate', 'Pizza', 'Omelet station'],
  },
  {
    id: 'rothschild',
    name: 'Rothschild Dining',
    hours: { breakfast: '7:00–10:30', lunch: '11:00–2:00', dinner: '5:00–8:00' },
    rating: 4.0,
    menu: ['Tacos', 'Deli', 'Stir fry'],
  },
  {
    id: 'kissam',
    name: 'Kissam Kitchen',
    hours: { breakfast: 'Closed', lunch: '11:00–2:00', dinner: '5:00–8:00' },
    rating: 3.6,
    menu: ['Burrito bowls', 'Grain bowls', 'Sushi'],
  },
];

export const posts: Post[] = [
  {
    id: 'p1',
    userId: 'u1',
    hallId: 'ebi',
    meal: 'lunch',
    dish: 'Herb chicken & roasted veggies',
    emoji: '🍗',
    tint: '#F6E3C8',
    caption: 'EBI is carrying today, no line either',
    rating: 5,
    likes: 12,
    minutesAgo: 8,
    comments: [
      { id: 'c1', userId: 'u2', text: 'omw' },
      { id: 'c2', userId: 'u3', text: 'save me a seat' },
    ],
  },
  {
    id: 'p2',
    userId: 'u4',
    hallId: 'rand',
    meal: 'lunch',
    dish: 'Mongolian stir fry',
    emoji: '🍜',
    tint: '#E3EEDC',
    caption: 'Line is long but worth it',
    rating: 4,
    likes: 7,
    minutesAgo: 21,
    comments: [],
  },
  {
    id: 'p3',
    userId: 'u2',
    hallId: 'commons',
    meal: 'breakfast',
    dish: 'Waffles with berries',
    emoji: '🧇',
    tint: '#F9EBD0',
    caption: 'Waffle bar is back!!',
    rating: 4,
    likes: 19,
    minutesAgo: 190,
    comments: [{ id: 'c3', userId: 'u1', text: 'finally' }],
  },
  {
    id: 'p4',
    userId: 'u5',
    hallId: 'kissam',
    meal: 'lunch',
    dish: 'Burrito bowl',
    emoji: '🌯',
    tint: '#F3DDD6',
    caption: 'Rice was a little dry today',
    rating: 2,
    likes: 3,
    minutesAgo: 34,
    comments: [],
  },
  {
    id: 'p5',
    userId: 'u3',
    hallId: 'rothschild',
    meal: 'breakfast',
    dish: 'Veggie omelet',
    emoji: '🍳',
    tint: '#FFF3C4',
    caption: 'Classic',
    rating: 4,
    likes: 5,
    minutesAgo: 240,
    comments: [],
  },
];

export const findUser = (id: string) => (id === currentUser.id ? currentUser : users.find((u) => u.id === id));
export const findHall = (id: string) => diningHalls.find((h) => h.id === id);
export const findPost = (id: string) => posts.find((p) => p.id === id);

export function timeAgo(minutes: number) {
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
