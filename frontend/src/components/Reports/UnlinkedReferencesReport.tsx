import { Anchor, Badge, Table, Tooltip } from "@mantine/core";
import { Link } from "react-router-dom";
import { useCallback, useState } from "react";
import { GetUnlinkedReferences } from "@wailsjs/go/app/App";
import {
  CreateRelationship,
  GetEntity,
  UpdateEntity,
} from "@wailsjs/go/services/EntityService";
import { db } from "@wailsjs/go/models";
import { LogInfo } from "@wailsjs/runtime/runtime.js";
import { ReportShell, useReport } from "@trueblocks/scaffold";
import { UnlinkedRefResult } from "./types";
import { lookupEntityByRef } from "./utils";
import { Patterns } from "@utils/constants";
import { LogError } from "@utils/logger";

export function UnlinkedReferencesReport() {
  const [creatingLink, setCreatingLink] = useState<string | null>(null);
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const loader = useCallback(
    async () => (await GetUnlinkedReferences()) as UnlinkedRefResult[],
    [],
  );
  const state = useReport<UnlinkedRefResult>(loader);

  const handleCreateRelationship = async (
    sourceId: number,
    refWord: string,
    refetch: () => Promise<void>,
  ) => {
    const key = `${sourceId}-${refWord}`;
    setCreatingLink(key);
    try {
      const destEntity = await lookupEntityByRef(refWord);
      if (!destEntity) {
        LogError(`Could not find item: ${refWord}`);
        return;
      }

      await CreateRelationship(sourceId, destEntity.id, "reference");
      await refetch();
    } catch (error) {
      LogError(`Failed to create link: ${error}`);
    } finally {
      setCreatingLink(null);
    }
  };

  const handleRemoveTag = async (
    id: number,
    refWord: string,
    refetch: () => Promise<void>,
  ) => {
    const key = `${id}-${refWord}`;
    setRemovingTag(key);
    LogInfo(
      `[UnlinkedReferencesReport] Removing tag for: id=${id}, refWord=${refWord}`,
    );
    try {
      const item = await GetEntity(id);
      if (!item || !item.description) {
        LogInfo("[UnlinkedReferencesReport] Item or definition not found");
        return;
      }

      const updatedDefinition = item.description.replace(
        Patterns.ReferenceTag,
        (match, _type, content) => {
          if (content.trim() === refWord) {
            return refWord;
          }
          return match;
        },
      );

      const updatedItem = new db.Entity({
        ...item,
        description: updatedDefinition,
      });
      await UpdateEntity(updatedItem);

      LogInfo("[UnlinkedReferencesReport] Item updated successfully");
      await refetch();
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
    <ReportShell
      description="Items containing reference tags without corresponding links"
      state={state}
      emptyTitle="No unlinked references found!"
      emptyMessage="All references in your database are properly linked."
      summaryTitle={(count) => `Found ${count} items with unlinked references`}
      summaryMessage="These items contain references that either point to non-existent items or are missing from the links table."
    >
      {(unlinkedRefs, refetch) => (
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
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Anchor
                    component={Link}
                    to={`/item/${item.id}?tab=detail`}
                    fw={600}
                  >
                    {item.primaryLabel}
                  </Anchor>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{item.typeSlug}</Badge>
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
                      const key = `${item.id}-${detail.ref}`;
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
                                handleRemoveTag(item.id, detail.ref, refetch);
                              } else if (isUnlinked) {
                                handleCreateRelationship(
                                  item.id,
                                  detail.ref,
                                  refetch,
                                );
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
      )}
    </ReportShell>
  );
}
