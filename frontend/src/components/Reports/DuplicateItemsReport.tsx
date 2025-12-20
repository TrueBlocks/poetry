import { Stack, Text, Alert, Loader, Table, Badge, Anchor, Button } from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { GetDuplicateItems, MergeDuplicateItems } from '../../../wailsjs/go/main/App'
import { AlertTriangle } from 'lucide-react'
import { DuplicateResult } from './types'

export function DuplicateItemsReport() {
  const queryClient = useQueryClient()
  const [deletingDuplicates, setDeletingDuplicates] = useState<string | null>(null)
  
  const { data: duplicates, isLoading } = useQuery({
    queryKey: ['duplicateItems'],
    queryFn: async () => {
      const results = await GetDuplicateItems()
      return results as DuplicateResult[]
    },
  })

  const handleDeleteDuplicates = async (originalId: number, strippedWord: string, duplicateIds: number[]) => {
    setDeletingDuplicates(strippedWord)
    try {
      await MergeDuplicateItems(originalId, duplicateIds)
      queryClient.invalidateQueries({ queryKey: ['duplicateItems'] })
      queryClient.invalidateQueries({ queryKey: ['unlinkedReferences'] })
      queryClient.invalidateQueries({ queryKey: ['orphanedItems'] })
    } catch (error) {
      console.error('Failed to merge duplicates:', error)
    } finally {
      setDeletingDuplicates(null)
    }
  }

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" c="dimmed">
          Items with the same name after stripping possessives
        </Text>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Loader />
        </div>
      )}

      {!isLoading && duplicates && duplicates.length === 0 && (
        <Alert color="green" icon={<AlertTriangle size={20} />}>
          <Text fw={600}>No duplicate items found!</Text>
          <Text size="sm">All items have unique names after stripping possessives.</Text>
        </Alert>
      )}

      {!isLoading && duplicates && duplicates.length > 0 && (
        <>
          <Alert color="yellow" icon={<AlertTriangle size={20} />}>
            <Text fw={600}>Found {duplicates.length} sets of duplicate items</Text>
            <Text size="sm">
              These items have the same name when possessives are removed. Click "Remove Duplicates" to delete the duplicate entries.
            </Text>
          </Alert>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Original Item</Table.Th>
                <Table.Th>Duplicates</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Count</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {duplicates.map((group) => {
                const isDeleting = deletingDuplicates === group.strippedWord
                const duplicateIds = group.duplicates.map(d => d.itemId)
                
                return (
                  <Table.Tr key={group.strippedWord}>
                    <Table.Td>
                      <Anchor component={Link} to={`/item/${group.original.itemId}?tab=detail`} fw={600}>
                        {group.original.word}
                      </Anchor>
                      <Badge size="xs" ml="xs">{group.original.type}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {group.duplicates.map((dup) => (
                          <Badge key={dup.itemId} size="sm" color="red" variant="light">
                            {dup.word} ({dup.type})
                          </Badge>
                        ))}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Button 
                        size="xs" 
                        color="red" 
                        variant="light"
                        loading={isDeleting}
                        onClick={() => handleDeleteDuplicates(group.original.itemId, group.strippedWord, duplicateIds)}
                      >
                        Remove Duplicates
                      </Button>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Badge size="sm" color="orange">
                        {group.count}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  )
}
