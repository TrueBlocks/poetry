import { Anchor, Badge, Button, Table } from "@mantine/core";
import { Link } from "react-router-dom";
import { useCallback, useState } from "react";
import {
  GetDuplicateEntities,
  MergeDuplicateEntities,
} from "@wailsjs/go/app/App";
import { ReportShell, useReport } from "@trueblocks/scaffold";
import { DuplicateResult } from "./types";
import { LogError } from "@utils/logger";

export function DuplicateItemsReport() {
  const [deletingDuplicates, setDeletingDuplicates] = useState<string | null>(
    null,
  );
  const loader = useCallback(
    async () => (await GetDuplicateEntities()) as DuplicateResult[],
    [],
  );
  const state = useReport<DuplicateResult>(loader);

  const handleDeleteDuplicates = async (
    originalId: number,
    strippedLabel: string,
    duplicateIds: number[],
    refetch: () => Promise<void>,
  ) => {
    setDeletingDuplicates(strippedLabel);
    try {
      await MergeDuplicateEntities(originalId, duplicateIds);
      await refetch();
    } catch (error) {
      LogError(`Failed to merge duplicates: ${error}`);
    } finally {
      setDeletingDuplicates(null);
    }
  };

  return (
    <ReportShell
      description="Items with the same name after stripping possessives"
      state={state}
      emptyTitle="No duplicate items found!"
      emptyMessage="All items have unique names after stripping possessives."
      summaryTitle={(count) => `Found ${count} sets of duplicate items`}
      summaryMessage={
        'These items have the same name when possessives are removed. Click "Remove Duplicates" to delete the duplicate entries.'
      }
    >
      {(duplicates, refetch) => (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Original Item</Table.Th>
              <Table.Th>Duplicates</Table.Th>
              <Table.Th>Action</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Count</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {duplicates.map((group) => {
              const isDeleting = deletingDuplicates === group.strippedLabel;
              const duplicateIds = group.duplicates.map((d) => d.id);

              return (
                <Table.Tr key={group.strippedLabel}>
                  <Table.Td>
                    <Anchor
                      component={Link}
                      to={`/item/${group.original.id}?tab=detail`}
                      fw={600}
                    >
                      {group.original.primaryLabel}
                    </Anchor>
                    <Badge size="xs" ml="xs">
                      {group.original.typeSlug}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                      }}
                    >
                      {group.duplicates.map((dup) => (
                        <Badge
                          key={dup.id}
                          size="sm"
                          color="red"
                          variant="light"
                        >
                          {dup.primaryLabel} ({dup.typeSlug})
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
                      onClick={() =>
                        handleDeleteDuplicates(
                          group.original.id,
                          group.strippedLabel,
                          duplicateIds,
                          refetch,
                        )
                      }
                    >
                      Remove Duplicates
                    </Button>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Badge size="sm" color="orange">
                      {group.count}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </ReportShell>
  );
}
