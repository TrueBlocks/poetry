import { Tabs, Paper, Title, Text, Group, Collapse } from "@mantine/core";
import {
  IconLink,
  IconEyeOff,
  IconUnlink,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import { UnlinkedReferencesReport } from "./UnlinkedReferencesReport";
import { LinkedItemsNotInDefinitionReport } from "./LinkedItemsNotInDefinitionReport";
import { DanglingLinksReport } from "./DanglingLinksReport";
import { useCallback, useEffect, useState } from "react";
import { useReport } from "@trueblocks/scaffold";
import {
  GetUnlinkedReferences,
  GetLinkedEntitiesNotInDescription,
  GetDanglingRelationships,
  GetSettings,
  SaveReportLinkIntegrityCollapsed,
  SaveTabSelection,
} from "@wailsjs/go/app/App";

export function LinkIntegrityReport() {
  const [activeTab, setActiveTab] = useState<string | null>("missing");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    GetSettings().then((settings) => {
      setCollapsed(settings.collapsed?.linkIntegrity || false);
      if (settings.tabSelections?.["linkIntegrity"]) {
        setActiveTab(settings.tabSelections["linkIntegrity"]);
      }
    });
  }, []);

  const toggleCollapsed = async () => {
    const newValue = !collapsed;
    setCollapsed(newValue);
    await SaveReportLinkIntegrityCollapsed(newValue);
  };

  const loadUnlinked = useCallback(
    async () => ((await GetUnlinkedReferences()) || []) as unknown[],
    [],
  );
  const loadLinkedNotInDef = useCallback(
    async () =>
      ((await GetLinkedEntitiesNotInDescription()) || []) as unknown[],
    [],
  );
  const loadDangling = useCallback(
    async () => ((await GetDanglingRelationships()) || []) as unknown[],
    [],
  );
  const { data: unlinkedRefs } = useReport<unknown>(loadUnlinked);
  const { data: linkedNotInDef } = useReport<unknown>(loadLinkedNotInDef);
  const { data: danglingLinks } = useReport<unknown>(loadDangling);

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
            Link Integrity
          </Title>
          <Text size="sm" c="dimmed">
            Analyze and fix broken, missing, or hidden connections
          </Text>
        </div>
      </Group>

      <Collapse in={!collapsed}>
        <Tabs
          value={activeTab}
          onChange={(val) => {
            setActiveTab(val);
            if (val) SaveTabSelection("linkIntegrity", val);
          }}
        >
          <Tabs.List mb="md">
            <Tabs.Tab value="missing" leftSection={<IconLink size={16} />}>
              Missing Links ({unlinkedRefs.length})
            </Tabs.Tab>
            <Tabs.Tab value="hidden" leftSection={<IconEyeOff size={16} />}>
              Hidden Links ({linkedNotInDef.length})
            </Tabs.Tab>
            <Tabs.Tab value="broken" leftSection={<IconUnlink size={16} />}>
              Broken Links ({danglingLinks.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="missing">
            <UnlinkedReferencesReport />
          </Tabs.Panel>

          <Tabs.Panel value="hidden">
            <LinkedItemsNotInDefinitionReport />
          </Tabs.Panel>

          <Tabs.Panel value="broken">
            <DanglingLinksReport />
          </Tabs.Panel>
        </Tabs>
      </Collapse>
    </Paper>
  );
}
