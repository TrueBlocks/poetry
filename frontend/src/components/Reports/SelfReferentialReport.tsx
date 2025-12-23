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
  GetSelfReferentialItems,
  GetItem,
  UpdateItem,
} from "@wailsjs/go/main/App";
import { AlertTriangle, Check } from "lucide-react";
import { notifications } from "@mantine/notifications";
import { SelfReferentialResult } from "./types";
import { database } from "@wailsjs/go/models";

export function SelfReferentialReport() {
  const queryClient = useQueryClient();
  const [fixingItem, setFixingItem] = useState<number | null>(null);

  const { data: selfRefs, isLoading } = useQuery({
    queryKey: ["selfReferentialItems"],
    queryFn: async () => {
      const results = await GetSelfReferentialItems();
      return results as SelfReferentialResult[];
    },
  });

  const handleFix = async (itemResult: SelfReferentialResult) => {
    setFixingItem(itemResult.itemId);
    try {
      const item = await GetItem(itemResult.itemId);
      if (!item) {
        throw new Error("Item not found");
      }

      // Reconstruct regex based on the tag found
      const tagContent = itemResult.tag.slice(1, -1); // remove { and }
      const [prefix, word] = tagContent.split(":").map((s) => s.trim());

      // Regex: \{prefix:\s*word\}
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = `\\{${prefix}:\\s*${escapedWord}\\}`;
      const regex = new RegExp(pattern, "gi");

      const replacement = word; // Just the word

      const updatedItem = new database.Item(item);
      let changed = false;

      if (updatedItem.definition) {
        const newVal = updatedItem.definition.replace(regex, replacement);
        if (newVal !== updatedItem.definition) {
          updatedItem.definition = newVal;
          changed = true;
        }
      }
      if (updatedItem.derivation) {
        const newVal = updatedItem.derivation.replace(regex, replacement);
        if (newVal !== updatedItem.derivation) {
          updatedItem.derivation = newVal;
          changed = true;
        }
      }
      if (updatedItem.appendicies) {
        const newVal = updatedItem.appendicies.replace(regex, replacement);
        if (newVal !== updatedItem.appendicies) {
          updatedItem.appendicies = newVal;
          changed = true;
        }
      }

      if (changed) {
        await UpdateItem(updatedItem);
        queryClient.invalidateQueries({ queryKey: ["selfReferentialItems"] });
        notifications.show({
          title: "Fixed",
          message: `Removed self-reference in ${item.word}`,
          color: "green",
        });
      } else {
        notifications.show({
          title: "No changes",
          message: `Could not find the tag to replace in ${item.word}`,
          color: "yellow",
        });
      }
    } catch (error) {
      console.error("Failed to fix item:", error);
      notifications.show({
        title: "Error",
        message: "Failed to fix item",
        color: "red",
      });
    } finally {
      setFixingItem(null);
    }
  };

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" c="dimmed">
          Items that reference themselves in their definition
        </Text>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <Loader />
        </div>
      )}

      {!isLoading && selfRefs && selfRefs.length === 0 && (
        <Alert color="green" icon={<Check size={20} />}>
          <Text fw={600}>No self-referential items found!</Text>
        </Alert>
      )}

      {!isLoading && selfRefs && selfRefs.length > 0 && (
        <>
          <Alert color="yellow" icon={<AlertTriangle size={20} />}>
            <Text fw={600}>Found {selfRefs.length} self-referential items</Text>
            <Text size="sm">
              These items contain tags that reference themselves. Click
              &quot;Fix&quot; to replace the tag with plain text.
            </Text>
          </Alert>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Tag Found</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {selfRefs.map((item) => (
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
                    <Badge
                      variant="outline"
                      color="gray"
                      style={{ textTransform: "none" }}
                    >
                      {item.tag}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      loading={fixingItem === item.itemId}
                      onClick={() => handleFix(item)}
                    >
                      Fix
                    </Button>
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
