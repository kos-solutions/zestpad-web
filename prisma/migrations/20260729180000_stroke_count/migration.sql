-- Numarul de trasee, tinut separat ca sa nu parsam JSON-ul la fiecare
-- verificare de versiune facuta de zeci de elevi in timpul unei ore.
ALTER TABLE "Lesson" ADD COLUMN "strokeCount" INTEGER NOT NULL DEFAULT 0;

-- Completam valoarea pentru lectiile existente.
-- Continutul poate fi gol sau, din versiuni vechi, JSON invalid: in acele
-- cazuri lasam 0, iar clientul va cere oricum lectia intreaga.
UPDATE "Lesson"
SET "strokeCount" = COALESCE(
  jsonb_array_length(
    CASE
      WHEN content ~ '^\s*\{' THEN (content::jsonb -> 'strokes')
      ELSE NULL
    END
  ), 0)
WHERE content <> '';
