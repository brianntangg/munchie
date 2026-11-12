import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { exactDish, labelTypedDishes, loadMenuItems, loadPopularDishes, POPULAR_FETCH, starterDishes, suggestDishes, SUGGESTION_COUNT, type MenuItem } from '../menu';

// Replace the Supabase client with a fake whose responses each test controls.
// Query methods record their arguments in mockQueryCall; awaiting a list query resolves to mockListResult().
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockQueryCall = jest.fn<(method: string, ...args: unknown[]) => void>();
const mockListResult = jest.fn<AsyncCall>();
const mockRpc = jest.fn<AsyncCall>();
jest.mock('../supabase', () => {
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockListResult().then(resolve, reject),
  };
  for (const method of ['select', 'eq', 'order']) {
    query[method] = (...args: unknown[]) => {
      mockQueryCall(method, ...args);
      return query;
    };
  }
  return { supabase: { from: (table: string) => { mockQueryCall('from', table); return query; }, rpc: (...args: unknown[]) => mockRpc(...args) } };
});
const queryCalls = (method: string) => mockQueryCall.mock.calls.filter(([name]) => name === method).map(([, ...args]) => args);

const dish = (id: string, name: string, category: string | null = null): MenuItem => ({ id, name, category });

beforeEach(() => {
  jest.resetAllMocks();
  mockListResult.mockResolvedValue({ data: [], error: null });
});

describe('loadMenuItems', () => {
  it("reads one hall's dishes ordered by station, then name", async () => {
    const rows = [dish('1', 'Achiote Chicken', 'Fresh Mex Main')];
    mockListResult.mockResolvedValue({ data: rows, error: null });
    await expect(loadMenuItems('hall-1')).resolves.toBe(rows);
    expect(queryCalls('from')).toEqual([['menu_items']]);
    expect(queryCalls('eq')).toEqual([['dining_hall_id', 'hall-1']]);
    expect(queryCalls('order')).toEqual([['category'], ['name']]);
  });

  it('returns an empty list for a hall with no dishes', async () => {
    await expect(loadMenuItems('hall-1')).resolves.toEqual([]);
  });

  it('throws the database error', async () => {
    const failure = new Error('permission denied');
    mockListResult.mockResolvedValue({ data: null, error: failure });
    await expect(loadMenuItems('hall-1')).rejects.toBe(failure);
  });
});

describe('suggestDishes', () => {
  const menu = [dish('1', 'Spicy Chicken Wrap', 'Grill'), dish('2', 'Chicken Tenders', 'Fryer'), dish('3', 'Rotisserie Chicken', 'Carvery'), dish('4', 'Chickpea Salad', 'Salad Bar'), dish('5', 'Beef Burger', 'Grill'), dish('6', 'Mac and Cheese')];

  it('offers three dishes by default', () => {
    expect(SUGGESTION_COUNT).toBe(3);
    expect(suggestDishes(menu, 'chick').shown).toHaveLength(3);
  });

  it('puts names that start with the search first, then names with a word that starts with it, then the rest', () => {
    expect(suggestDishes(menu, 'chick', 10).shown.map((item) => item.id)).toEqual(['2', '4', '1', '3']);
  });

  it('keeps menu order among equally good matches', () => {
    expect(suggestDishes(menu, 'ch', 10).shown.map((item) => item.id)).toEqual(['2', '4', '1', '3', '6']);
  });

  it('ranks a station-only match last', () => {
    expect(suggestDishes(menu, 'grill', 10).shown.map((item) => item.id)).toEqual(['1', '5']);
    expect(suggestDishes(menu, 'ham', 10).shown.map((item) => item.id)).toEqual([]);
    expect(suggestDishes([dish('7', 'Pasta', 'Chicken Station'), dish('8', 'Roast Chicken')], 'chicken', 10).shown.map((item) => item.id)).toEqual(['8', '7']);
  });

  it('ignores case and surrounding spaces, and reports the full match count', () => {
    const result = suggestDishes(menu, '  CHICK ');
    expect(result.total).toBe(4);
    expect(result.shown.map((item) => item.id)).toEqual(['2', '4', '1']);
  });

  it('suggests nothing until something is typed, and nothing when nothing matches', () => {
    expect(suggestDishes(menu, '')).toEqual({ shown: [], total: 0 });
    expect(suggestDishes(menu, '   ')).toEqual({ shown: [], total: 0 });
    expect(suggestDishes(menu, 'pizza')).toEqual({ shown: [], total: 0 });
    expect(suggestDishes([], 'chick')).toEqual({ shown: [], total: 0 });
  });
});

describe('loadPopularDishes', () => {
  it("asks the database for one hall's most-rated dishes", async () => {
    const rows = [dish('1', 'Achiote Chicken', 'Fresh Mex Main')];
    mockRpc.mockResolvedValue({ data: rows, error: null });
    await expect(loadPopularDishes('hall-1')).resolves.toBe(rows);
    expect(mockRpc).toHaveBeenCalledWith('popular_dishes', { hall_id: 'hall-1', max_results: POPULAR_FETCH });
  });

  it('throws the database error', async () => {
    const failure = new Error('permission denied');
    mockRpc.mockResolvedValue({ data: null, error: failure });
    await expect(loadPopularDishes('hall-1')).rejects.toBe(failure);
  });
});

describe('starterDishes', () => {
  const popular = [dish('1', 'A'), dish('2', 'B'), dish('3', 'C'), dish('4', 'D'), dish('5', 'E')];

  const ids = (result: { shown: MenuItem[] }) => result.shown.map((item) => item.id);

  it('offers the first three popular dishes, in popularity order, and says they are popular', () => {
    expect(starterDishes(popular, popular)).toEqual({ shown: popular.slice(0, 3), popular: true });
  });

  it('skips dishes that are no longer available, such as ones already chosen for another photo', () => {
    expect(ids(starterDishes(popular, popular.filter((item) => item.id !== '2')))).toEqual(['1', '3', '4']);
  });

  it('offers fewer popular dishes when fewer are left', () => {
    expect(starterDishes(popular, [dish('5', 'E'), dish('9', 'Z')])).toEqual({ shown: [dish('5', 'E')], popular: true });
  });

  it('falls back to the first menu dishes, not called popular, when no dish has been rated', () => {
    const menu = [dish('7', 'Pizza'), dish('8', 'Salad'), dish('9', 'Soup'), dish('10', 'Tacos')];
    expect(starterDishes([], menu)).toEqual({ shown: menu.slice(0, 3), popular: false });
  });

  it('falls back to the menu when every popular dish is already chosen for another photo', () => {
    expect(starterDishes([dish('1', 'A')], [dish('2', 'B')])).toEqual({ shown: [dish('2', 'B')], popular: false });
  });

  it('offers nothing when the menu is empty', () => {
    expect(starterDishes([], [])).toEqual({ shown: [], popular: false });
  });
});

describe('exactDish', () => {
  const menu = [dish('1', 'Achiote Chicken'), dish('2', 'Cilantro-Lime Rice'), dish('3', 'Pizza'), dish('4', 'Pizza')];

  it('finds the dish named exactly what was typed, ignoring case and spacing', () => {
    expect(exactDish(menu, 'achiote chicken')).toEqual(menu[0]);
    expect(exactDish(menu, '  Cilantro-Lime   Rice ')).toEqual(menu[1]);
  });

  it('finds nothing for a partial name, an empty string, or a name two dishes share', () => {
    expect(exactDish(menu, 'Achiote')).toBeNull();
    expect(exactDish(menu, '   ')).toBeNull();
    expect(exactDish(menu, 'pizza')).toBeNull();
  });
});

describe('labelTypedDishes', () => {
  const chicken = dish('1', 'Achiote Chicken');
  const rice = dish('2', 'Cilantro-Lime Rice');
  const photo = (id: string, text: string, score: number | null, picked: MenuItem | null = null) => ({ id, dish: picked, text, score });

  it('turns a typed exact menu name into that dish, keeping its score so it counts as a rating', () => {
    expect(labelTypedDishes([photo('a', 'achiote chicken', 4)], [chicken, rice])).toEqual([photo('a', '', 4, chicken)]);
  });

  it('keeps free text that is not a menu name, and photos already tagged with a dish', () => {
    const photos = [photo('a', "Grandma's soup", 5), photo('b', '', 3, rice)];
    expect(labelTypedDishes(photos, [chicken, rice])).toEqual(photos);
  });

  it('never tags a dish twice: a dish already on another photo, or named by an earlier one, stays text', () => {
    const photos = [photo('a', '', 2, chicken), photo('b', 'Achiote Chicken', 4), photo('c', 'cilantro-lime rice', 5), photo('d', 'Cilantro-Lime Rice', 1)];
    expect(labelTypedDishes(photos, [chicken, rice])).toEqual([photos[0], photos[1], photo('c', '', 5, rice), photos[3]]);
  });
});
