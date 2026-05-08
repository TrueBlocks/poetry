import { Anchor, Badge, Button, Table } from "@mantine/core";
import { Link } from "react-router-dom";
import { useCallback, useState } from "react";
import {
  GetSelfReferentialEntities,
  GetEntity,
  UpdateEntity,
} from "@wailsjs/go/app/App";
import { ReportShell, useReport } from "@trueblocks/scaffold";
import { notifications } from "@mantine/notifications";
import { LogError } from "@utils/logger";
import { SelfRefResult } from "./types";
import { db } from "@wailsjs/go/models";

export function SelfReferentialReport() {
  const [fixingItem, setFixingItem] = useState<number | null>(null);
  const loader = useCallback(
    async () => (await GetSelfReferentialEntities()) as SelfRefResult[],
    [],
  );
  const state = useReport<SelfRefResult>(loader);

  const handleFix = async (
    itemResult: SelfRefResult,
    refetch: () => Promise<void>,
  ) => {
    setFixingItem(itemResult.id);
    try {
      const item = await GetEntity(itemResult.id);
      if (!item) {
        throw new Error("Item not found");
      }

      const tagContent = itemResult.tag.slice(1, -1);
      const [prefix, primaryLabel] = tagContent.split(":").map((s) => s.trim());

      const escapedWord = primaryLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = `\\{${prefix}:\\s*${escapedWord}\\}`;
      const regex = new RegExp(pattern, "gi");

      const replacement = primaryLabel;

      const updatedItem = new db.Entity(item);
      let changed = false;

      if (updatedItem.description) {
        const newVal = updatedItem.description.replace(regex, replacement);
        if (newVal !== updatedItem.description) {
          updatedItem.description = newVal;
          changed = true;
        }
      }
      if (updatedItem.attributes?.derivation) {
        const newVal = updatedItem.attributes.derivation.replace(
          regex,
          replacement,
        );
        if (newVal !== updatedItem.attributes.derivation) {
          updatedItem.attributes.derivation = newVal;
          changed = true;
        }
      }
      if (updatedItem.attributes?.appendicies) {
        const newVal = updatedItem.attributes.appendicies.replace(
          regex,
          replacement,
        );
        if (newVal !== updatedItem.attributes.appendicies) {
          updatedItem.attributes.appendicies = newVal;
          changed = true;
        }
      }

      if (changed) {
        await UpdateEntity(updatedItem);
        await refetch();
        notifications.show({
          title: "Fixed",
          message: `Removed self-reference in ${item.primaryLabel}`,
          color: "green",
        });
      } else {
        notifications.show({
          title: "No changes",
          message: `Could not find the tag to replace in ${item.primaryLabel}`,
          color: "yellow",
        });
      }
    } catch (error) {
      LogError(`Failed to fix item: ${error}`);
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
    <ReportShell
      description="Items that reference themselves in their definition"
      state={state}
      emptyTitle="No self-referential items found!"
      summaryTitle={(count) => `Found ${count} self-referential items`}
      summaryMessage={
        'These items contain tags that reference themselves. Click "Fix" to replace the tag with plain text.'
      }
    >
      {(selfRefs, refetch) => (
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
                    loading={fixingItem === item.id}
                    onClick={() => handleFix(item, refetch)}
                  >
                    Fix
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </ReportShell>
  );
}
