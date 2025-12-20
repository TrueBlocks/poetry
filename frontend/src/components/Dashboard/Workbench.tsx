import { Paper, Text, Group, Table, Button, ScrollArea, Switch, useMantineTheme, Checkbox } from '@mantine/core';
import { Link as RouterLink } from 'react-router-dom';
import { CheckSquare, ArrowRight, Network } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { database } from '../../../wailsjs/go/models';
import { ToggleItemMark } from '../../../wailsjs/go/main/App';

interface WorkbenchProps {
  items: database.Item[] | null;
  onToggle?: () => void;
}

export function Workbench({ items, onToggle }: WorkbenchProps) {
  const theme = useMantineTheme();
  const queryClient = useQueryClient();

  const handleUnmark = async (itemId: number) => {
    try {
      await ToggleItemMark(itemId, false);
      queryClient.invalidateQueries({ queryKey: ['markedItems'] });
      queryClient.invalidateQueries({ queryKey: ['allItems'] });
    } catch (error) {
      console.error('Failed to unmark item:', error);
    }
  };

  return (
    <Paper withBorder p="md" radius="md" h="100%">
      <Group mb="md" justify="space-between">
        <Group>
          <CheckSquare size={20} />
          <Text fw={500}>Workbench (Marked Items)</Text>
        </Group>
        <Group>
          <Text size="xs" c="dimmed">{items?.length || 0} marked items</Text>
          {onToggle && (
            <Switch 
              checked={true} 
              onChange={onToggle} 
              size="xs"
              onLabel={<CheckSquare size={12} color={theme.colors.blue[6]} />}
              offLabel={<Network size={12} color={theme.colors.gray[6]} />}
            />
          )}
        </Group>
      </Group>
      <ScrollArea h={450}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}></Table.Th>
              <Table.Th>Word</Table.Th>
              <Table.Th>Mark Note</Table.Th>
              <Table.Th style={{ width: 80 }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items && items.length > 0 ? (
              items.map((item) => (
                <Table.Tr key={item.itemId}>
                  <Table.Td>
                    <Checkbox 
                      checked={true} 
                      onChange={() => handleUnmark(item.itemId)} 
                      size="xs"
                    />
                  </Table.Td>
                  <Table.Td fw={500}>{item.word}</Table.Td>
                  <Table.Td>{item.mark}</Table.Td>
                  <Table.Td>
                    <Button 
                      component={RouterLink} 
                      to={`/item/${item.itemId}`}
                      variant="subtle" 
                      size="xs"
                      rightSection={<ArrowRight size={14} />}
                    >
                      Go
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed" py="xl">
                    No marked items. Mark items in tables to see them here.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  );
}
