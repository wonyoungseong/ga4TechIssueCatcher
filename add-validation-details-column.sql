-- Add validation_details column to crawl_results table
ALTER TABLE crawl_results 
ADD COLUMN IF NOT EXISTS validation_details JSONB;

-- Add index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_crawl_results_validation_details 
ON crawl_results USING GIN (validation_details);

-- Add comment for documentation
COMMENT ON COLUMN crawl_results.validation_details IS 
'Complete validation result including measurementId, gtmId, and pageViewEvent objects with their issues arrays';
