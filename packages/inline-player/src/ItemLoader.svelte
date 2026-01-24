<script lang="ts">
    
    import { 
        buildEventListenersMap as createEventListenersMap,
        extractPassageMarkup,
        fetchItemData,
        type ItemData,
        initializePiePlayer,loadPieModule, 
        type PiePlayerConfig} from '@pie-players/pie-players-shared';
import { onMount } from 'svelte';

    export let itemId: string;
    export let token: string;
    export let apiBaseUrl: string;

    // TEST/DEBUG: Loader mode to simulate fixed-player behavior
    export let loaderMode: 'inline' | 'fixed' = 'inline';
    export let bundleUrl: string = '';

    // Optional pass-through props similar to pie-player
    export let env: any = { mode: 'gather', role: 'student' };
    export let session: any[] = [];
    export let addCorrectResponse: boolean = false;
    export let externalStyleUrls: string = '';
    export let customClassname: string = '';
    export let containerClass: string = '';
    export let passageContainerClass: string = '';

    const dispatch = <T = any>(type: 'session-changed' | 'player-error' | 'load-complete', detail?: T) =>
        dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));

    let passageContainerClassAttr: string = '';
    let itemContainerClassAttr: string = '';

    $: passageContainerClassAttr = [
        'passage-container',
        customClassname || '',
        passageContainerClass || ''
    ].filter(Boolean).join(' ');

    $: itemContainerClassAttr = [
        'item-container',
        customClassname || '',
        containerClass || ''
    ].filter(Boolean).join(' ');

    let passageMarkup: string | null = null;
    let playerEl: HTMLElement | null = null;
    let scripts: HTMLScriptElement[] = [];
    let loadedData: ItemData | null = null;

    let controller: AbortController | null = null;

    const injectInlineBundle = (js: string, id: string) => {
        if (!js) return null;
        // Create a Blob URL so the bundle has a concrete URL (fixes publicPath in some bundlers)
        const blob = new Blob([js], { type: 'application/javascript' });
        const src = URL.createObjectURL(blob);
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.defer = true;
        document.head.appendChild(script);
        return src;
    };

    const loadBundle = async (js: string, id: string, config: any) => {
        const src = injectInlineBundle(js, id);
        if (!src) throw new Error('Inline PIE bundle missing');
        const eventListeners = createEventListenersMap(config, (detail: any) => dispatch('session-changed', detail));
        await loadPieModule(config, session, { bundleUrl: src, env, eventListeners });
    };

    const loadBundleFromUrl = async (url: string) => {
        if (!url) throw new Error('Bundle URL is required in fixed mode');
        const script = document.createElement('script');
        script.src = url;
        script.type = 'module';
        script.dataset.pieBundle = 'true';
        document.head.appendChild(script);
        scripts.push(script);
        await new Promise<void>((resolve, reject) => {
            script.addEventListener('load', () => resolve());
            script.addEventListener('error', () => reject(new Error(`Failed to load bundle from ${url}`)));
        });
    };

    const loadData = async () => {
        try {
            controller = new AbortController();

            // MODE: 'fixed' - Simulates pie-fixed-player (for testing)
            if (loaderMode === 'fixed') {
                console.log('[ItemLoader] 🧪 FIXED MODE - Simulating pie-fixed-player behavior');
                
                // 1. Pre-load bundles globally (like fixed-player package does)
                if (bundleUrl) {
                    await loadBundleFromUrl(bundleUrl);
                    console.log('[ItemLoader] Bundle pre-loaded from:', bundleUrl);
                }

                // 2. Fetch data-only (no bundles in response, like fixed-player)
                const itemData: ItemData = await fetchItemData(
                    apiBaseUrl,
                    itemId,
                    token,
                    'data-only',
                    env,
                    addCorrectResponse,
                    controller.signal
                );

                // 3. Extract passage markup
                passageMarkup = extractPassageMarkup(itemData);

                // 4. Store data for reactive initialization
                loadedData = itemData;

                console.log('[ItemLoader] ✅ Fixed mode data loaded');
                return itemData;
            }
            // MODE: 'inline' - Standard inline behavior (default)
            else {
                console.log('[ItemLoader] 📦 INLINE MODE - Standard behavior (fetch bundles via API)');

                // 1. Fetch packaged data (includes bundles)
                const packagedData: any = await fetchItemData(
                    apiBaseUrl,
                    itemId,
                    token,
                    'packaged',
                    env,
                    addCorrectResponse,
                    controller.signal
                );

                // 2. Load bundles dynamically
                if (packagedData.itemBundleJs && packagedData.item?.config) {
                    await loadBundle(packagedData.itemBundleJs, `pie-bundle-item-${itemId}`, packagedData.item.config);
                } else if (packagedData.item?.config) {
                    throw new Error('Item inline bundle missing in packaged response');
                }
                if (packagedData.passageBundleJs && packagedData.passage?.config) {
                    await loadBundle(packagedData.passageBundleJs, `pie-bundle-passage-${itemId}`, packagedData.passage.config);
                } else if (packagedData.passage?.config) {
                    throw new Error('Passage inline bundle missing in packaged response');
                }

                // 3. Convert to ItemData format
                const itemData: ItemData = {
                    item: packagedData.item,
                    passage: packagedData.passage
                };

                // 4. Extract passage markup
                passageMarkup = extractPassageMarkup(itemData);

                // 5. Store data for reactive initialization
                loadedData = itemData;

                console.log('[ItemLoader] ✅ Inline mode data loaded');
                return itemData;
            }
        } catch (e: any) {
            console.error('[ItemLoader] ❌ Error loading PIE item data:', e);
            dispatch('player-error', e?.message || String(e));
            throw e; // Re-throw to be caught by the #await block
        }
    };

    // Reactive: Initialize player when element is bound AND data is loaded
    $: if (playerEl && loadedData?.item?.config) {
        console.log('[ItemLoader] 🎯 Player element bound, initializing...');
        const config: PiePlayerConfig = {
            env,
            addCorrectResponse,
            session,
            externalStyleUrls,
            customClassname,
            containerClass,
            passageContainerClass
        };

        initializePiePlayer(loadedData, config, {
            playerEl,
            passageMarkup
        }).then(() => {
            console.log('[ItemLoader] ✅ Player initialized successfully');
            dispatch('load-complete');
        }).catch((e: any) => {
            console.error('[ItemLoader] ❌ Error initializing PIE player:', e);
            dispatch('player-error', e?.message || String(e));
        });
    }

    onMount(() => {
            return () => {
            scripts.forEach((s) => s.remove());
                if (controller) {
                    controller.abort();
                    controller = null;
                }
        };
    });

    // A promise that resolves when the data is loaded.
    const loadingPromise = loadData();
</script>

{#await loadingPromise}
    <p>Loading item...</p>
{:then}
    {#if passageMarkup}
        <div class="{passageContainerClassAttr}">
            {@html passageMarkup}
        </div>
    {/if}

    <div class="{itemContainerClassAttr}">
        <pie-player bind:this={playerEl} class={customClassname}></pie-player>
    </div>
{:catch error}
    <p style="color: red;">Error: {error.message}</p>
{/await}
