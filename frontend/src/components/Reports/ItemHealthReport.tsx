import { Tabs, Paper, Title, Text, Group, Collapse } from "@mantine/core";
import {
  IconCopy,
  IconGhost,
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
} from "@tabler/icons-react";
import { DuplicateItemsReport } from "./DuplicateItemsReport";
import { OrphanedItemsReport } from "./OrphanedItemsReport";
import { SelfReferentialReport } from "./SelfReferentialReport";
import { useCallback, useEffect, useState } from "react";
import { useReport } from "@trueblocks/scaffold";
import {
  GetDuplicateEntities,
  GetOrphanedEntities,
  GetSelfReferentialEntities,
  GetSettings,
  SaveReportItemHealthCollapsed,
  SaveTabSelection,
} from "@wailsjs/go/app/App";

export function ItemHealthReport() {
  const [activeTab, setActiveTab] = useState<string | null>("duplicates");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    GetSettings().then((settings) => {
      setCollapsed(settings.collapsed?.itemHealth || false);
      if (settings.tabSelections?.["healthReport"]) {
        setActiveTab(settings.tabSelections["healthReport"]);
      }
    });
  }, []);

  const toggleCollapsed = async () => {
    const newValue = !collapsed;
    setCollapsed(newValue);
    await SaveReportItemHealthCollapsed(newValue);
  };

  const loadDuplicates = useCallback(
    async () => ((await GetDuplicateEntities()) || []) as unknown[],
    [],
  );
  const loadOrphans = useCallback(
    async () => ((await GetOrphanedEntities()) || []) as unknown[],
    [],
  );
  const loadSelfRefs = useCallback(
    async () => ((await GetSelfReferentialEntities()) || []) as unknown[],
    [],
  );
  const { data: duplicates } = useReport<unknown>(loadDuplicates);
  const { data: orphans } = useReport<unknown>(loadOrphans);
  const { data: selfRefs } = useReport<unknown>(loadSelfRefs);

  return (
    <Paper p="lg" withBorder>
      <Group mb="md" style={{ cursor: "pointer" }} onClick={toggleCollapsed}>
        {collapsed ? (
          <IconChevronRight size={20} />
        ) : (
          <IconChevronDown size={20} />
        )}
        <div>
          <Title order={2} size="h3">
            Item Health
          </Title>
          <Text size="sm" c="dimmed">
            Identify duplicate items, isolated orphans, and self-references
          </Text>
        </div>
      </Group>

      <Collapse in={!collapsed}>
        <Tabs
          value={activeTab}
          onChange={(val) => {
            setActiveTab(val);
            if (val) SaveTabSelection("healthReport", val);
          }}
        >
          <Tabs.List mb="md">
            <Tabs.Tab value="duplicates" leftSection={<IconCopy size={16} />}>
              Duplicate Items ({duplicates.length})
            </Tabs.Tab>
            <Tabs.Tab value="orphans" leftSection={<IconGhost size={16} />}>
              Orphaned Items ({orphans.length})
            </Tabs.Tab>
            <Tabs.Tab value="selfrefs" leftSection={<IconRefresh size={16} />}>
              Self References ({selfRefs.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="duplicates">
            <DuplicateItemsReport />
          </Tabs.Panel>

          <Tabs.Panel value="orphans">
            <OrphanedItemsReport />
          </Tabs.Panel>

          <Tabs.Panel value="selfrefs">
            <SelfReferentialReport />
          </Tabs.Panel>
        </Tabs>
      </Collapse>
    </Paper>
  );
}
