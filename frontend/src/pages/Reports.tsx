import { Container, Title, Text, Stack } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { CheckpointDatabase } from "../../wailsjs/go/main/App";
import { LinkIntegrityReport, ItemHealthReport } from "../components/Reports";

export default function Reports() {
  const queryClient = useQueryClient();

  // Add keyboard shortcut for Cmd+R to reload
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        // Checkpoint database before reloading
        try {
          await CheckpointDatabase();
        } catch (error) {
          console.error("Failed to checkpoint database:", error);
        }
        queryClient.invalidateQueries({ queryKey: ["unlinkedReferences"] });
        queryClient.invalidateQueries({ queryKey: ["duplicateItems"] });
        queryClient.invalidateQueries({ queryKey: ["orphanedItems"] });
        queryClient.invalidateQueries({ queryKey: ["linkedNotInDef"] });
        queryClient.invalidateQueries({ queryKey: ["danglingLinks"] });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [queryClient]);

  return (
    <Container size="100%" py="xl" px="xl">
      <Stack gap="sm">
        <div>
          <Title order={1} mb="xs">
            Reports
          </Title>
          <Text c="dimmed">Data quality and analysis reports</Text>
        </div>

        <LinkIntegrityReport />
        <ItemHealthReport />
      </Stack>
    </Container>
  );
}
