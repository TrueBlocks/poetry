import { useQuery } from "@tanstack/react-query";
import { Group, Text } from "@mantine/core";
import { GetSettings, GetItem } from "@wailsjs/go/main/App.js";

export default function Footer() {
  const { data: settings } = useQuery({
    queryKey: ["allSettings"],
    queryFn: GetSettings,
    refetchInterval: 500,
  });

  const { data: currentItem } = useQuery({
    queryKey: ["currentItem", settings?.lastWordId],
    queryFn: () => GetItem(settings!.lastWordId),
    enabled: !!settings?.lastWordId && settings.lastWordId > 0,
  });

  let currentItemDisplay = "None - Select an item";
  if (currentItem?.word) {
    currentItemDisplay = currentItem.word;
  }

  const currentSearch = settings?.currentSearch || "";

  return (
    <Group
      justify="space-between"
      px="md"
      py="xs"
      style={{
        borderTop: "1px solid var(--mantine-color-gray-4)",
        backgroundColor: "var(--mantine-color-body)",
        minHeight: "32px",
      }}
    >
      <Text size="xs" c="dimmed">
        DB: poetry.db
      </Text>
      <Group gap="xl">
        {currentSearch && <Text size="xs">Search: {currentSearch}</Text>}
        <Text size="xs" c={currentItem?.word ? undefined : "dimmed"}>
          Current: {currentItemDisplay}
        </Text>
      </Group>
    </Group>
  );
}
