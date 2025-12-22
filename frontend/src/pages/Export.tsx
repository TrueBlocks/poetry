import { useState, useEffect } from "react";
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Button,
  List,
  Group,
  Stack,
  Alert,
} from "@mantine/core";
import { Download, FileJson, FileText, FolderOpen } from "lucide-react";
import { notifications } from "@mantine/notifications";

export default function Export() {
  const [exporting, setExporting] = useState(false);
  const [exportFolder, setExportFolder] = useState<string>("");
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { GetSettings } = await import("../../wailsjs/go/main/App.js");
        const settings = await GetSettings();
        setExportFolder(settings.exportFolder || "");
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoadingSettings(false);
      }
    };
    loadSettings();
  }, []);

  const selectFolder = async () => {
    try {
      const { SelectExportFolder } =
        await import("../../wailsjs/go/main/App.js");
      const folder = await SelectExportFolder();

      if (folder) {
        setExportFolder(folder);
        notifications.show({
          title: "Folder Selected",
          message: `Exports will be saved to: ${folder}`,
          color: "blue",
        });
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
      notifications.show({
        title: "Selection Failed",
        message: String(error),
        color: "red",
      });
    }
  };

  const ensureFolderSelected = async (): Promise<boolean> => {
    if (exportFolder) {
      return true;
    }

    // Prompt user to select folder
    try {
      const { SelectExportFolder } =
        await import("../../wailsjs/go/main/App.js");
      const folder = await SelectExportFolder();

      if (folder) {
        setExportFolder(folder);
        return true;
      }

      notifications.show({
        title: "Folder Required",
        message: "Please select an export folder to continue",
        color: "orange",
      });
      return false;
    } catch (error) {
      console.error("Failed to select folder:", error);
      notifications.show({
        title: "Selection Failed",
        message: String(error),
        color: "red",
      });
      return false;
    }
  };

  const exportJSON = async () => {
    if (!(await ensureFolderSelected())) {
      return;
    }
    setExporting(true);
    try {
      const { ExportToJSON } = await import("../../wailsjs/go/main/App.js");
      const filepath = await ExportToJSON();

      notifications.show({
        title: "Export Complete",
        message: `Saved to: ${filepath}`,
        color: "green",
      });
    } catch (error) {
      console.error("Export failed:", error);
      notifications.show({
        title: "Export Failed",
        message: String(error),
        color: "red",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportMarkdown = async () => {
    if (!(await ensureFolderSelected())) {
      return;
    }

    setExporting(true);
    try {
      const { ExportToMarkdown } = await import("../../wailsjs/go/main/App.js");
      const filepath = await ExportToMarkdown();

      notifications.show({
        title: "Export Complete",
        message: `Saved to: ${filepath}`,
        color: "green",
      });
    } catch (error) {
      console.error("Export failed:", error);
      notifications.show({
        title: "Export Failed",
        message: String(error),
        color: "red",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportBoth = async () => {
    if (!(await ensureFolderSelected())) {
      return;
    }

    setExporting(true);
    try {
      const { ExportToJSON, ExportToMarkdown } =
        await import("../../wailsjs/go/main/App.js");

      // Export JSON
      await ExportToJSON();

      // Export Markdown
      await ExportToMarkdown();

      notifications.show({
        title: "Export Complete",
        message: `Both formats saved successfully`,
        color: "teal",
      });
    } catch (error) {
      console.error("Export failed:", error);
      notifications.show({
        title: "Export Failed",
        message: String(error),
        color: "red",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Container size="lg">
      <Stack mb="xl">
        <Title order={1}>Export Database</Title>
        <Text c="dimmed">
          Download your entire poetry database in various formats
        </Text>
      </Stack>

      <Card shadow="sm" padding="lg" radius="md" withBorder mb="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4} mb={4}>
              Export Location
            </Title>
            {loadingSettings ? (
              <Text size="sm" c="dimmed">
                Loading...
              </Text>
            ) : exportFolder ? (
              <Text size="sm" c="dimmed">
                {exportFolder}
              </Text>
            ) : (
              <Text size="sm" c="orange">
                No folder selected - will prompt on first export
              </Text>
            )}
          </div>

          <Button
            onClick={selectFolder}
            leftSection={<FolderOpen size={20} />}
            variant="light"
          >
            {exportFolder ? "Change Folder" : "Select Folder"}
          </Button>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group mb="md">
            <FileJson size={32} />
            <div>
              <Title order={3}>JSON Format</Title>
              <Text size="sm" c="dimmed">
                Structured data export
              </Text>
            </div>
          </Group>

          <Text mb="md">
            Export all items and links as JSON. Perfect for programmatic access,
            backups, or importing into other tools.
          </Text>

          <List size="sm" mb="md">
            <List.Item>Complete database structure</List.Item>
            <List.Item>All metadata preserved</List.Item>
            <List.Item>Easy to parse and process</List.Item>
            <List.Item>Includes relationships</List.Item>
            <List.Item>Includes all data quality reports</List.Item>
            <List.Item>Tags remain unresolved (raw format)</List.Item>
          </List>

          <Button
            fullWidth
            onClick={exportJSON}
            loading={exporting}
            leftSection={<Download size={20} />}
            color="blue"
          >
            Export as JSON
          </Button>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group mb="md">
            <FileText size={32} />
            <div>
              <Title order={3}>Markdown Format</Title>
              <Text size="sm" c="dimmed">
                Human-readable export
              </Text>
            </div>
          </Group>

          <Text mb="md">
            Export all items as formatted Markdown. Great for documentation,
            sharing, or publishing. Also produces a much easier to read output.
          </Text>

          <List size="sm" mb="md">
            <List.Item>Beautiful formatting</List.Item>
            <List.Item>Easy to read and edit</List.Item>
            <List.Item>Compatible with most platforms</List.Item>
            <List.Item>Perfect for publishing</List.Item>
            <List.Item>Includes all data quality reports</List.Item>
            <List.Item>Tags resolved to bold small caps</List.Item>
          </List>

          <Button
            fullWidth
            onClick={exportMarkdown}
            loading={exporting}
            leftSection={<Download size={20} />}
            color="green"
          >
            Export as Markdown
          </Button>
        </Card>
      </SimpleGrid>

      <Card
        shadow="sm"
        padding="md"
        radius="md"
        withBorder
        mt="lg"
        style={{
          background:
            "linear-gradient(135deg, rgba(66, 153, 225, 0.05) 0%, rgba(72, 187, 120, 0.05) 100%)",
        }}
      >
        <Group justify="center">
          <Button
            onClick={exportBoth}
            loading={exporting}
            leftSection={<Download size={18} />}
            size="md"
            variant="gradient"
            gradient={{ from: "blue", to: "teal", deg: 135 }}
          >
            Export Both Formats
          </Button>
        </Group>
      </Card>

      <Alert color="blue" mt="xl">
        <Text size="sm">
          <strong>Note:</strong> Exports include all items and their
          connections. Files are saved to the exports subfolder within your
          selected data folder.
        </Text>
      </Alert>
    </Container>
  );
}
