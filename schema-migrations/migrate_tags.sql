BEGIN TRANSACTION;

UPDATE items SET
  definition = REPLACE(REPLACE(REPLACE(REPLACE(definition, '{d:', '{word:'), '{w:', '{word:'), '{p:', '{writer:'), '{t:', '{title:'),
  derivation = REPLACE(REPLACE(REPLACE(REPLACE(derivation, '{d:', '{word:'), '{w:', '{word:'), '{p:', '{writer:'), '{t:', '{title:'),
  appendicies = REPLACE(REPLACE(REPLACE(REPLACE(appendicies, '{d:', '{word:'), '{w:', '{word:'), '{p:', '{writer:'), '{t:', '{title:');

INSERT INTO items_fts(items_fts) VALUES('rebuild');

SELECT 'Checking for old tag formats...' AS status;
SELECT COUNT(*) AS remaining_old_tags FROM items 
WHERE definition LIKE '%{w:%' OR definition LIKE '%{p:%' OR definition LIKE '%{t:%' OR definition LIKE '%{d:%'
   OR derivation LIKE '%{w:%' OR derivation LIKE '%{p:%' OR derivation LIKE '%{t:%' OR derivation LIKE '%{d:%'
   OR appendicies LIKE '%{w:%' OR appendicies LIKE '%{p:%' OR appendicies LIKE '%{t:%' OR appendicies LIKE '%{d:%';

COMMIT;
