SELECT COUNT(*)
FROM items
WHERE definition IS NULL
   OR definition = ''
