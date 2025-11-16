import supabase from './src/utils/supabase.js';

async function deleteAllScreenshots() {
  console.log('🗑️  Starting to delete all screenshots from Supabase Storage...\n');

  try {
    // List all files in the screenshots bucket
    const { data: files, error: listError } = await supabase
      .storage
      .from('screenshots')
      .list('', {
        limit: 10000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (listError) {
      console.error('❌ Error listing files:', listError.message);
      return;
    }

    if (!files || files.length === 0) {
      console.log('✅ No screenshots found in storage');
      return;
    }

    console.log(`📊 Found ${files.length} files in storage`);
    console.log(`📦 Total size: ${(files.reduce((acc, f) => acc + (f.metadata?.size || 0), 0) / 1024 / 1024).toFixed(2)} MB\n`);

    // Delete files in batches of 100 (Supabase limit)
    const batchSize = 100;
    let deletedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const filePaths = batch.map(f => f.name);

      console.log(`🗑️  Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)} (${filePaths.length} files)...`);

      const { data, error } = await supabase
        .storage
        .from('screenshots')
        .remove(filePaths);

      if (error) {
        console.error(`❌ Error deleting batch: ${error.message}`);
        errorCount += filePaths.length;
      } else {
        deletedCount += filePaths.length;
        console.log(`✅ Deleted ${filePaths.length} files`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Successfully deleted: ${deletedCount} files`);
    if (errorCount > 0) {
      console.log(`❌ Failed to delete: ${errorCount} files`);
    }

    // Also delete screenshot records from database
    console.log('\n🗑️  Deleting screenshot records from database...');
    const { error: dbError, count } = await supabase
      .from('screenshots')
      .delete()
      .not('id', 'is', null);

    if (dbError) {
      console.error('❌ Error deleting database records:', dbError.message);
    } else {
      console.log(`✅ Deleted all screenshot records from database`);
    }

    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

deleteAllScreenshots();
