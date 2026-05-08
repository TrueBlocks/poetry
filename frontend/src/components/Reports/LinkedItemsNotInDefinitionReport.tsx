import { Anchor, Badge, Button, Table } from "@mantine/core";
import { Link } from "react-router-dom";
import { useCallback, useState } from "react";
import { GetLinkedEntitiesNotInDescription } from "@wailsjs/go/app/App";
import { DeleteRelationship } from "@wailsjs/go/services/EntityService";
import { ReportShell, useReport } from "@trueblocks/scaffold";
import { notifications } from "@mantine/notifications";
import { LinkedNotInDefResult } from "./types";
import { LogError } from "@utils/logger";

export function LinkedItemsNotInDefinitionReport() {
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const loader = useCallback(
    async () =>
      (await GetLinkedEntitiesNotInDescription()) as LinkedNotInDefResult[],
    [],
  );
  const state = useReport<LinkedNotInDefResult>(loader);

  const handleDeleteLink = async (
    relationshipId: number,
    label: string,
    refetch: () => Promise<void>,
  ) => {
    setDeletingLink(String(relationshipId));
    try {
      await DeleteRelationship(relationshipId);
      await refetch();
      notifications.show({
        title: "Link deleted",
        message: `Removed link to ${label}`,
        color: "green",
      });
    } catch (error) {
      LogError(`Failed to delete link: ${error}`);
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
    <ReportShell
      description="Links exist but items aren't tagged in definitions"
      state={state}
      emptyTitle="All linked items are properly referenced!"
      emptyMessage="All items with links have those links referenced in their definitions."
      summaryTitle={(count) => `Found ${count} items with unreferenced links`}
      summaryMessage="These items have links in the database but don't reference the linked item in their definition text."
    >
      {(items, refetch) => (
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
            {items.map((item) => (
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
                    {item.missingReferences.map((ref, idx) => (
                      <Button
                        key={idx}
                        size="xs"
                        color="orange"
                        variant="light"
                        loading={deletingLink === String(ref.relationshipId)}
                        onClick={() =>
                          handleDeleteLink(
                            ref.relationshipId,
                            ref.label,
                            refetch,
                          )
                        }
                        title="Click to remove link"
                      >
                        {ref.label}
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
      )}
    </ReportShell>
  );
}
