import { Tabs, Paper, Title, Text, Group, Collapse } from "@mantine/core";
import {
  Copy,
  Ghost,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { DuplicateItemsReport } from "./DuplicateItemsReport";
import { OrphanedItemsReport } from "./OrphanedItemsReport";
import { SelfReferentialReport } from "./SelfReferentialReport";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GetDuplicateItems,
  GetOrphanedItems,
  GetSelfReferentialItems,
  GetSettings,
  SaveReportItemHealthCollapsed,
  SaveTabSelection,
} from "@wailsjs/go/main/App";

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

  const { data: duplicates } = useQuery({
    queryKey: ["duplicateItems"],
    queryFn: async () => {
      const res = await GetDuplicateItems();
      return res || [];
    },
  });

  const { data: orphans } = useQuery({
    queryKey: ["orphanedItems"],
    queryFn: async () => {
      const res = await GetOrphanedItems();
      return res || [];
    },
  });

  const { data: selfRefs } = useQuery({
    queryKey: ["selfReferentialItems"],
    queryFn: async () => {
      const res = await GetSelfReferentialItems();
      return res || [];
    },
  });

  return (
    <Paper p="lg" withBorder>
      <Group mb="md" style={{ cursor: "pointer" }} onClick={toggleCollapsed}>
        {collapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
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
            <Tabs.Tab value="duplicates" leftSection={<Copy size={16} />}>
              Duplicate Items ({duplicates?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="orphans" leftSection={<Ghost size={16} />}>
              Orphaned Items ({orphans?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="selfrefs" leftSection={<RefreshCw size={16} />}>
              Self References ({selfRefs?.length || 0})
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
