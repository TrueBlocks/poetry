import { Anchor, Badge, Table } from "@mantine/core";
import { Link } from "react-router-dom";
import { useCallback } from "react";
import { GetOrphanedEntities } from "@wailsjs/go/app/App";
import { ReportShell, useReport } from "@trueblocks/scaffold";
import { OrphanedItemResult } from "./types";

export function OrphanedItemsReport() {
  const loader = useCallback(
    async () => (await GetOrphanedEntities()) as OrphanedItemResult[],
    [],
  );
  const state = useReport<OrphanedItemResult>(loader);

  return (
    <ReportShell
      description="Items with no incoming or outgoing links"
      state={state}
      emptyTitle="No orphaned items found!"
      emptyMessage="All items have at least one connection."
      summaryTitle={(count) => `Found ${count} orphaned items`}
      summaryMessage="These items have no connections to other items. Click an item to edit it and add connections."
    >
      {(items) => (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th>Type</Table.Th>
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
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </ReportShell>
  );
}
