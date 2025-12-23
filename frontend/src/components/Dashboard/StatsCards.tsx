import { SimpleGrid, Paper, Text, Group, ThemeIcon } from "@mantine/core";
import {
  TrendingUp,
  Link as LinkIcon,
  Quote,
  Book,
  Feather,
  Heading,
  Type,
  AlertTriangle,
  PenTool,
} from "lucide-react";
import { Link } from "react-router-dom";
import { database } from "@wailsjs/go/models";

interface StatsCardsProps {
  stats: database.DashboardStats | null;
}

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) return null;

  const items = [
    {
      title: "Total Items",
      value: stats.totalItems,
      icon: TrendingUp,
      color: "blue",
      to: "/tables?table=items",
    },
    {
      title: "Poems",
      value: stats.quoteCount,
      icon: Quote,
      color: "grape",
      to: "/tables?table=items&filter=quotes",
    },
    {
      title: "Writers",
      value: stats.writerCount,
      icon: Feather,
      color: "pink",
      to: "/tables?table=items&filter=writer",
    },
    {
      title: "Words",
      value: stats.wordCount,
      icon: Type,
      color: "indigo",
      to: "/tables?table=items&filter=reference",
    },
    {
      title: "Total Links",
      value: stats.totalLinks,
      icon: LinkIcon,
      color: "cyan",
      to: "/tables?table=links",
    },
    {
      title: "Sourced",
      value: stats.citedCount,
      icon: Book,
      color: "green",
      to: "/tables?table=items&filter=cited",
      disabled: true,
    },
    {
      title: "Poets",
      value: stats.poetCount,
      icon: PenTool,
      color: "teal",
      to: "/tables?table=items&filter=poets",
      disabled: false,
    },
    {
      title: "Titles",
      value: stats.titleCount,
      icon: Heading,
      color: "violet",
      to: "/tables?table=items&filter=title",
    },
    {
      title: "Errors",
      value: stats.errorCount,
      icon: AlertTriangle,
      color: "red",
      to: "/reports",
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
      {items
        .filter((item) => !item.disabled)
        .map((item) => (
          <Paper
            key={item.title}
            component={Link}
            to={item.to}
            withBorder
            p="md"
            radius="md"
            style={{
              textDecoration: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <Group justify="space-between">
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  {item.title}
                </Text>
                <Text fw={700} size="xl">
                  {item.value.toLocaleString()}
                </Text>
              </div>
              <ThemeIcon
                color={item.color}
                variant="light"
                size={38}
                radius="md"
              >
                <item.icon size={20} />
              </ThemeIcon>
            </Group>
          </Paper>
        ))}
    </SimpleGrid>
  );
}
