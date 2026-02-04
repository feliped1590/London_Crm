-- Drop the old unique constraint on stage alone
ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_stage_key;

-- Create a new composite unique constraint allowing same stage type in different pipelines
-- This allows "qualificacao" to exist in Pipeline A and Pipeline B
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_pipeline_stage_unique 
ON pipeline_stages (pipeline_id, stage);

-- Also allow null pipeline_id (global stages) to have unique stages
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_global_stage_unique 
ON pipeline_stages (stage) WHERE pipeline_id IS NULL;