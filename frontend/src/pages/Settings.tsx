import { useState, useEffect } from "react";
import { Container, Title, Tabs, Loader, Center } from "@mantine/core";
import { IconSettings, IconTool, IconFileCode } from "@tabler/icons-react";
import { GeneralSettings } from "@components/Settings/GeneralSettings";
import { MaintenanceSettings } from "@components/Settings/MaintenanceSettings";
import { ConfigEditor } from "@components/Settings/ConfigEditor";
import { GetAllSettings } from "@wailsjs/go/app/App";
import { useUI } from "@/contexts/UIContext";

export default function Settings() {
  const { tabSelections, setTabSelection } = useUI();
  const activeTab = tabSelections["settings"] || "general";
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    GetAllSettings().finally(() => setIsLoading(false));
  }, []);

  const handleTabChange = (value: string | null) => {
    if (value) {
      setTabSelection("settings", value);
    }
  };

  useEffect(() => {
    const tabOrder = ["general", "maintenance", "config"];
    const onCycleTab = (e: Event) => {
      if ((e as CustomEvent).detail !== "settings") return;
      const idx = tabOrder.indexOf(activeTab);
      setTabSelection("settings", tabOrder[(idx + 1) % tabOrder.length]);
    };
    window.addEventListener("view:cycleTab", onCycleTab);
    return () => window.removeEventListener("view:cycleTab", onCycleTab);
  }, [activeTab, setTabSelection]);

  if (isLoading && !tabSelections["settings"]) {
    return (
      <Container size="lg">
        <Title order={1} mb="md">
          Settings
        </Title>
        <Center h={200}>
          <Loader />
        </Center>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Title order={1} mb="md">
        Settings
      </Title>

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List mb="md">
          <Tabs.Tab value="general" leftSection={<IconSettings size={16} />}>
            General
          </Tabs.Tab>
          <Tabs.Tab value="maintenance" leftSection={<IconTool size={16} />}>
            Maintenance
          </Tabs.Tab>
          <Tabs.Tab value="config" leftSection={<IconFileCode size={16} />}>
            Configuration
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general">
          <GeneralSettings />
        </Tabs.Panel>

        <Tabs.Panel value="maintenance">
          <MaintenanceSettings />
        </Tabs.Panel>

        <Tabs.Panel value="config">
          <ConfigEditor />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
