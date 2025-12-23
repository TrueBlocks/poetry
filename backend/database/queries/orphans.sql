SELECT COUNT(*)
FROM items 
WHERE item_id NOT IN (SELECT source_item_id FROM links) 
  AND item_id NOT IN (SELECT destination_item_id FROM links)
