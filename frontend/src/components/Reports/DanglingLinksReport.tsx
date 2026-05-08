import {
  Alert,
  Anchor,
  Badge,
  Button,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { useCallback, useState } from "react";
import {
  GetDanglingRelationships,
  DeleteRelationship,
} from "@wailsjs/go/app/App";
import { LogInfo } from "@wailsjs/runtime/runtime.js";
import { ReportShell, useReport } from "@trueblocks/scaffold";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { DanglingLinkResult } from "./types";

export function DanglingLinksReport() {
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const loader = useCallback(
    async () => (await GetDanglingRelationships()) as DanglingLinkResult[],
    [],
  );
  const state = useReport<DanglingLinkResult>(loader);

  const handleDelete = async (
    relationshipId: number,
    refetch: () => Promise<void>,
  ) => {
    LogInfo(
      `[DanglingLinksReport] Deleting link relationshipId=${relationshipId}`,
    );
    setDeletingIds((prev) => new Set(prev).add(relationshipId));
    try {
      await DeleteRelationship(relationshipId);
      LogInfo("[DanglingLinksReport] Link deleted successfully");
      await refetch();
    } catch (error) {
      LogInfo(
        `[DanglingLinksReport] Failed to delete link: ${error instanceof Error ? error.message : String(error)}`,
      );
      alert(
        "Failed to delete link: " +
          (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(relationshipId);
        return next;
      });
    }
  };

  return (
    <ReportShell
      description="Links pointing to deleted or non-existent items"
      state={state}
      emptyTitle="No dangling links found!"
      emptyMessage="All links in your database point to valid items."
    >
      {(links, refetch) => (
        <Stack gap="md">
          <Alert color="red" icon={<IconAlertTriangle size={20} />}>
            <Text fw={600}>Found {links.length} dangling links</Text>
            <Text size="sm">
              These links point to items that no longer exist, likely due to
              database corruption during deletion.
            </Text>
          </Alert>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Link ID</Table.Th>
                <Table.Th>Source Item</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Missing Side</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {links.map((link) => (
                <Table.Tr key={link.relationshipId}>
                  <Table.Td>{link.relationshipId}</Table.Td>
                  <Table.Td>
                    {link.missingSide === "destination" ? (
                      <Anchor
                        component={Link}
                        to={`/item/${link.sourceId}?tab=detail`}
                        fw={600}
                      >
                        {link.sourceLabel}
                      </Anchor>
                    ) : (
                      <Text c="dimmed" fs="italic">
                        Missing Source ({link.sourceId})
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm">{link.label}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color="red" variant="light">
                      {link.missingSide}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      leftSection={<IconTrash size={14} />}
                      loading={deletingIds.has(link.relationshipId)}
                      onClick={() => handleDelete(link.relationshipId, refetch)}
                    >
                      Delete Link
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      )}
    </ReportShell>
  );
}
