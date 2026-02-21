<script lang="ts">
  import { createVirtualizer, createWindowVirtualizer } from './createVirtualizer.svelte.js';

  interface Props {
    type: 'element' | 'window';
    options: any;
    onInstanceChange: (inst: any) => void;
  }

  let { type, options, onInstanceChange } = $props();

  let currentOptions = $state(options);

  $effect(() => {
    currentOptions = options;
  });

  const virtualizer = type === 'window'
    ? createWindowVirtualizer(() => currentOptions)
    : createVirtualizer(() => currentOptions);

  $effect(() => {
    onInstanceChange(virtualizer.instance);
  });

  export function getVirtualizer() {
    return virtualizer;
  }

  export function setOptions(opts: any) {
    currentOptions = opts;
  }
</script>
