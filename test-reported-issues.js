import { chromium } from 'playwright';
import { startCapturing, waitForGA4Events, extractAllMeasurementIds } from './src/modules/networkEventCapturer.js';
import { validateProperty } from './src/modules/configValidator.js';

const TEST_SITES = [
  {
    name: 'Illiyoon',
    url: 'https://www.illiyoon.com/',
    issue: 'timeout 이슈 없는데 이슈 확인',
    expectedMeasurementIds: []
  },
  {
    name: 'Innisfree KR',
    url: 'https://www.innisfree.com/kr/ko/',
    issue: 'GA4 이벤트 발생하는데 page_view 없다고 전달',
    expectedMeasurementIds: []
  },
  {
    name: 'Sulwhasoo US',
    url: 'https://us.sulwhasoo.com/',
    issue: '2개 이상 GA4 존재하는데 첫번째만 확인',
    expectedMeasurementIds: []
  }
];

async function testSite(site) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${site.name}`);
  console.log(`URL: ${site.url}`);
  console.log(`Reported Issue: ${site.issue}`);
  console.log('='.repeat(80));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    // Start capturing network events
    console.log('\n📡 Starting network event capture...');
    const capturedEvents = await startCapturing(page);

    // Navigate to page
    console.log(`🌐 Navigating to ${site.url}...`);
    const navigationPromise = page.goto(site.url, {
      timeout: 60000,
      waitUntil: 'domcontentloaded'
    });

    const navResult = await Promise.race([
      navigationPromise.then(() => ({ success: true })),
      new Promise(resolve => setTimeout(() => resolve({ success: false, reason: 'timeout' }), 60000))
    ]);

    if (!navResult.success) {
      console.log('❌ Navigation timeout occurred');
      return { error: 'Navigation timeout', details: navResult };
    }

    console.log('✅ Page loaded successfully');

    // Wait for GA4 events (pass capturedEvents array and undefined for expectedMeasurementId, 60000 for timeout like production)
    console.log('\n⏳ Waiting for GA4 events (60 seconds like production)...');
    const result = await waitForGA4Events(page, capturedEvents, undefined, 60000);
    const events = result.events || capturedEvents;
    console.log(`📨 Captured ${events.length} GA4 event(s)`);

    // Extract all measurement IDs from captured events
    console.log('\n🔍 Extracting measurement IDs from events...');
    const measurementIds = extractAllMeasurementIds(events);
    console.log(`Found ${measurementIds.length} measurement ID(s):`, measurementIds);

    // Check for page_view events
    const pageViewEvents = events.filter(e =>
      e.event_name === 'page_view' ||
      e.eventName === 'page_view' ||
      (e.params && e.params.event_name === 'page_view')
    );
    console.log(`📄 Found ${pageViewEvents.length} page_view event(s)`);

    if (events.length > 0) {
      console.log('\n📋 Event Summary:');
      const eventCounts = {};
      events.forEach(e => {
        const eventName = e.event_name || e.eventName || (e.params?.event_name) || 'unknown';
        eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;
      });
      Object.entries(eventCounts).forEach(([name, count]) => {
        console.log(`   ${name}: ${count}`);
      });
    }

    // Run validation for each measurement ID
    if (measurementIds.length > 0) {
      console.log('\n🔍 Running validation for each measurement ID...\n');

      for (const [index, measurementId] of measurementIds.entries()) {
        console.log(`\n--- Validation ${index + 1}/${measurementIds.length}: ${measurementId} ---`);

        const property = {
          name: `${site.name} - ${measurementId}`,
          url: site.url,
          measurementId: measurementId,
          hasConsentMode: false
        };

        const validationResult = validateProperty(property, events);

        console.log(`   Is Valid: ${validationResult.isValid}`);
        console.log(`   Severity: ${validationResult.severity}`);

        if (validationResult.issues && validationResult.issues.length > 0) {
          console.log(`   Issues (${validationResult.issues.length}):`);
          validationResult.issues.forEach((issue, i) => {
            console.log(`      ${i + 1}. ${issue}`);
          });
        } else {
          console.log(`   ✅ No issues found`);
        }
      }
    } else {
      console.log('\n⚠️  No measurement IDs found - cannot run validation');
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('Summary:');
    console.log(`   Measurement IDs: ${measurementIds.length}`);
    console.log(`   Total Events: ${events.length}`);
    console.log(`   Page View Events: ${pageViewEvents.length}`);
    console.log(`   Navigation: ${navResult.success ? 'Success' : 'Failed'}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error during test:');
    console.error(error.message);
    console.error(error.stack);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runAllTests() {
  for (const site of TEST_SITES) {
    await testSite(site);
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

console.log('\n🧪 Starting Issue Reproduction Tests');
console.log('Testing reported issues from user\n');

runAllTests()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:');
    console.error(error);
    process.exit(1);
  });
