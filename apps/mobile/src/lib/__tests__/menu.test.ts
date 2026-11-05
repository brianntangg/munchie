import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DISH_RESULTS, filterDishes, loadMenuItems, loadPopularDishes, POPULAR_FETCH, starterDishes, suggestDishes, SUGGESTION_COUNT, type MenuItem } from '../menu';

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

describe('filterDishes', () => {
  const menu = [dish('1', 'Achiote Chicken', 'Fresh Mex Main'), dish('2', 'Beef Lasagna', "Chef's Table Main"), dish('3', 'Brownies', 'Bakery'), dish('4', 'Soup')];

  it('matches the name regardless of case', () => {
    expect(filterDishes(menu, 'LASAGNA').shown.map((item) => item.id)).toEqual(['2']);
  });

  it('matches the station too', () => {
    expect(filterDishes(menu, 'main').shown.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('ignores surrounding spaces, and a blank search shows the first dishes', () => {
    expect(filterDishes(menu, '  brown  ').shown.map((item) => item.id)).toEqual(['3']);
    expect(filterDishes(menu, '   ').total).toBe(4);
  });

  it('copes with a dish that has no station', () => {
    expect(filterDishes(menu, 'soup').shown.map((item) => item.id)).toEqual(['4']);
    expect(filterDishes(menu, 'null').total).toBe(0);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterDishes(menu, 'pizza')).toEqual({ shown: [], total: 0 });
    expect(filterDishes([], '')).toEqual({ shown: [], total: 0 });
  });

  it('caps what is shown but reports the full match count', () => {
    const many = Array.from({ length: 30 }, (_, i) => dish(String(i), `Dish ${i}`));
    const result = filterDishes(many, '');
    expect(result.shown).toHaveLength(DISH_RESULTS);
    expect(result.total).toBe(30);
    expect(filterDishes(many, '', 3).shown.map((item) => item.id)).toEqual(['0', '1', '2']);
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

  it('offers the first three popular dishes, in popularity order', () => {
    expect(starterDishes(popular, popular).map((item) => item.id)).toEqual(['1', '2', '3']);
  });

  it('skips dishes that are no longer available, such as ones already chosen for another photo', () => {
    expect(starterDishes(popular, popular.filter((item) => item.id !== '2')).map((item) => item.id)).toEqual(['1', '3', '4']);
  });

  it('offers fewer when fewer are left, and none when none are popular', () => {
    expect(starterDishes(popular, [dish('5', 'E')]).map((item) => item.id)).toEqual(['5']);
    expect(starterDishes([], popular)).toEqual([]);
  });
});
