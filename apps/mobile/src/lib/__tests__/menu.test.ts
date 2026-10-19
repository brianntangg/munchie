import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DISH_RESULTS, filterDishes, loadMenuItems, type MenuItem } from '../menu';

// Replace the Supabase client with a fake whose responses each test controls.
// Query methods record their arguments in mockQueryCall; awaiting a list query resolves to mockListResult().
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockQueryCall = jest.fn<(method: string, ...args: unknown[]) => void>();
const mockListResult = jest.fn<AsyncCall>();
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
  return { supabase: { from: (table: string) => { mockQueryCall('from', table); return query; } } };
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
