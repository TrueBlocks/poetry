SELECT COUNT(*) 
FROM links l 
JOIN items i ON l.source_item_id = i.item_id 
WHERE l.destination_item_id = ?
  AND i.type = 'Title'
