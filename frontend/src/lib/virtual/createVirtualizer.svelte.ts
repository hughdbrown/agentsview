import {
  Virtualizer,
  type VirtualizerOptions,
  observeElementOffset,
  observeElementRect,
  elementScroll,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from "@tanstack/virtual-core";

type PartialKeys<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

// itemSizeCache is private in TanStack Virtual's types but
// we need it to transfer measurements across recreations.
type SizeCache = Map<string | number, number>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSizeCache(v: any): SizeCache {
  return v?.itemSizeCache as SizeCache;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setSizeCache(v: any, cache: SizeCache) {
  v.itemSizeCache = cache;
}

type ElementOpts = PartialKeys<
  VirtualizerOptions<HTMLElement, HTMLElement>,
  | "observeElementOffset"
  | "observeElementRect"
  | "scrollToFn"
> & { measureCacheKey?: unknown };

type WindowOpts = PartialKeys<
  VirtualizerOptions<Window, HTMLElement>,
  | "observeElementOffset"
  | "observeElementRect"
  | "scrollToFn"
  | "getScrollElement"
> & { measureCacheKey?: unknown };

export function createVirtualizer(
  optsFn: () => ElementOpts,
) {
  let instance:
    | Virtualizer<HTMLElement, HTMLElement>
    | undefined = undefined;
  let notifyPending = false;
  let lastMeasureCacheKey: unknown = undefined;

  // TanStack Virtual emits onChange with the same instance
  // reference. Track a version token so consumers re-read
  // instance without recreating proxy objects.
  let _version = $state(0);

  function bumpVersion() {
    if (notifyPending) return;
    notifyPending = true;
    setTimeout(() => {
      notifyPending = false;
      _version++;
    }, 0);
  }

  function handleOnChange(
    vInst: Virtualizer<HTMLElement, HTMLElement>,
    sync: boolean,
    onChange: ElementOpts["onChange"] | undefined,
  ) {
    instance = vInst;
    if (sync) {
      bumpVersion();
    } else {
      _version++;
    }
    onChange?.(vInst, sync);
  }

  $effect(() => {
    const opts = optsFn();
    const scrollEl = opts.getScrollElement?.() ?? null;
    const initialOffset =
      instance?.scrollOffset ??
      scrollEl?.scrollTop ??
      0;

    const resolvedOpts: VirtualizerOptions<
      HTMLElement,
      HTMLElement
    > = {
      observeElementOffset,
      observeElementRect,
      scrollToFn: elementScroll,
      ...opts,
      initialOffset,
      onChange: (
        vInst: Virtualizer<HTMLElement, HTMLElement>,
        sync: boolean,
      ) => {
        handleOnChange(vInst, sync, opts.onChange);
      },
    };

    if (!instance) {
      const v = new Virtualizer(resolvedOpts);
      instance = v;
      lastMeasureCacheKey = opts.measureCacheKey;
      v._willUpdate();
      return () => {
        v._willUpdate();
      };
    }

    // Preserve measurement cache only for the same logical list.
    if (opts.measureCacheKey !== lastMeasureCacheKey) {
      setSizeCache(instance, new Map());
    }
    lastMeasureCacheKey = opts.measureCacheKey;

    // Update options in-place to avoid Virtualizer recreation churn.
    instance.setOptions(resolvedOpts);
    instance._willUpdate();

    // Guard against browser clamp after large count changes.
    if (scrollEl && scrollEl.scrollTop > 0) {
      instance.scrollToOffset(scrollEl.scrollTop);
    }

    return () => {
      instance?._willUpdate();
    };
  });

  return {
    get instance() {
      _version;
      return instance;
    },
  };
}

export function createWindowVirtualizer(
  optsFn: () => WindowOpts,
) {
  let instance:
    | Virtualizer<Window, HTMLElement>
    | undefined = undefined;
  let notifyPending = false;
  let lastMeasureCacheKey: unknown = undefined;
  let _version = $state(0);

  function bumpVersion() {
    if (notifyPending) return;
    notifyPending = true;
    setTimeout(() => {
      notifyPending = false;
      _version++;
    }, 0);
  }

  function handleOnChange(
    vInst: Virtualizer<Window, HTMLElement>,
    sync: boolean,
    onChange: WindowOpts["onChange"] | undefined,
  ) {
    instance = vInst;
    if (sync) {
      bumpVersion();
    } else {
      _version++;
    }
    onChange?.(vInst, sync);
  }

  $effect(() => {
    const opts = optsFn();
    const initialOffset =
      instance?.scrollOffset ?? 0;

    const resolvedOpts: VirtualizerOptions<
      Window,
      HTMLElement
    > = {
      observeElementOffset: observeWindowOffset,
      observeElementRect: observeWindowRect,
      scrollToFn: windowScroll,
      getScrollElement: () => window,
      ...opts,
      initialOffset,
      onChange: (
        vInst: Virtualizer<Window, HTMLElement>,
        sync: boolean,
      ) => {
        handleOnChange(vInst, sync, opts.onChange);
      },
    };

    if (!instance) {
      const v = new Virtualizer(resolvedOpts);
      instance = v;
      lastMeasureCacheKey = opts.measureCacheKey;
      v._willUpdate();
      return () => {
        v._willUpdate();
      };
    }

    if (opts.measureCacheKey !== lastMeasureCacheKey) {
      setSizeCache(instance, new Map());
    }
    lastMeasureCacheKey = opts.measureCacheKey;

    instance.setOptions(resolvedOpts);
    instance._willUpdate();

    return () => {
      instance?._willUpdate();
    };
  });

  return {
    get instance() {
      _version;
      return instance;
    },
  };
}
