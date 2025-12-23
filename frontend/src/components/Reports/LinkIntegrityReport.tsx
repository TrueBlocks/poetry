import { Tabs, Paper, Title, Text, Group, Collapse } from "@mantine/core";
import { Link, EyeOff, Unlink, ChevronDown, ChevronRight } from "lucide-react";
import { UnlinkedReferencesReport } from "./UnlinkedReferencesReport";
import { LinkedItemsNotInDefinitionReport } from "./LinkedItemsNotInDefinitionReport";
import { DanglingLinksReport } from "./DanglingLinksReport";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GetUnlinkedReferences,
  GetLinkedItemsNotInDefinition,
  GetDanglingLinks,
  GetSettings,
  SaveReportLinkIntegrityCollapsed,
  SaveTabSelection,
} from "@wailsjs/go/main/App";

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

  const { data: unlinkedRefs } = useQuery({
    queryKey: ["unlinkedReferences"],
    queryFn: async () => {
      const res = await GetUnlinkedReferences();
      return res || [];
    },
  });

  const { data: linkedNotInDef } = useQuery({
    queryKey: ["linkedNotInDef"],
    queryFn: async () => {
      const res = await GetLinkedItemsNotInDefinition();
      return res || [];
    },
  });

  const { data: danglingLinks } = useQuery({
    queryKey: ["danglingLinks"],
    queryFn: async () => {
      const res = await GetDanglingLinks();
      return res || [];
    },
  });

  return (
    <Paper p="lg" withBorder>
      <Group mb="md" style={{ cursor: "pointer" }} onClick={toggleCollapsed}>
        {collapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
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
            <Tabs.Tab value="missing" leftSection={<Link size={16} />}>
              Missing Links ({unlinkedRefs?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="hidden" leftSection={<EyeOff size={16} />}>
              Hidden Links ({linkedNotInDef?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="broken" leftSection={<Unlink size={16} />}>
              Broken Links ({danglingLinks?.length || 0})
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
