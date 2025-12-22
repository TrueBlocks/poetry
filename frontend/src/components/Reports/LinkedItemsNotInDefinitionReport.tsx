import {
  Stack,
  Text,
  Alert,
  Loader,
  Table,
  Badge,
  Anchor,
  Button,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  GetLinkedItemsNotInDefinition,
  DeleteLinkByItems,
} from "../../../wailsjs/go/main/App";
import { AlertTriangle } from "lucide-react";
import { notifications } from "@mantine/notifications";
import { LinkedNotInDefResult } from "./types";
import { lookupItemByRef } from "./utils";

export function LinkedItemsNotInDefinitionReport() {
  const queryClient = useQueryClient();
  const [deletingLink, setDeletingLink] = useState<string | null>(null);

  const { data: linkedNotInDef, isLoading } = useQuery({
    queryKey: ["linkedNotInDef"],
    queryFn: async () => {
      const results = await GetLinkedItemsNotInDefinition();
      return results as LinkedNotInDefResult[];
    },
  });

  const handleDeleteLink = async (sourceItemId: number, refWord: string) => {
    setDeletingLink(`${sourceItemId}-${refWord}`);
    try {
      const destItem = await lookupItemByRef(refWord);
      if (!destItem) {
        notifications.show({
          title: "Item not found",
          message: `Could not find item: ${refWord}`,
          color: "red",
        });
        return;
      }

      await DeleteLinkByItems(sourceItemId, destItem.itemId);
      queryClient.invalidateQueries({ queryKey: ["linkedNotInDef"] });

      notifications.show({
        title: "Link deleted",
        message: `Removed link to ${destItem.word}`,
        color: "green",
      });
    } catch (error) {
      console.error("Failed to delete link:", error);
      notifications.show({
        title: "Error",
        message: "Failed to delete link",
        color: "red",
      });
    } finally {
      setDeletingLink(null);
    }
  };

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" c="dimmed">
          Links exist but items aren&apos;t tagged in definitions
        </Text>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <Loader />
        </div>
      )}

      {!isLoading && linkedNotInDef && linkedNotInDef.length === 0 && (
        <Alert color="green" icon={<AlertTriangle size={20} />}>
          <Text fw={600}>All linked items are properly referenced!</Text>
          <Text size="sm">
            All items with links have those links referenced in their
            definitions.
          </Text>
        </Alert>
      )}

      {!isLoading && linkedNotInDef && linkedNotInDef.length > 0 && (
        <>
          <Alert color="yellow" icon={<AlertTriangle size={20} />}>
            <Text fw={600}>
              Found {linkedNotInDef.length} items with unreferenced links
            </Text>
            <Text size="sm">
              These items have links in the database but don&apos;t reference
              the linked item in their definition text.
            </Text>
          </Alert>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Unreferenced Links</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Count</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {linkedNotInDef.map((item) => (
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
                  <Table.Td>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}
                    >
                      {item.missingReferences.map((ref, idx) => (
                        <Button
                          key={idx}
                          size="xs"
                          color="orange"
                          variant="light"
                          loading={deletingLink === `${item.itemId}-${ref}`}
                          onClick={() => handleDeleteLink(item.itemId, ref)}
                          title="Click to remove link"
                        >
                          {ref}
                        </Button>
                      ))}
                    </div>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Badge size="sm" color="orange">
                      {item.missingReferences.length}
                    </Badge>
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
