import { useEffect } from "react";
import { Container, Title, Text, Tabs, Paper, Stack } from "@mantine/core";
import { IconFlask } from "@tabler/icons-react";
import { useUI } from "@/contexts/UIContext";

const FEATURES = {
  pathfind: "Pathfind",
  analyzer: "Analyzer",
  semantic: "Semantic",
  workshop: "Workshop",
  dreamscapes: "Dreamscapes",
  synesthetic: "Synesthetic",
  resurrection: "Resurrection",
  quantum: "Quantum",
  archaeology: "Archaeology",
  sculptures: "Sculptures",
  weaver: "Weaver",
} as const;

export default function Experimental() {
  const { tabSelections, setTabSelection } = useUI();
  const activeTab = tabSelections["experimental"] || "pathfind";

  const handleTabChange = (value: string | null) => {
    if (value) {
      setTabSelection("experimental", value);
    }
  };

  useEffect(() => {
    const tabOrder = Object.keys(FEATURES);
    const onCycleTab = (e: Event) => {
      if ((e as CustomEvent).detail !== "experimental") return;
      const idx = tabOrder.indexOf(activeTab);
      setTabSelection("experimental", tabOrder[(idx + 1) % tabOrder.length]);
    };
    window.addEventListener("view:cycleTab", onCycleTab);
    return () => window.removeEventListener("view:cycleTab", onCycleTab);
  }, [activeTab, setTabSelection]);

  return (
    <Container size="100%" py="xl" px="xl">
      <Stack gap="sm">
        <div>
          <Title order={1} mb="xs">
            Experimental Features
          </Title>
          <Text c="dimmed">AI-powered poetry features in development</Text>
        </div>

        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List mb="md">
            <Tabs.Tab value="pathfind" leftSection={<IconFlask size={16} />}>
              {FEATURES.pathfind}
            </Tabs.Tab>
            <Tabs.Tab value="analyzer" leftSection={<IconFlask size={16} />}>
              {FEATURES.analyzer}
            </Tabs.Tab>
            <Tabs.Tab value="semantic" leftSection={<IconFlask size={16} />}>
              {FEATURES.semantic}
            </Tabs.Tab>
            <Tabs.Tab value="workshop" leftSection={<IconFlask size={16} />}>
              {FEATURES.workshop}
            </Tabs.Tab>
            <Tabs.Tab value="dreamscapes" leftSection={<IconFlask size={16} />}>
              {FEATURES.dreamscapes}
            </Tabs.Tab>
            <Tabs.Tab value="synesthetic" leftSection={<IconFlask size={16} />}>
              {FEATURES.synesthetic}
            </Tabs.Tab>
            <Tabs.Tab
              value="resurrection"
              leftSection={<IconFlask size={16} />}
            >
              {FEATURES.resurrection}
            </Tabs.Tab>
            <Tabs.Tab value="quantum" leftSection={<IconFlask size={16} />}>
              {FEATURES.quantum}
            </Tabs.Tab>
            <Tabs.Tab value="archaeology" leftSection={<IconFlask size={16} />}>
              {FEATURES.archaeology}
            </Tabs.Tab>
            <Tabs.Tab value="sculptures" leftSection={<IconFlask size={16} />}>
              {FEATURES.sculptures}
            </Tabs.Tab>
            <Tabs.Tab value="weaver" leftSection={<IconFlask size={16} />}>
              {FEATURES.weaver}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="pathfind">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.pathfind}</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="analyzer">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.analyzer}</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="semantic">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.semantic}</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="workshop">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.workshop}</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="dreamscapes">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.dreamscapes}</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="synesthetic">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.synesthetic}</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="resurrection">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.resurrection}</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="quantum">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.quantum}</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="archaeology">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.archaeology}</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="sculptures">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.sculptures}</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="weaver">
            <Paper p="xl" withBorder>
              <Text>{FEATURES.weaver}</Text>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
