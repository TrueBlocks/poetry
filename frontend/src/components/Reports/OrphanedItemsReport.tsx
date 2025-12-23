import {
  Stack,
  Text,
  Alert,
  Loader,
  Table,
  Badge,
  Anchor,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { GetOrphanedItems } from "@wailsjs/go/main/App";
import { AlertTriangle } from "lucide-react";
import { OrphanedItemResult } from "./types";

export function OrphanedItemsReport() {
  const { data: orphanedItems, isLoading } = useQuery({
    queryKey: ["orphanedItems"],
    queryFn: async () => {
      const results = await GetOrphanedItems();
      return results as OrphanedItemResult[];
    },
  });

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" c="dimmed">
          Items with no incoming or outgoing links
        </Text>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <Loader />
        </div>
      )}

      {!isLoading && orphanedItems && orphanedItems.length === 0 && (
        <Alert color="green" icon={<AlertTriangle size={20} />}>
          <Text fw={600}>No orphaned items found!</Text>
          <Text size="sm">All items have at least one connection.</Text>
        </Alert>
      )}

      {!isLoading && orphanedItems && orphanedItems.length > 0 && (
        <>
          <Alert color="yellow" icon={<AlertTriangle size={20} />}>
            <Text fw={600}>Found {orphanedItems.length} orphaned items</Text>
            <Text size="sm">
              These items have no connections to other items. Click an item to
              edit it and add connections.
            </Text>
          </Alert>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th>Type</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {orphanedItems.map((item) => (
                <Table.Tr key={item.itemId}>
                  <Table.Td>
                    <Anchor
                      component={Link}
                      to={`/item/${item.itemId}?tab=detail`}
                      fw={600}
                    >
                      {item.word}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm">{item.type}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}
