import { Paper, Text, Group, ScrollArea, Button } from "@mantine/core";
import { Link as RouterLink } from "react-router-dom";
import { History } from "lucide-react";
import { database } from "../../../wailsjs/go/models";
import { getItemColor } from "../../utils/colors";

interface NavigationHistoryProps {
  history: database.Item[] | null;
}

export function NavigationHistory({ history }: NavigationHistoryProps) {
  if (!history || history.length === 0) return null;

  return (
    <Paper withBorder p="md" radius="md">
      <Group mb="md">
        <History size={20} />
        <Text fw={500}>Recent Path</Text>
      </Group>
      <ScrollArea type="hover" scrollbarSize={6}>
        <Group wrap="nowrap" gap="xs">
          {history.map((item) => (
            <Button
              key={item.itemId}
              component={RouterLink}
              to={`/item/${item.itemId}`}
              variant="light"
              size="xs"
              color="gray"
              style={{
                backgroundColor: getItemColor(item.type),
                color: "#000",
                border: "1px solid #dee2e6",
              }}
            >
              {item.word}
            </Button>
          ))}
        </Group>
      </ScrollArea>
    </Paper>
  );
}
