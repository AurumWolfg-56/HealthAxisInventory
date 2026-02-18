-- Fix variables column type mismatch
-- Changed from text[] (which rejected complex objects) to JSONB
ALTER TABLE form_templates 
ALTER COLUMN variables TYPE JSONB 
USING to_jsonb(variables);
