import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function deleteAllScreenshots() {
  console.log('🗑️  Starting to delete all screenshots...\n');

  try {
    // List all files
    console.log('📊 Listing all files in screenshots bucket...');
    const { data: files, error: listError } = await supabase
      .storage
      .from('screenshots')
      .list('', {
        limit: 10000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (listError) {
      console.error('❌ Error listing files:', listError);
      return;
    }

    if (!files || files.length === 0) {
      console.log('✅ No files found in bucket');
      return;
    }

    console.log(`📦 Found ${files.length} files`);
    const totalSize = files.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
    console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);

    // Delete files in batches
    const batchSize = 100;
    let deletedCount = 0;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const filePaths = batch.map(f => f.name);

      console.log(`🗑️  Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)} (${filePaths.length} files)...`);

      const { error } = await supabase
        .storage
        .from('screenshots')
        .remove(filePaths);

      if (error) {
        console.error(`❌ Error:`, error);
      } else {
        deletedCount += filePaths.length;
        console.log(`✅ Deleted ${filePaths.length} files`);
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Total deleted: ${deletedCount} files`);

    // Delete database records
    console.log('\n🗑️  Deleting database records...');
    const { error: dbError } = await supabase
      .from('screenshots')
      .delete()
      .not('id', 'is', null);

    if (dbError) {
      console.error('❌ Database error:', dbError);
    } else {
      console.log('✅ Database records deleted');
    }

    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

deleteAllScreenshots();
