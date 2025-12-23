import { Link } from "react-router-dom";
import {
  Stack,
  Text,
  Paper,
  Group,
  ActionIcon,
  useMantineColorScheme,
} from "@mantine/core";
import { Network, ChevronDown, ChevronRight } from "lucide-react";
import { getItemColor } from "@utils/colors";
import { database } from "@models";

interface LinksListProps {
  itemId: number;
  links: database.Link[] | null;
  linkedItemsData: Record<number, database.Item>;
  outgoingCollapsed: boolean;
  incomingCollapsed: boolean;
  onToggleOutgoing: () => void;
  onToggleIncoming: () => void;
}

export function LinksList({
  itemId,
  links,
  linkedItemsData,
  outgoingCollapsed,
  incomingCollapsed,
  onToggleOutgoing,
  onToggleIncoming,
}: LinksListProps) {
  const { colorScheme } = useMantineColorScheme();

  return (
    <div
      style={{
        flex: "1",
        padding: "1rem",
        overflowY: "auto",
        backgroundColor: colorScheme === "dark" ? "#25262b" : "#f8f9fa",
      }}
    >
      <Stack gap="md">
        {/* Outgoing Section */}
        <div>
          <Group
            gap="xs"
            mb="xs"
            style={{ cursor: "pointer", userSelect: "none" }}
            onClick={onToggleOutgoing}
          >
            {outgoingCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
            <Text size="sm" fw={500}>
              Outgoing (
              {links?.filter((l) => l.sourceItemId === itemId).length || 0})
            </Text>
          </Group>
          {!outgoingCollapsed && (
            <Stack gap="xs">
              {links &&
              links.filter((l) => l.sourceItemId === itemId).length > 0 ? (
                links
                  .filter((link) => link.sourceItemId === itemId)
                  .map((link) => {
                    const linkedItemId = link.destinationItemId;
                    const linkedItem = linkedItemsData?.[linkedItemId];

                    return (
                      <Paper
                        key={link.linkId}
                        p="xs"
                        withBorder
                        style={{
                          backgroundColor: linkedItem?.type
                            ? getItemColor(linkedItem.type)
                            : undefined,
                        }}
                      >
                        {linkedItem ? (
                          <Group gap="xs" align="center">
                            <Text
                              component={Link}
                              to={`/item/${linkedItemId}?tab=detail`}
                              size="xs"
                              fw={600}
                              c="dark"
                              style={{
                                textDecoration: "none",
                                lineHeight: 1.2,
                                flex: 1,
                              }}
                              onClick={(e: React.MouseEvent) => {
                                if (e.metaKey || e.ctrlKey) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              {linkedItem.word}
                            </Text>
                            <ActionIcon
                              component={Link}
                              to={`/item/${linkedItemId}?tab=graph`}
                              size="xs"
                              variant="subtle"
                              color="dark"
                              title="Show in graph"
                            >
                              <Network size={12} />
                            </ActionIcon>
                          </Group>
                        ) : (
                          <Text size="xs" c="dark">
                            Loading...
                          </Text>
                        )}
                      </Paper>
                    );
                  })
              ) : (
                <Text size="xs" c="dimmed" ta="center">
                  No outgoing connections
                </Text>
              )}
            </Stack>
          )}
        </div>

        {/* Incoming Section */}
        <div>
          <Group
            gap="xs"
            mb="xs"
            style={{ cursor: "pointer", userSelect: "none" }}
            onClick={onToggleIncoming}
          >
            {incomingCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
            <Text size="sm" fw={500}>
              Incoming (
              {links?.filter((l) => l.destinationItemId === itemId).length || 0}
              )
            </Text>
          </Group>
          {!incomingCollapsed && (
            <Stack gap="xs">
              {links &&
              links.filter((l) => l.destinationItemId === itemId).length > 0 ? (
                links
                  .filter((link) => link.destinationItemId === itemId)
                  .map((link) => {
                    const linkedItemId = link.sourceItemId;
                    const linkedItem = linkedItemsData?.[linkedItemId];

                    return (
                      <Paper
                        key={link.linkId}
                        p="xs"
                        withBorder
                        style={{
                          backgroundColor: linkedItem?.type
                            ? getItemColor(linkedItem.type)
                            : undefined,
                        }}
                      >
                        {linkedItem ? (
                          <Group gap="xs" align="center">
                            <Text
                              component={Link}
                              to={`/item/${linkedItemId}?tab=detail`}
                              size="xs"
                              fw={600}
                              c="dark"
                              style={{
                                textDecoration: "none",
                                lineHeight: 1.2,
                                flex: 1,
                              }}
                              onClick={(e: React.MouseEvent) => {
                                if (e.metaKey || e.ctrlKey) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              {linkedItem.word}
                            </Text>
                            <ActionIcon
                              component={Link}
                              to={`/item/${linkedItemId}?tab=graph`}
                              size="xs"
                              variant="subtle"
                              color="dark"
                              title="Show in graph"
                            >
                              <Network size={12} />
                            </ActionIcon>
                          </Group>
                        ) : (
                          <Text size="xs" c="dark">
                            Loading...
                          </Text>
                        )}
                      </Paper>
                    );
                  })
              ) : (
                <Text size="xs" c="dimmed" ta="center">
                  No incoming connections
                </Text>
              )}
            </Stack>
          )}
        </div>
      </Stack>
    </div>
  );
}
