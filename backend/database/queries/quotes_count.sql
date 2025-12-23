SELECT COUNT(*)
FROM items
WHERE type = 'Title'
  AND definition LIKE '%[%'
  AND definition LIKE '%]%'
