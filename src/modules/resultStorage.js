/**
 * Result Storage Module
 *
 * Handles saving validation results as JSON, capturing screenshots,
 * and managing file cleanup.
 *
 * Epic 4: Result Storage & Screenshot Management
 */

import fs from 'fs/promises';

/**
 * Save validation result as JSON file
 *
 * @param {ValidationResult} result - Validation result
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {Promise<string>} File path
 */
export async function saveValidationResult(result, dateStr) {
  try {
    // Create date folder
    const resultFolder = `results/${dateStr}`;
    await fs.mkdir(resultFolder, { recursive: true });

    // Generate filename
    const filename = `${result.slug}.json`;
    const filePath = `${resultFolder}/${filename}`;

    // Save JSON with pretty print
    const jsonContent = JSON.stringify(result, null, 2);
    await fs.writeFile(filePath, jsonContent, 'utf-8');

    console.log(`  💾 Result saved: ${filePath}`);
    return filePath;

  } catch (error) {
    console.error(`  ❌ Failed to save result: ${error.message}`);
    throw error;
  }
}

/**
 * Save fullPage screenshot
 *
 * @param {Page} page - Playwright page instance
 * @param {string} propertySlug - Property slug for filename
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {Promise<string|null>} Screenshot path or null if failed
 */
export async function saveScreenshot(page, propertySlug, dateStr) {
  try {
    // Create date folder
    const screenshotFolder = `screenshots/${dateStr}`;
    await fs.mkdir(screenshotFolder, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .split('.')[0];
    const filename = `${propertySlug}_${timestamp}.jpg`;
    const filePath = `${screenshotFolder}/${filename}`;

    // Capture fullPage screenshot
    await page.screenshot({
      fullPage: true,
      path: filePath,
      type: 'jpeg',
      quality: 60
    });

    // Check file size
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > 10) {
      console.log(`  ⚠️ Screenshot size: ${fileSizeMB.toFixed(2)}MB (>10MB)`);
    }

    console.log(`  📸 Screenshot saved: ${filePath} (${fileSizeMB.toFixed(2)}MB)`);
    return filePath;

  } catch (error) {
    console.error(`  ❌ Failed to save screenshot: ${error.message}`);
    return null;
  }
}


/**
 * Cleanup old files (results and screenshots)
 *
 * @param {string} basePath - Base directory path
 * @param {number} retentionDays - Days to retain files
 * @returns {Promise<Object>} Cleanup summary
 */
export async function cleanupOldFiles(basePath, retentionDays = 30) {
  try {
    const folders = await fs.readdir(basePath);
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedFolders = 0;
    let deletedFiles = 0;

    for (const folder of folders) {
      // Parse folder name as date (YYYY-MM-DD)
      const folderPath = `${basePath}/${folder}`;
      const folderDate = new Date(folder);

      // Skip if not a valid date folder
      if (isNaN(folderDate.getTime())) {
        continue;
      }

      // Delete if older than retention period
      if (folderDate < cutoffDate) {
        try {
          const files = await fs.readdir(folderPath);
          deletedFiles += files.length;

          await fs.rm(folderPath, { recursive: true });
          deletedFolders++;

          console.log(`  🗑️ Deleted old folder: ${folder} (${files.length} files)`);
        } catch (error) {
          console.error(`  ❌ Failed to delete folder ${folder}: ${error.message}`);
        }
      }
    }

    console.log(`✅ Cleanup completed: ${deletedFolders} folders, ${deletedFiles} files deleted`);
    return { deletedFolders, deletedFiles };

  } catch (error) {
    console.error(`Failed to cleanup old files: ${error.message}`);
    return { deletedFolders: 0, deletedFiles: 0 };
  }
}

/**
 * Save execution summary
 *
 * @param {Object} summary - Execution summary
 * @param {string} dateStr - Date string
 * @returns {Promise<string>} Summary file path
 */
export async function saveSummary(summary, dateStr) {
  try {
    const resultFolder = `results/${dateStr}`;
    await fs.mkdir(resultFolder, { recursive: true });

    const filePath = `${resultFolder}/_summary.json`;
    const jsonContent = JSON.stringify(summary, null, 2);
    await fs.writeFile(filePath, jsonContent, 'utf-8');

    console.log(`📊 Summary saved: ${filePath}`);
    return filePath;

  } catch (error) {
    console.error(`Failed to save summary: ${error.message}`);
    throw error;
  }
}

export default {
  saveValidationResult,
  saveScreenshot,
  cleanupOldFiles,
  saveSummary
};
