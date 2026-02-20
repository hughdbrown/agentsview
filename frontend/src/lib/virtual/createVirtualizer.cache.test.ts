// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, unmount, tick } from 'svelte';
// @ts-ignore
import CacheTestWrapper from './CacheTestWrapper.svelte';

// Shared state to capture created Virtualizer instances
const { createdInstances } = vi.hoisted(() => ({ 
  createdInstances: [] as any[] 
}));

vi.mock('@tanstack/virtual-core', async () => {
  const original = await vi.importActual<typeof import('@tanstack/virtual-core')>('@tanstack/virtual-core');
  
  class MockVirtualizer {
    options: any;
    itemSizeCache: Map<any, any> | undefined;

    constructor(opts: any) {
      this.options = opts;
      createdInstances.push(this);
    }

    setOptions(opts: any) {
      this.options = opts;
    }

    _willUpdate() {}
  }

  return {
    ...original,
    Virtualizer: MockVirtualizer,
    observeElementOffset: vi.fn(),
    observeElementRect: vi.fn(),
    elementScroll: vi.fn(),
    observeWindowOffset: vi.fn(),
    observeWindowRect: vi.fn(),
    windowScroll: vi.fn(),
  };
});

describe('createVirtualizer cache invalidation', () => {
  beforeEach(() => {
    createdInstances.length = 0;
    vi.clearAllMocks();
  });

  const types = ['element', 'window'] as const;

  types.forEach((type) => {
    describe(`${type} virtualizer`, () => {
      it('preserves cache when measureCacheKey remains the same', async () => {
        const onInstanceChange = vi.fn();
        const controller = { 
          initialOptions: { measureCacheKey: 'session-1', count: 10 },
          updateOptions: undefined as any
        };

        const component = mount(CacheTestWrapper, {
          target: document.body,
          props: {
            type,
            controller,
            onInstanceChange
          }
        });

        await tick();

        expect(createdInstances).toHaveLength(1);
        const firstInstance = createdInstances[0];
        
        // Simulate measurement accumulation
        firstInstance.itemSizeCache = new Map([['0', 50], ['1', 60]]);

        // Update with same key
        controller.updateOptions({ measureCacheKey: 'session-1', count: 20 });
        await tick();

        expect(createdInstances).toHaveLength(1);
        const sameInstance = createdInstances[0];
        expect(sameInstance.options.count).toBe(20);
        expect(sameInstance.itemSizeCache).toBeDefined();
        expect(sameInstance.itemSizeCache.get('0')).toBe(50);
        expect(sameInstance.itemSizeCache.get('1')).toBe(60);

        unmount(component);
      });

      it('clears cache when measureCacheKey changes', async () => {
        const onInstanceChange = vi.fn();
        const controller = { 
          initialOptions: { measureCacheKey: 'session-1', count: 10 },
          updateOptions: undefined as any
        };

        const component = mount(CacheTestWrapper, {
          target: document.body,
          props: {
            type,
            controller,
            onInstanceChange
          }
        });

        await tick();

        expect(createdInstances).toHaveLength(1);
        const firstInstance = createdInstances[0];
        
        // Simulate measurement accumulation
        firstInstance.itemSizeCache = new Map([['0', 50], ['1', 60]]);

        // Update with DIFFERENT key
        controller.updateOptions({ measureCacheKey: 'session-2', count: 10 });
        await tick();

        expect(createdInstances).toHaveLength(1);
        const sameInstance = createdInstances[0];
        expect(sameInstance.options.count).toBe(10);
        expect(sameInstance.itemSizeCache).toBeDefined();
        expect(sameInstance.itemSizeCache.size).toBe(0);

        unmount(component);
      });
    });
  });
});
