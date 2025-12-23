SELECT COUNT(*)
FROM items
WHERE source IS NOT NULL
  AND source != ''
