import { useQuery } from "@tanstack/react-query";
import { Container, Title, Tabs, Loader, Center } from "@mantine/core";
import { Settings as SettingsIcon, Wrench } from "lucide-react";
import { GeneralSettings } from "../components/Settings/GeneralSettings";
import { MaintenanceSettings } from "../components/Settings/MaintenanceSettings";
import { GetAllSettings } from "../../wailsjs/go/main/App";
import { useUIStore } from "../stores/useUIStore";

export default function Settings() {
  const { tabSelections, setTabSelection } = useUIStore();
  const activeTab = tabSelections["settings"] || "general";

  const { isLoading } = useQuery({
    queryKey: ["allSettings"],
    queryFn: GetAllSettings,
  });

  const handleTabChange = (value: string | null) => {
    if (value) {
      setTabSelection("settings", value);
    }
  };

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
          <Tabs.Tab value="general" leftSection={<SettingsIcon size={16} />}>
            General
          </Tabs.Tab>
          <Tabs.Tab value="maintenance" leftSection={<Wrench size={16} />}>
            Maintenance
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general">
          <GeneralSettings />
        </Tabs.Panel>

        <Tabs.Panel value="maintenance">
          <MaintenanceSettings />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
