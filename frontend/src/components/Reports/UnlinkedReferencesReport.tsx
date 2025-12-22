import {
  Stack,
  Text,
  Alert,
  Loader,
  Table,
  Badge,
  Anchor,
  Tooltip,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  GetUnlinkedReferences,
  CreateLink,
  GetItem,
  UpdateItem,
  DeleteLinkByItems,
} from "../../../wailsjs/go/main/App";
import { database } from "../../../wailsjs/go/models";
import { LogInfo } from "../../../wailsjs/runtime/runtime.js";
import { AlertTriangle } from "lucide-react";
import { UnlinkedRefResult } from "./types";
import { lookupItemByRef } from "./utils";
import { Patterns } from "../../utils/constants";

export function UnlinkedReferencesReport() {
  const queryClient = useQueryClient();
  const [creatingLink, setCreatingLink] = useState<string | null>(null);
  const [removingTag, setRemovingTag] = useState<string | null>(null);

  const { data: unlinkedRefs, isLoading } = useQuery({
    queryKey: ["unlinkedReferences"],
    queryFn: async () => {
      const results = await GetUnlinkedReferences();
      return results as UnlinkedRefResult[];
    },
  });

  const handleCreateLink = async (sourceItemId: number, refWord: string) => {
    const key = `${sourceItemId}-${refWord}`;
    setCreatingLink(key);
    try {
      const destItem = await lookupItemByRef(refWord);
      if (!destItem) {
        console.error("Could not find item:", refWord);
        return;
      }

      await CreateLink(sourceItemId, destItem.itemId, "reference");
      queryClient.invalidateQueries({ queryKey: ["unlinkedReferences"] });
    } catch (error) {
      console.error("Failed to create link:", error);
    } finally {
      setCreatingLink(null);
    }
  };

  const handleRemoveTag = async (itemId: number, refWord: string) => {
    const key = `${itemId}-${refWord}`;
    setRemovingTag(key);
    LogInfo(
      `[UnlinkedReferencesReport] Removing tag for: itemId=${itemId}, refWord=${refWord}`,
    );
    try {
      const item = await GetItem(itemId);
      if (!item || !item.definition) {
        LogInfo("[UnlinkedReferencesReport] Item or definition not found");
        return;
      }

      // Try to find the destination item to remove any links
      try {
        const destItem = await lookupItemByRef(refWord);
        if (destItem) {
          LogInfo(
            `[UnlinkedReferencesReport] Found destination item: ${destItem.itemId}, removing link`,
          );
          try {
            await DeleteLinkByItems(itemId, destItem.itemId);
            LogInfo("[UnlinkedReferencesReport] Link deleted successfully");
          } catch (error) {
            LogInfo(
              `[UnlinkedReferencesReport] No link to delete or deletion failed: ${error}`,
            );
          }
        }
      } catch {
        LogInfo(
          `[UnlinkedReferencesReport] Destination item not found (expected for missing items): ${refWord}`,
        );
      }

      // Remove all reference tags that match this word (case-insensitive)
      // Tags are in format: {word:text}, {writer:text}, {title:text}
      const updatedDefinition = item.definition.replace(
        Patterns.ReferenceTag,
        (match, _type, content) => {
          if (content.trim() === refWord) {
            return refWord;
          }
          return match;
        },
      );

      LogInfo(
        `[UnlinkedReferencesReport] Original definition length: ${item.definition.length}`,
      );
      LogInfo(
        `[UnlinkedReferencesReport] Updated definition length: ${updatedDefinition.length}`,
      );

      const updatedItem = new database.Item({
        ...item,
        definition: updatedDefinition,
      });
      await UpdateItem(updatedItem);

      LogInfo("[UnlinkedReferencesReport] Item updated successfully");
      queryClient.invalidateQueries({ queryKey: ["unlinkedReferences"] });
    } catch (error) {
      LogInfo(
        `[UnlinkedReferencesReport] Failed to remove tag: ${error instanceof Error ? error.message : String(error)}`,
      );
      alert(
        "Failed to remove tag: " +
          (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setRemovingTag(null);
    }
  };

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" c="dimmed">
          Items containing reference tags without corresponding links
        </Text>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <Loader />
        </div>
      )}

      {!isLoading && unlinkedRefs && unlinkedRefs.length === 0 && (
        <Alert color="green" icon={<AlertTriangle size={20} />}>
          <Text fw={600}>No unlinked references found!</Text>
          <Text size="sm">
            All references in your database are properly linked.
          </Text>
        </Alert>
      )}

      {!isLoading && unlinkedRefs && unlinkedRefs.length > 0 && (
        <>
          <Alert color="yellow" icon={<AlertTriangle size={20} />}>
            <Text fw={600}>
              Found {unlinkedRefs.length} items with unlinked references
            </Text>
            <Text size="sm">
              These items contain references that either point to non-existent
              items or are missing from the links table.
            </Text>
          </Alert>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Unlinked References</Table.Th>
                <Table.Th>Reason</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Count</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {unlinkedRefs.map((item) => (
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
                      {item.unlinkedRefs.map((detail, idx) => (
                        <Badge key={idx} size="sm" color="red" variant="light">
                          {detail.ref}
                        </Badge>
                      ))}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}
                    >
                      {item.unlinkedRefs.map((detail, idx) => {
                        const key = `${item.itemId}-${detail.ref}`;
                        const isCreating = creatingLink === key;
                        const isRemoving = removingTag === key;
                        const isUnlinked = detail.reason === "unlinked";
                        const isMissing = detail.reason === "missing";
                        const isClickable = isUnlinked || isMissing;
                        const isProcessing = isCreating || isRemoving;

                        return (
                          <Tooltip
                            key={idx}
                            label={
                              isUnlinked
                                ? "Click to create link"
                                : "Click to remove tag"
                            }
                            disabled={isProcessing}
                          >
                            <Badge
                              size="sm"
                              color={isMissing ? "red" : "orange"}
                              variant="filled"
                              style={{
                                cursor: isClickable ? "pointer" : "default",
                                opacity: isProcessing ? 0.5 : 1,
                              }}
                              onClick={() => {
                                if (isProcessing) return;
                                if (isMissing) {
                                  handleRemoveTag(item.itemId, detail.ref);
                                } else if (isUnlinked) {
                                  handleCreateLink(item.itemId, detail.ref);
                                }
                              }}
                            >
                              {isRemoving
                                ? "Removing..."
                                : isCreating
                                  ? "Creating..."
                                  : isMissing
                                    ? "Item Not Found"
                                    : "Not Linked"}
                            </Badge>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Badge size="sm" color="orange">
                      {item.refCount}
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
