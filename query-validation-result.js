import supabase from './src/utils/supabase.js';

async function queryResult() {
  const { data, error } = await supabase
    .from('crawl_results')
    .select('*')
    .eq('id', 'b9252111-cc4a-4f2b-8e22-7eeb0762a6c3')
    .single();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

queryResult();
