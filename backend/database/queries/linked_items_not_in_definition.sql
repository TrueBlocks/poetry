SELECT item_id, word, type, definition, derivation, appendicies
FROM items 
WHERE definition LIKE '%[%'
