import supabase from './src/utils/supabase.js';

async function checkAestura() {
  const { data: results } = await supabase
    .from('crawl_results')
    .select('*')
    .eq('property_id', 'a0fee807-6322-4db5-84a7-e4502ea57c21')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!results || results.length === 0) {
    console.log('No results');
    return;
  }

  console.log(JSON.stringify(results[0], null, 2));
}

checkAestura();
