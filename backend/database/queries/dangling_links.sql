SELECT 
    l.link_id,
    l.source_item_id,
    l.destination_item_id,
    l.link_type,
    i.word as source_word,
    i.type as source_type,
    CASE 
        WHEN dest.item_id IS NULL THEN 'destination'
        ELSE 'source'
    END as missing_side
FROM links l
LEFT JOIN items i ON l.source_item_id = i.item_id
LEFT JOIN items dest ON l.destination_item_id = dest.item_id
WHERE i.item_id IS NULL OR dest.item_id IS NULL
ORDER BY i.word
