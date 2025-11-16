/**
 * Network Event Capturer Module
 *
 * Captures GA4 network events using Chrome DevTools Protocol (CDP).
 * Intercepts requests to analytics.google.com/g/collect and extracts
 * measurement ID, GTM ID, and event parameters.
 *
 * Epic 3: GA4/GTM Configuration Validation
 */

/**
 * Improved GA4 URL detection (inspired by Omnibug)
 * Matches analytics.google.com or www.google-analytics.com with /g/collect
 * while excluding false positives
 *
 * @param {string} url - URL to check
 * @returns {boolean} true if valid GA4 request
 */
function isGA4Request(url) {
  if (!url || typeof url !== 'string') return false;

  // Must contain /g/collect endpoint
  if (!url.includes('/g/collect')) return false;

  // Must be from valid GA4 domains
  // - analytics.google.com (primary GA4 domain)
  // - www.google-analytics.com (legacy domain, still used by some implementations)
  const isValidGA4Domain =
    url.includes('analytics.google.com') ||
    url.includes('www.google-analytics.com');

  if (!isValidGA4Domain) return false;

  // Exclude false positives (domains that also use /g/collect)
  if (url.includes('clarity.ms') ||
      url.includes('transcend.io') ||
      url.includes('doubleclick.net')) {
    return false;
  }

  return true;
}

/**
 * Start capturing network events using CDP + Page Evaluate (ENHANCED)
 *
 * CRITICAL FIX: Multi-layer GA4 detection
 * Issue: CDP Network.requestWillBeSent sometimes misses GA4 requests in brand sites
 * Solution: Add page.evaluate() to directly hook fetch/XHR + CDP for redundancy
 *
 * @param {Page} page - Playwright page instance
 * @returns {Promise<Array<NetworkEvent>>} Captured events array
 */
export async function startCapturing(page) {
  const capturedEvents = [];

  try {
    // Layer 1: Inject fetch/XHR hooks before page loads (most reliable for brand sites)
    await page.addInitScript(() => {
      window.__ga4Events = [];

      // Improved GA4 URL detection (inspired by Omnibug)
      // - Matches: analytics.google.com or www.google-analytics.com with /g/collect
      // - Excludes false positives: clarity.ms, transcend.io, doubleclick.net
      function isGA4Request(url) {
        if (!url || typeof url !== 'string') return false;

        // Must contain /g/collect endpoint
        if (!url.includes('/g/collect')) return false;

        // Must be from valid GA4 domains
        const isValidGA4Domain =
          url.includes('analytics.google.com') ||
          url.includes('www.google-analytics.com');

        if (!isValidGA4Domain) return false;

        // Exclude false positives (domains that also use /g/collect)
        if (url.includes('clarity.ms') ||
            url.includes('transcend.io') ||
            url.includes('doubleclick.net')) {
          return false;
        }

        return true;
      }

      // Hook fetch API
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const url = args[0];
        if (isGA4Request(url)) {
          window.__ga4Events.push({
            url: url,
            type: 'fetch',
            timestamp: Date.now()
          });
          console.log('[GA4 Fetch Hook] Captured:', url.substring(0, 100));
        }
        return originalFetch.apply(this, args);
      };

      // Hook XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this.__url = url;
        this.__method = method;
        return originalOpen.call(this, method, url, ...rest);
      };

      XMLHttpRequest.prototype.send = function(...args) {
        if (isGA4Request(this.__url)) {
          window.__ga4Events.push({
            url: this.__url,
            type: 'xhr',
            timestamp: Date.now()
          });
          console.log('[GA4 XHR Hook] Captured:', this.__url.substring(0, 100));
        }
        return originalSend.apply(this, args);
      };

      // Hook sendBeacon
      const originalBeacon = navigator.sendBeacon;
      navigator.sendBeacon = function(url, ...args) {
        if (isGA4Request(url)) {
          window.__ga4Events.push({
            url: url,
            type: 'beacon',
            timestamp: Date.now()
          });
          console.log('[GA4 Beacon Hook] Captured:', url.substring(0, 100));
        }
        return originalBeacon.call(this, url, ...args);
      };
    });

    // Layer 2: CDP Network monitoring (backup method)
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');

    client.on('Network.requestWillBeSent', (params) => {
      const url = params.request.url;

      // Capture GA4 collect requests
      if (isGA4Request(url)) {
        const event = {
          url,
          method: params.request.method,
          headers: params.request.headers,
          timestamp: params.timestamp,
          type: 'ga4_collect',
          params: parseGA4Params(url, params.request.postData),
          source: 'cdp'
        };

        capturedEvents.push(event);
        console.log(`  📡 Captured GA4 event (CDP): ${event.params.en || 'unknown'}`);
      }

      // Capture GTM requests
      if (url.includes('googletagmanager.com/gtm.js')) {
        const event = {
          url,
          method: params.request.method,
          timestamp: params.timestamp,
          type: 'gtm_load',
          params: parseGTMParams(url)
        };

        capturedEvents.push(event);
        console.log(`  🏷️ Captured GTM load: ${event.params.id || 'unknown'}`);
      }
    });

    console.log('📡 Network event capture started (CDP + Page Hooks)');
    return capturedEvents;

  } catch (error) {
    throw new Error(`Failed to start network capture: ${error.message}`);
  }
}

/**
 * Wait for GTM script to load (LAZY LOADER SUPPORT)
 *
 * Purpose: Detect GTM scripts that are loaded asynchronously after page load
 * Use case: Sites like innisfree.my that use lazy loading for GTM
 *
 * Detection Strategy:
 * 1. CDP Network monitoring (existing, line 105-116)
 * 2. MutationObserver for dynamically inserted <script> tags
 * 3. Polling for GTM-related objects in window (window.google_tag_manager, window.dataLayer)
 *
 * @param {Page} page - Playwright page instance
 * @param {Array<NetworkEvent>} capturedEvents - Events array from startCapturing (CDP Layer 2)
 * @param {string} expectedGTMId - Expected GTM Container ID from CSV (e.g., GTM-XXXXXX)
 * @param {number} timeoutMs - Maximum wait timeout in milliseconds (default: 30000ms)
 * @returns {Promise<Object>} { gtmDetected: boolean, gtmIds: Array<string>, timing: { detectionTimeMs: number|null, timedOut: boolean } }
 */
export async function waitForGTMLoad(page, capturedEvents, expectedGTMId, timeoutMs = 30000) {
  console.log(`⏳ Waiting for GTM script load: ${expectedGTMId || 'any'} (timeout: ${timeoutMs}ms)...`);

  const startTime = Date.now();
  const checkInterval = 500; // Check every 500ms
  let detectionTimeMs = null;

  // Inject MutationObserver to watch for dynamically inserted script tags
  try {
    await page.addInitScript(() => {
      window.__gtmScripts = [];

      // Watch for script tag insertions
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.tagName === 'SCRIPT') {
              const src = node.src || '';
              if (src.includes('googletagmanager.com/gtm.js')) {
                const gtmIdMatch = src.match(/id=(GTM-[A-Z0-9]+)/);
                if (gtmIdMatch) {
                  window.__gtmScripts.push({
                    id: gtmIdMatch[1],
                    src: src,
                    timestamp: Date.now()
                  });
                  console.log('[GTM MutationObserver] Detected GTM script:', gtmIdMatch[1]);
                }
              }
            }
          });
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    });
  } catch (error) {
    console.log(`  ⚠️ Failed to inject MutationObserver: ${error.message}`);
  }

  while (Date.now() - startTime < timeoutMs) {
    // Layer 1: Check CDP captured events
    const gtmEvents = capturedEvents.filter(e => e.type === 'gtm_load');
    const cdpGtmIds = gtmEvents.map(e => e.params.id).filter(Boolean);

    // Layer 2: Check MutationObserver captured scripts
    let mutationGtmIds = [];
    try {
      mutationGtmIds = await page.evaluate(() => {
        if (!window.__gtmScripts) return [];
        return window.__gtmScripts.map(s => s.id);
      });
    } catch (error) {
      // Page may not be ready yet
    }

    // Layer 3: Check for GTM and GA4 objects in window
    let windowGtmIds = [];
    let windowGa4Ids = [];
    try {
      const windowIds = await page.evaluate(() => {
        const gtmIds = [];
        const ga4Ids = [];

        // Check window.google_tag_manager
        if (window.google_tag_manager) {
          const gtm = window.google_tag_manager;
          // GTM stores container info in google_tag_manager object
          // GA4 measurement IDs also appear here when loaded via GTM
          Object.keys(gtm).forEach(key => {
            if (key.startsWith('GTM-')) {
              gtmIds.push(key);
            } else if (key.startsWith('G-')) {
              // Extract GA4 Measurement IDs (Story 11.1: Consent Mode support)
              ga4Ids.push(key);
            }
          });
        }

        // Check dataLayer for GTM info
        if (window.dataLayer && Array.isArray(window.dataLayer)) {
          window.dataLayer.forEach(item => {
            if (item && item['gtm.uniqueEventId']) {
              // GTM is active and processing events
              // Extract GTM ID from gtm.start event if available
              if (item.event === 'gtm.js' && item['gtm.uniqueEventId']) {
                // GTM is loaded, but ID might not be directly in dataLayer
                // This confirms GTM is active
              }
            }
          });
        }

        return { gtmIds, ga4Ids };
      });

      windowGtmIds = windowIds.gtmIds || [];
      windowGa4Ids = windowIds.ga4Ids || [];
    } catch (error) {
      // Page may not be ready yet
    }

    // Story 11.1: Add window-extracted GA4 IDs to capturedEvents as synthetic events
    // This enables GA4 ID detection even when Consent Mode blocks network events
    if (windowGa4Ids.length > 0) {
      windowGa4Ids.forEach(ga4Id => {
        // Check if this GA4 ID already exists in captured events to avoid duplicates
        const alreadyCaptured = capturedEvents.some(e =>
          e.type === 'ga4_collect' && e.params && e.params.tid === ga4Id
        );

        if (!alreadyCaptured) {
          // Create a synthetic GA4 event from window-extracted ID
          const syntheticEvent = {
            url: `https://www.google-analytics.com/g/collect?tid=${ga4Id}`,
            method: 'GET',
            headers: {},
            timestamp: Date.now() / 1000,
            type: 'ga4_collect',
            params: {
              tid: ga4Id,
              en: 'window_extracted' // Special event name to indicate source
            },
            source: 'window_extraction' // Mark as window-extracted for tracking
          };

          capturedEvents.push(syntheticEvent);
          console.log(`  📌 Added window-extracted GA4 ID to events: ${ga4Id}`);
        }
      });
    }

    // Combine all detected GTM IDs
    const allGtmIds = [...new Set([...cdpGtmIds, ...mutationGtmIds, ...windowGtmIds])];

    if (allGtmIds.length > 0) {
      detectionTimeMs = Date.now() - startTime;

      // Merge MutationObserver GTM events into capturedEvents for consistency
      for (const id of mutationGtmIds) {
        if (!capturedEvents.some(e => e.type === 'gtm_load' && e.params.id === id)) {
          capturedEvents.push({
            url: `https://www.googletagmanager.com/gtm.js?id=${id}`,
            method: 'GET',
            timestamp: Date.now() / 1000,
            type: 'gtm_load',
            params: { id },
            source: 'mutation_observer'
          });
        }
      }

      // Check if expected GTM ID is found
      const normalizedExpected = expectedGTMId ? expectedGTMId.trim().toUpperCase() : '';
      const expectedFound = allGtmIds.some(id =>
        id && id.trim().toUpperCase() === normalizedExpected
      );

      if (expectedFound) {
        console.log(`✅ GTM script loaded: ${expectedGTMId} (detected after ${detectionTimeMs}ms)`);
        if (allGtmIds.length > 1) {
          console.log(`   📊 Multiple GTM containers detected: ${allGtmIds.join(', ')}`);
        }

        // Story 11.1 Phase 2: Delayed re-check for GA4 IDs
        // Issue: GA4 containers may be added to window.google_tag_manager after GTM loads
        // Solution: Wait an additional 2 seconds and re-check for GA4 IDs
        console.log(`  ⏳ Waiting 2s for GA4 containers to load in window.google_tag_manager...`);
        await page.waitForTimeout(2000);

        try {
          const delayedWindowIds = await page.evaluate(() => {
            const ga4Ids = [];
            if (window.google_tag_manager) {
              const gtm = window.google_tag_manager;
              Object.keys(gtm).forEach(key => {
                if (key.startsWith('G-')) {
                  ga4Ids.push(key);
                }
              });
            }
            return { ga4Ids };
          });

          const delayedGa4Ids = delayedWindowIds.ga4Ids || [];

          if (delayedGa4Ids.length > 0) {
            console.log(`  📌 Delayed re-check found ${delayedGa4Ids.length} GA4 ID(s): ${delayedGa4Ids.join(', ')}`);

            // Add newly discovered GA4 IDs as synthetic events
            delayedGa4Ids.forEach(ga4Id => {
              const alreadyCaptured = capturedEvents.some(e =>
                e.type === 'ga4_collect' && e.params && e.params.tid === ga4Id
              );

              if (!alreadyCaptured) {
                const syntheticEvent = {
                  url: `https://www.google-analytics.com/g/collect?tid=${ga4Id}`,
                  method: 'GET',
                  headers: {},
                  timestamp: Date.now() / 1000,
                  type: 'ga4_collect',
                  params: {
                    tid: ga4Id,
                    en: 'window_extracted' // Special event name to indicate source
                  },
                  source: 'window_extraction' // Mark as window-extracted for tracking
                };

                capturedEvents.push(syntheticEvent);
                console.log(`  📌 Added delayed window-extracted GA4 ID: ${ga4Id}`);
              }
            });
          } else {
            console.log(`  ℹ️ No additional GA4 IDs found in delayed re-check`);
          }
        } catch (error) {
          console.log(`  ⚠️ Delayed re-check failed: ${error.message}`);
        }

        return {
          gtmDetected: true,
          gtmIds: allGtmIds,
          timing: {
            detectionTimeMs,
            timedOut: false
          }
        };
      } else if (!expectedGTMId) {
        // No expected GTM ID specified, return any GTM found
        console.log(`✅ GTM script(s) loaded: ${allGtmIds.join(', ')} (detected after ${detectionTimeMs}ms)`);

        // Story 11.1 Phase 2: Delayed re-check for GA4 IDs
        console.log(`  ⏳ Waiting 2s for GA4 containers to load in window.google_tag_manager...`);
        await page.waitForTimeout(2000);

        try {
          const delayedWindowIds = await page.evaluate(() => {
            const ga4Ids = [];
            if (window.google_tag_manager) {
              const gtm = window.google_tag_manager;
              Object.keys(gtm).forEach(key => {
                if (key.startsWith('G-')) {
                  ga4Ids.push(key);
                }
              });
            }
            return { ga4Ids };
          });

          const delayedGa4Ids = delayedWindowIds.ga4Ids || [];

          if (delayedGa4Ids.length > 0) {
            console.log(`  📌 Delayed re-check found ${delayedGa4Ids.length} GA4 ID(s): ${delayedGa4Ids.join(', ')}`);

            delayedGa4Ids.forEach(ga4Id => {
              const alreadyCaptured = capturedEvents.some(e =>
                e.type === 'ga4_collect' && e.params && e.params.tid === ga4Id
              );

              if (!alreadyCaptured) {
                const syntheticEvent = {
                  url: `https://www.google-analytics.com/g/collect?tid=${ga4Id}`,
                  method: 'GET',
                  headers: {},
                  timestamp: Date.now() / 1000,
                  type: 'ga4_collect',
                  params: {
                    tid: ga4Id,
                    en: 'window_extracted'
                  },
                  source: 'window_extraction'
                };

                capturedEvents.push(syntheticEvent);
                console.log(`  📌 Added delayed window-extracted GA4 ID: ${ga4Id}`);
              }
            });
          } else {
            console.log(`  ℹ️ No additional GA4 IDs found in delayed re-check`);
          }
        } catch (error) {
          console.log(`  ⚠️ Delayed re-check failed: ${error.message}`);
        }

        return {
          gtmDetected: true,
          gtmIds: allGtmIds,
          timing: {
            detectionTimeMs,
            timedOut: false
          }
        };
      } else {
        // Expected GTM ID not found yet, continue waiting
        console.log(`  📊 GTM detected but expected ID ${expectedGTMId} not found yet. Detected: ${allGtmIds.join(', ')}`);
      }
    }

    // Wait before next check
    await page.waitForTimeout(checkInterval);
  }

  // Timeout reached
  const allGtmIds = extractAllGTMIds(capturedEvents);
  console.log(`⚠️ GTM wait timeout reached after ${timeoutMs}ms`);
  if (allGtmIds.length > 0) {
    console.log(`   📊 Detected GTM IDs: ${allGtmIds.join(', ')} (expected: ${expectedGTMId || 'any'})`);
  } else {
    console.log(`   ℹ️ No GTM scripts detected`);
  }

  return {
    gtmDetected: allGtmIds.length > 0,
    gtmIds: allGtmIds,
    timing: {
      detectionTimeMs,
      timedOut: true
    }
  };
}

/**
 * Wait for GA4 events to be captured (ENHANCED - Multi-layer detection with smart exit on expected ID)
 *
 * CRITICAL FIX (Option 3): Wait specifically for page_view event
 * Issue: Crawler returned on first GA4 event (e.g., view_promotion at 3s)
 *        but page_view event arrived later (e.g., at 5s), causing false negatives
 * Solution: Poll for page_view event specifically, not just any GA4 event
 *
 * CRITICAL FIX (Multi-layer): Retrieve events from both CDP and page hooks
 * Issue: Brand sites may block CDP Network.requestWillBeSent in headless mode
 * Solution: Periodically retrieve events from window.__ga4Events (page hooks) and merge with CDP events
 *
 * CRITICAL FIX (Dynamic GA4 - Smart Exit): Exit immediately when expected ID is found
 * Issue: Sites with dynamic/conditional GA4 loading send multiple GA4 IDs
 *        Waiting fixed time (10s) is inefficient when expected ID arrives earlier
 * Solution: After detecting page_view, continue capturing ONLY until expected ID is found, then exit immediately
 *
 * @param {Page} page - Playwright page instance
 * @param {Array<NetworkEvent>} capturedEvents - Events array from startCapturing (CDP Layer 2)
 * @param {string} expectedMeasurementId - Expected GA4 Measurement ID from CSV
 * @param {number} timeoutMs - Maximum wait timeout in milliseconds
 * @param {number} maxWaitAfterPageViewMs - Maximum wait time after page_view if expected ID not found (default: 15000ms)
 * @returns {Promise<Object>} { events: Array, timing: { detectionTimeMs: number|null, timedOut: boolean } }
 */
export async function waitForGA4Events(page, capturedEvents, expectedMeasurementId, timeoutMs = 60000, maxWaitAfterPageViewMs = 15000) {
  console.log(`⏳ Waiting for page_view event and expected ID: ${expectedMeasurementId} (timeout: ${timeoutMs}ms)...`);

  const startTime = Date.now();
  const checkInterval = 500; // Check every 500ms
  let lastEventCount = 0;
  let detectionTimeMs = null;
  let pageViewDetectedAt = null; // Track when page_view was first detected

  while (Date.now() - startTime < timeoutMs) {
    // Layer 1: Retrieve events from page hooks (window.__ga4Events)
    try {
      const pageHookEvents = await page.evaluate(() => {
        if (!window.__ga4Events) return [];
        const events = [...window.__ga4Events];
        window.__ga4Events = []; // Clear to avoid duplicates
        return events;
      });

      // Convert page hook events to capturedEvents format
      for (const hookEvent of pageHookEvents) {
        // Check for duplicates (same URL already captured by CDP)
        const isDuplicate = capturedEvents.some(e => e.url === hookEvent.url);

        if (!isDuplicate && isGA4Request(hookEvent.url)) {
          const event = {
            url: hookEvent.url,
            method: 'GET',
            headers: {},
            timestamp: hookEvent.timestamp / 1000, // Convert to seconds
            type: 'ga4_collect',
            params: parseGA4Params(hookEvent.url),
            source: hookEvent.type // 'fetch', 'xhr', or 'beacon'
          };

          capturedEvents.push(event);
          console.log(`  📡 Captured GA4 event (${hookEvent.type}): ${event.params.en || 'unknown'}`);
        }
      }
    } catch (error) {
      // Page may not be ready yet, continue
      console.log(`  ⚠️ Failed to retrieve page hook events: ${error.message}`);
    }

    // Check specifically for page_view event
    const pageViewEvent = capturedEvents.find(e =>
      e.type === 'ga4_collect' && e.params.en === 'page_view'
    );

    // Check if expected ID is present in captured events
    const allMeasurementIds = extractAllMeasurementIds(capturedEvents);
    const expectedIdFound = allMeasurementIds.includes(expectedMeasurementId);

    if (pageViewEvent && !pageViewDetectedAt) {
      // page_view event detected for the first time!
      pageViewDetectedAt = Date.now();
      detectionTimeMs = pageViewDetectedAt - startTime;
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
      console.log(`✅ page_view event detected (${ga4Events.length} total GA4 events after ${detectionTimeMs}ms)`);

      // Check if expected ID is already present
      if (expectedIdFound) {
        const totalWaitTime = Date.now() - startTime;
        console.log(`✅ Expected ID ${expectedMeasurementId} found! Exiting immediately after ${totalWaitTime}ms.`);

        if (allMeasurementIds.length > 1) {
          console.log(`   📊 Multiple GA4 IDs detected: ${allMeasurementIds.join(', ')}`);
        }

        return {
          events: capturedEvents,
          timing: {
            detectionTimeMs,
            timedOut: false
          }
        };
      }

      console.log(`   ⏰ Expected ID ${expectedMeasurementId} not found yet, continuing to capture (max ${maxWaitAfterPageViewMs}ms)...`);
    }

    // If page_view was detected and expected ID just arrived, exit immediately
    if (pageViewDetectedAt && expectedIdFound) {
      const totalWaitTime = Date.now() - startTime;
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');

      console.log(`✅ Expected ID ${expectedMeasurementId} found after ${totalWaitTime}ms! Exiting immediately.`);
      if (allMeasurementIds.length > 1) {
        console.log(`   📊 Multiple GA4 IDs detected: ${allMeasurementIds.join(', ')}`);
      }

      return {
        events: capturedEvents,
        timing: {
          detectionTimeMs,
          timedOut: false
        }
      };
    }

    // Check if we should exit after maximum wait time (fallback if expected ID never arrives)
    if (pageViewDetectedAt && (Date.now() - pageViewDetectedAt >= maxWaitAfterPageViewMs)) {
      const totalWaitTime = Date.now() - startTime;
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');

      console.log(`⚠️ Max wait time reached after ${totalWaitTime}ms. Expected ID ${expectedMeasurementId} not found.`);
      console.log(`   📊 Detected IDs: ${allMeasurementIds.join(', ') || 'None'}`);

      return {
        events: capturedEvents,
        timing: {
          detectionTimeMs,
          timedOut: false // page_view was found, just not expected ID
        }
      };
    }

    // Show progress - log other GA4 events detected but still waiting for page_view
    const currentEventCount = capturedEvents.length;
    if (currentEventCount !== lastEventCount) {
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
      const otherEvents = ga4Events.filter(e => e.params.en !== 'page_view');

      if (otherEvents.length > 0) {
        // Count events by name (각 이벤트는 개별적으로 카운트)
        const eventCounts = {};
        otherEvents.forEach(e => {
          const name = e.params.en || 'unknown';
          eventCounts[name] = (eventCounts[name] || 0) + 1;
        });
        const eventSummary = Object.entries(eventCounts)
          .map(([name, count]) => count > 1 ? `${name}(${count})` : name)
          .join(', ');
        console.log(`  📊 Events captured: ${currentEventCount} total (${ga4Events.length} GA4, waiting for page_view. Other events: ${eventSummary})`);
      } else {
        console.log(`  📊 Events captured: ${currentEventCount} (no page_view yet)`);
      }
      lastEventCount = currentEventCount;
    }

    // Wait before next check
    await page.waitForTimeout(checkInterval);
  }

  // Timeout reached
  const totalEvents = capturedEvents.length;
  const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
  const otherGA4Events = ga4Events.filter(e => e.params.en !== 'page_view');

  // Count events by name (각 이벤트는 개별적으로 카운트)
  const eventCounts = {};
  otherGA4Events.forEach(e => {
    const name = e.params.en || 'unknown';
    eventCounts[name] = (eventCounts[name] || 0) + 1;
  });
  const eventSummary = Object.entries(eventCounts)
    .map(([name, count]) => count > 1 ? `${name}(${count})` : name)
    .join(', ');

  console.log(`⚠️ Timeout reached: ${totalEvents} total events, ${ga4Events.length} GA4 events (no page_view found)`);
  if (otherGA4Events.length > 0) {
    console.log(`  ℹ️ Other GA4 events detected: ${eventSummary}`);
  }

  return {
    events: capturedEvents,
    timing: {
      detectionTimeMs: null, // No page_view detected
      timedOut: true
    }
  };
}

/**
 * Parse GA4 URL parameters
 *
 * @param {string} url - GA4 collect URL
 * @returns {Object} Parsed parameters
 */
function parseGA4Params(url, postData) {
  try {
    const urlObj = new URL(url);
    const params = {};

    // Extract common GA4 parameters from URL query
    params.v = urlObj.searchParams.get('v');           // Protocol version
    params.tid = urlObj.searchParams.get('tid');       // Measurement ID
    params.gtm = urlObj.searchParams.get('gtm');       // GTM ID
    params.en = urlObj.searchParams.get('en');         // Event name (URL에서 먼저 확인)
    params.dl = urlObj.searchParams.get('dl');         // Document location
    params.dt = urlObj.searchParams.get('dt');         // Document title
    params.sid = urlObj.searchParams.get('sid');       // Session ID
    params.cid = urlObj.searchParams.get('cid');       // Client ID

    // Extract custom parameters (ep.*) from URL
    const customParams = {};
    urlObj.searchParams.forEach((value, key) => {
      if (key.startsWith('ep.')) {
        const paramName = key.substring(3);
        customParams[paramName] = value;
      }
    });

    // Parse POST data if available (GA4는 주로 POST body에 이벤트 데이터 전송)
    if (postData) {
      try {
        // POST data는 URL-encoded 형식: en=page_view&ep.site_env=PRD&...
        const postParams = new URLSearchParams(postData);

        // Override with POST data (POST body가 더 정확한 데이터)
        if (postParams.get('en')) params.en = postParams.get('en');
        if (postParams.get('tid')) params.tid = postParams.get('tid');
        if (postParams.get('dl')) params.dl = postParams.get('dl');
        if (postParams.get('dt')) params.dt = postParams.get('dt');
        if (postParams.get('sid')) params.sid = postParams.get('sid');
        if (postParams.get('cid')) params.cid = postParams.get('cid');

        // Extract custom parameters from POST data
        postParams.forEach((value, key) => {
          if (key.startsWith('ep.')) {
            const paramName = key.substring(3);
            customParams[paramName] = value;
          }
        });
      } catch (postError) {
        console.error('Failed to parse POST data:', postError.message);
      }
    }

    if (Object.keys(customParams).length > 0) {
      params.customParams = customParams;
    }

    return params;

  } catch (error) {
    console.error('Failed to parse GA4 params:', error.message);
    return {};
  }
}

/**
 * Parse GTM URL parameters
 *
 * @param {string} url - GTM load URL
 * @returns {Object} Parsed parameters
 */
function parseGTMParams(url) {
  try {
    const urlObj = new URL(url);
    const params = {};

    // Extract GTM container ID from URL path
    // Format: /gtm.js?id=GTM-XXXXXX
    params.id = urlObj.searchParams.get('id');
    params.l = urlObj.searchParams.get('l');           // Data layer name
    params.gtm_auth = urlObj.searchParams.get('gtm_auth');
    params.gtm_preview = urlObj.searchParams.get('gtm_preview');

    return params;

  } catch (error) {
    console.error('Failed to parse GTM params:', error.message);
    return {};
  }
}

/**
 * Extract ALL measurement IDs from captured events (supports multiple GA4)
 *
 * @param {Array<NetworkEvent>} events - Captured network events
 * @returns {Array<string>} Array of unique measurement IDs
 */
export function extractAllMeasurementIds(events) {
  const ga4Events = events.filter(e => e.type === 'ga4_collect');

  if (ga4Events.length === 0) {
    return [];
  }

  // Extract all unique measurement IDs
  const measurementIds = ga4Events
    .map(e => e.params.tid)
    .filter(Boolean); // Remove null/undefined

  // Remove duplicates
  return [...new Set(measurementIds)];
}

/**
 * Extract measurement IDs with their extraction source information
 * Story 11.1 Phase 3: Track extraction source for metrics
 *
 * @param {Array<NetworkEvent>} events - Captured network events
 * @returns {Object} Extraction metrics including IDs and sources
 */
export function extractMeasurementIdsWithSource(events) {
  const ga4Events = events.filter(e => e.type === 'ga4_collect');

  if (ga4Events.length === 0) {
    return {
      allIds: [],
      sources: {
        window: [],
        network: [],
        mixed: []
      },
      metrics: {
        totalFound: 0,
        windowExtracted: 0,
        networkExtracted: 0,
        primarySource: null
      }
    };
  }

  // Group IDs by source
  const idsBySource = new Map();
  ga4Events.forEach(event => {
    if (event.params && event.params.tid) {
      const tid = event.params.tid;
      const source = event.source || 'network'; // Default to network if no source

      if (!idsBySource.has(tid)) {
        idsBySource.set(tid, new Set());
      }
      idsBySource.get(tid).add(source);
    }
  });

  // Categorize IDs by their extraction source(s)
  const sources = {
    window: [],
    network: [],
    mixed: []
  };

  idsBySource.forEach((sourcesSet, tid) => {
    const sourcesArray = Array.from(sourcesSet);

    if (sourcesArray.includes('window_extraction')) {
      if (sourcesArray.length > 1) {
        sources.mixed.push(tid); // Found in both window and network
      } else {
        sources.window.push(tid); // Window-only
      }
    } else {
      sources.network.push(tid); // Network-only
    }
  });

  const allIds = Array.from(idsBySource.keys());

  // Determine primary extraction source
  let primarySource = null;
  if (sources.window.length > 0 || sources.mixed.length > 0) {
    primarySource = 'window'; // Window extraction succeeded
  } else if (sources.network.length > 0) {
    primarySource = 'network'; // Only network extraction
  }

  return {
    allIds,
    sources,
    metrics: {
      totalFound: allIds.length,
      windowExtracted: sources.window.length + sources.mixed.length,
      networkExtracted: sources.network.length + sources.mixed.length,
      primarySource
    }
  };
}

/**
 * Detect Consent Mode Basic scenario
 *
 * Detects when GTM is loaded but GA4 is not exposed in window.google_tag_manager
 * and no network events are captured. This indicates Consent Mode Basic is blocking
 * all GA4 activity until user consent.
 *
 * IMPORTANT: Only returns true if property is configured to use Consent Mode.
 * This prevents false positives for properties where GA4 is simply not configured.
 *
 * @param {Object} context - Detection context
 * @param {boolean} context.hasGTM - Whether GTM container is loaded
 * @param {boolean} context.hasGA4InWindow - Whether GA4 ID exists as window.google_tag_manager key
 * @param {Array} context.networkEvents - Captured network events
 * @param {string} context.expectedGA4Id - Expected GA4 measurement ID
 * @param {boolean} context.propertyHasConsentMode - Whether property uses Consent Mode (from database)
 * @returns {Object} Detection result
 */
export function detectConsentModeBasic(context) {
  const result = {
    isConsentModeBasic: false,
    confidence: 'low',
    indicators: [],
    ga4Configured: false,
    message: null
  };

  // Only detect Consent Mode if property is configured to use it
  if (!context.propertyHasConsentMode) {
    result.indicators.push('Property not configured for Consent Mode');
    result.message = 'Consent Mode detection skipped (property does not use Consent Mode)';
    return result;
  }

  // Check if GTM is loaded but GA4 is not in window
  if (context.hasGTM && !context.hasGA4InWindow) {
    result.indicators.push('GTM present without GA4 in window');

    // Check if there are no GA4 network events
    const ga4NetworkEvents = context.networkEvents.filter(event =>
      event.params && event.params.tid && event.params.tid === context.expectedGA4Id
    );

    if (ga4NetworkEvents.length === 0) {
      result.indicators.push('No GA4 network events detected');
      result.indicators.push('Property uses Consent Mode');
      result.confidence = 'high';

      // This strongly indicates Consent Mode Basic
      result.isConsentModeBasic = true;
      result.ga4Configured = true; // GA4 is configured in GTM but blocked by Consent Mode
      result.message = 'GA4 appears to be configured in GTM but blocked by Consent Mode Basic';
    } else {
      // Some GA4 events found - might be Consent Mode Advanced
      result.indicators.push('Some GA4 network activity detected');
      result.confidence = 'medium';
      result.message = 'Possible Consent Mode Advanced (cookieless pings detected)';
    }
  } else if (context.hasGTM && context.hasGA4InWindow) {
    result.indicators.push('GA4 properly exposed in window');
    result.message = 'Normal GA4 implementation detected';
  } else if (!context.hasGTM) {
    result.indicators.push('GTM not detected');
    result.message = 'No GTM container found';
  }

  return result;
}

/**
 * Check if expected measurement ID exists in events
 *
 * @param {Array<NetworkEvent>} events - Captured network events
 * @param {string} expectedId - Expected measurement ID
 * @returns {Object} { found: boolean, allIds: Array<string>, primaryId: string|null }
 */
export function findMeasurementId(events, expectedId) {
  const allIds = extractAllMeasurementIds(events);

  return {
    found: allIds.includes(expectedId),
    allIds,
    primaryId: allIds[0] || null // First (primary) ID
  };
}

/**
 * Extract measurement ID from captured events (backward compatibility)
 * Returns the first measurement ID found
 *
 * @param {Array<NetworkEvent>} events - Captured network events
 * @returns {string|null} Measurement ID or null
 */
export function extractMeasurementId(events) {
  const allIds = extractAllMeasurementIds(events);
  return allIds[0] || null;
}

/**
 * Extract ALL GTM container IDs from captured events (supports multiple GTM)
 *
 * @param {Array<NetworkEvent>} events - Captured network events
 * @returns {Array<string>} Array of unique GTM container IDs
 */
export function extractAllGTMIds(events) {
  const gtmEvents = events.filter(e => e.type === 'gtm_load');

  if (gtmEvents.length === 0) {
    return [];
  }

  // Extract all unique GTM IDs
  const gtmIds = gtmEvents
    .map(e => e.params.id)
    .filter(Boolean); // Remove null/undefined

  // Remove duplicates
  return [...new Set(gtmIds)];
}

/**
 * Check if expected GTM ID exists in events
 *
 * @param {Array<NetworkEvent>} events - Captured network events
 * @param {string} expectedId - Expected GTM container ID
 * @returns {Object} { found: boolean, allIds: Array<string>, primaryId: string|null }
 */
export function findGTMId(events, expectedId) {
  const allIds = extractAllGTMIds(events);

  // Normalize expected ID for comparison (trim whitespace, case-insensitive)
  const normalizedExpected = expectedId ? expectedId.trim().toUpperCase() : '';

  // Check if expected ID exists in collected IDs (case-insensitive, trimmed)
  const found = allIds.some(id =>
    id && id.trim().toUpperCase() === normalizedExpected
  );

  return {
    found,
    allIds,
    primaryId: allIds[0] || null // First (primary) ID
  };
}

/**
 * Extract GTM container ID from captured events (backward compatibility)
 * Returns the first GTM ID found
 *
 * @param {Array<NetworkEvent>} events - Captured network events
 * @returns {string|null} GTM container ID or null
 */
export function extractGTMId(events) {
  const allIds = extractAllGTMIds(events);
  return allIds[0] || null;
}

/**
 * Find page_view event in captured events
 *
 * @param {Array<NetworkEvent>} events - Captured network events
 * @returns {NetworkEvent|null} page_view event or null
 */
export function findPageViewEvent(events) {
  const pageViewEvent = events.find(e =>
    e.type === 'ga4_collect' &&
    e.params.en === 'page_view'
  );

  return pageViewEvent || null;
}

/**
 * Extract AP_DATA custom parameter from events
 *
 * @param {Array<NetworkEvent>} events - Captured network events
 * @returns {Object|null} AP_DATA object or null
 */
export function extractAPData(events) {
  for (const event of events) {
    if (event.type === 'ga4_collect' && event.params.customParams) {
      const apDataStr = event.params.customParams.AP_DATA;

      if (apDataStr) {
        try {
          const apData = JSON.parse(apDataStr);
          return apData;
        } catch (error) {
          console.error('Failed to parse AP_DATA:', error.message);
        }
      }
    }
  }

  return null;
}

/**
 * Get event summary for logging
 *
 * @param {Array<NetworkEvent>} events - Captured network events
 * @returns {Object} Event summary
 */
export function getEventSummary(events) {
  const ga4Events = events.filter(e => e.type === 'ga4_collect');
  const gtmEvents = events.filter(e => e.type === 'gtm_load');

  const eventNames = [...new Set(
    ga4Events.map(e => e.params.en).filter(Boolean)
  )];

  return {
    totalEvents: events.length,
    ga4Events: ga4Events.length,
    gtmEvents: gtmEvents.length,
    eventNames,
    hasPageView: eventNames.includes('page_view')
  };
}

/**
 * Detect if a website uses Google Consent Mode - Story 10.2
 *
 * Checks for consent mode implementation through multiple detection methods:
 * 1. dataLayer consent events (consent_default, consent_update)
 * 2. gtag consent API calls
 * 3. Common Consent Management Platform (CMP) scripts
 *
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if Consent Mode is detected
 */
export async function detectConsentMode(page) {
  try {
    const hasConsentMode = await page.evaluate(() => {
      // Check 1: dataLayer consent events
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        const hasConsentEvent = window.dataLayer.some(item => {
          if (!item) return false;

          // Check for consent event objects
          if (item.event === 'consent_update' || item.event === 'consent_default') {
            return true;
          }

          // Check for gtag consent command arrays: ['consent', 'default', {...}] or ['consent', 'update', {...}]
          if (Array.isArray(item) && item[0] === 'consent' && (item[1] === 'default' || item[1] === 'update')) {
            return true;
          }

          return false;
        });

        if (hasConsentEvent) {
          console.log('🍪 Consent Mode detected via dataLayer consent events');
          return true;
        }
      }

      // Check 2: gtag consent configuration in window object
      if (window.gtag && typeof window.gtag === 'function') {
        // Check if gtag has been called with consent commands
        // This is a heuristic check - gtag consent calls are often detectable via dataLayer
        console.log('🍪 gtag API found, likely supports Consent Mode');
      }

      // Check 3: Common Consent Management Platform (CMP) scripts
      const consentPlatforms = [
        'Cookiebot',           // window.Cookiebot
        'OneTrust',            // window.OneTrust or window.OptanonWrapper
        'CookieFirst',         // window.CookieFirst
        'Iubenda',             // window._iub
        'cookieconsent',       // window.cookieconsent (generic)
        'CookieConsent',       // window.CookieConsent
        'TrustArc',            // window.TrustArc
        'Osano',               // window.Osano
        'TermsFeed'            // window.TermsFeed
      ];

      for (const platform of consentPlatforms) {
        if (window[platform] || window[`_${platform.toLowerCase()}`]) {
          console.log(`🍪 Consent Mode detected via ${platform} CMP`);
          return true;
        }
      }

      // Check for common CMP-related DOM elements
      const cmpSelectors = [
        '#CybotCookiebotDialog',           // Cookiebot
        '#onetrust-consent-sdk',           // OneTrust
        '.cookiefirst-root',               // CookieFirst
        '#iubenda-cs-banner',              // Iubenda
        '.cc-window',                      // Cookie Consent
        '#truste-consent-track'            // TrustArc
      ];

      for (const selector of cmpSelectors) {
        if (document.querySelector(selector)) {
          console.log(`🍪 Consent Mode detected via CMP element: ${selector}`);
          return true;
        }
      }

      return false;
    });

    console.log(`🍪 Consent Mode detection result: ${hasConsentMode}`);
    return hasConsentMode;
  } catch (error) {
    console.error('[detectConsentMode] Error detecting Consent Mode:', error);
    return false; // Default to false on error
  }
}

export default {
  startCapturing,
  waitForGA4Events,
  waitForGTMLoad,
  extractMeasurementId,
  extractGTMId,
  extractAllMeasurementIds,
  extractMeasurementIdsWithSource,  // Story 11.1 Phase 3: Extraction source tracking
  extractAllGTMIds,
  findMeasurementId,
  findGTMId,
  findPageViewEvent,
  extractAPData,
  getEventSummary,
  detectConsentMode  // Story 10.2: Consent Mode auto-detection
};
