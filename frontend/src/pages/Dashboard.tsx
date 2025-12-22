import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useRef } from "react";
import { useHotkeys } from "@mantine/hooks";
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Loader,
  Badge,
  Paper,
  Grid,
} from "@mantine/core";
import {
  GetRandomItem,
  GetExtendedStats,
  GetNavigationHistory,
  GetMarkedItems,
  GetTopHubs,
  GetAllItems,
} from "../../wailsjs/go/main/App.js";
import { Sparkles, Plus } from "lucide-react";
import { StatsCards } from "../components/Dashboard/StatsCards";
import { NavigationHistory } from "../components/Dashboard/NavigationHistory";
import { Workbench } from "../components/Dashboard/Workbench";
import { HubsList } from "../components/Dashboard/HubsList";
import { DefinitionRenderer } from "../components/ItemDetail/DefinitionRenderer";
import { REFERENCE_COLOR_MAP } from "../utils/references";
import { useUIStore } from "../stores/useUIStore";

// interface DashboardProps {
//   // stats: Record<string, number> | null // Deprecated, we fetch extended stats now
// }

export default function Dashboard() {
  useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { showMarked, setShowMarked } = useUIStore();

  const { data: allItems } = useQuery({
    queryKey: ["allItems"],
    queryFn: GetAllItems,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const {
    data: randomItem,
    refetch: refetchRandomItem,
    isLoading: isLoadingRandom,
  } = useQuery({
    queryKey: ["randomItem"],
    queryFn: GetRandomItem,
    refetchOnWindowFocus: false,
  });

  const { data: extendedStats } = useQuery({
    queryKey: ["extendedStats"],
    queryFn: GetExtendedStats,
  });

  const { data: navigationHistory } = useQuery({
    queryKey: ["navigationHistory"],
    queryFn: GetNavigationHistory,
  });

  const { data: markedItems } = useQuery({
    queryKey: ["markedItems"],
    queryFn: GetMarkedItems,
  });

  const { data: topHubs } = useQuery({
    queryKey: ["topHubs"],
    queryFn: () => GetTopHubs(20),
  });

  useHotkeys([
    [
      "mod+r",
      (e) => {
        e.preventDefault();
        refetchRandomItem();
      },
    ],
  ]);

  const handleToggleShowMarked = async () => {
    setShowMarked(!showMarked);
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={1}>Dashboard</Title>
          <Text c="dimmed">Your literary ecosystem at a glance</Text>
        </div>
        <Button
          component={Link}
          to="/item/new?tab=detail"
          leftSection={<Plus size={20} />}
        >
          New Item
        </Button>
      </Group>

      {/* Navigation History */}
      <div style={{ marginBottom: "var(--mantine-spacing-xl)" }}>
        <NavigationHistory history={navigationHistory || []} />
      </div>

      {/* Extended Stats */}
      <div style={{ marginBottom: "var(--mantine-spacing-xl)" }}>
        <StatsCards stats={extendedStats || null} />
      </div>

      <Grid gutter="md">
        {/* Left Column: Workbench & Hubs */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            {showMarked ? (
              <Workbench
                items={markedItems || []}
                onToggle={handleToggleShowMarked}
              />
            ) : (
              <HubsList
                hubs={topHubs || []}
                onToggle={handleToggleShowMarked}
              />
            )}
          </Stack>
        </Grid.Col>
        {/* Right Column: Random Discovery */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper radius="md" withBorder p="md" h="100%">
            <Group mb="md" justify="space-between">
              <Group>
                <Sparkles size={20} />
                <Text fw={500}>Random Discovery</Text>
              </Group>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => refetchRandomItem()}
                loading={isLoadingRandom}
              >
                Shuffle
              </Button>
            </Group>

            {isLoadingRandom ? (
              <Group justify="center" p="xl">
                <Loader />
              </Group>
            ) : randomItem ? (
              <Stack
                gap="md"
                justify="center"
                h="100%"
                style={{ minHeight: 300 }}
              >
                <Stack gap="xs" align="center" ta="center">
                  <Badge
                    size="lg"
                    variant="light"
                    color={
                      REFERENCE_COLOR_MAP[
                        randomItem.type === "Reference"
                          ? "word"
                          : randomItem.type.toLowerCase()
                      ] || "gray"
                    }
                  >
                    {randomItem.type}
                  </Badge>
                  <Title order={2} style={{ fontSize: "2rem" }}>
                    <Link
                      to={`/item/${randomItem.itemId}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {randomItem.word}
                    </Link>
                  </Title>
                  {randomItem.definition && (
                    <div
                      style={{
                        maxWidth: "80%",
                        textAlign: "left",
                        maxHeight: "300px",
                        overflow: "hidden",
                        position: "relative",
                        maskImage:
                          "linear-gradient(to bottom, black 80%, transparent 100%)",
                        WebkitMaskImage:
                          "linear-gradient(to bottom, black 80%, transparent 100%)",
                      }}
                    >
                      <DefinitionRenderer
                        text={randomItem.definition}
                        allItems={allItems || []}
                        stopAudio={() => {
                          if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current = null;
                          }
                        }}
                        currentAudioRef={audioRef}
                        item={randomItem}
                      />
                    </div>
                  )}
                  <Button
                    component={Link}
                    to={`/item/${randomItem.itemId}`}
                    variant="light"
                    mt="md"
                  >
                    View Details
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Text ta="center" c="dimmed">
                No items found.
              </Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
