import { Paper, Text, Group, ScrollArea, Button, ActionIcon } from "@mantine/core";
import { Link as RouterLink } from "react-router-dom";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { database } from "../../../wailsjs/go/models";
import { getItemColor } from "../../utils/colors";
import { useState } from "react";

interface NavigationHistoryProps {
  history: database.Item[] | null;
}

export function NavigationHistory({ history }: NavigationHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (!history || history.length === 0) return null;

  const displayedHistory = expanded ? history : history.slice(0, 10);

  return (
    <Paper withBorder p="md" radius="md">
      <Group mb="md" justify="space-between">
        <Group>
          <History size={20} />
          <Text fw={500}>Recent Path</Text>
        </Group>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </ActionIcon>
      </Group>
      <ScrollArea type="hover" scrollbarSize={6} h={expanded ? 200 : undefined}>
        <Group wrap={expanded ? "wrap" : "nowrap"} gap="xs">
          {displayedHistory.map((item) => (
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
