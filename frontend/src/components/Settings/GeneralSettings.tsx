import {
  Title,
  Text,
  Paper,
  Table,
  Loader,
  Alert,
  Group,
  Badge,
  Button,
  TextInput,
  Stack,
} from "@mantine/core";
import {
  GetAllSettings,
  GetCredentialsPath,
  GetCapabilities,
  GetTTSCacheInfo,
  GetImageCacheInfo,
  GetDatabaseFileSize,
  GetEntity,
} from "@wailsjs/go/app/App";
import {
  IconAlertCircle,
  IconSearch,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useState, useRef, useEffect } from "react";
import { FirstRunModal } from "@components/FirstRunModal";

export function GeneralSettings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editEnvModalOpen, setEditEnvModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<Awaited<
    ReturnType<typeof GetAllSettings>
  > | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [credsPath, setCredsPath] = useState<string | null>(null);
  const [hasAi, setHasAi] = useState<boolean | null>(null);
  const [cacheInfo, setCacheInfo] = useState<Awaited<
    ReturnType<typeof GetTTSCacheInfo>
  > | null>(null);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [imageCacheInfo, setImageCacheInfo] = useState<Awaited<
    ReturnType<typeof GetImageCacheInfo>
  > | null>(null);
  const [imageCacheLoading, setImageCacheLoading] = useState(true);
  const [dbFileSize, setDbFileSize] = useState<number | null>(null);
  const [dbSizeLoading, setDbSizeLoading] = useState(true);
  const [lastWordItem, setLastWordItem] = useState<Awaited<
    ReturnType<typeof GetEntity>
  > | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        e.stopPropagation();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const loadSettings = () => {
      GetAllSettings()
        .then((s) => {
          setSettings(s);
          setSettingsError(null);
        })
        .catch((e: Error) => setSettingsError(e.message))
        .finally(() => setSettingsLoading(false));
    };
    loadSettings();
    const interval = setInterval(loadSettings, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    import("../../../wailsjs/go/app/App").then(({ GetDatabasePath }) => {
      GetDatabasePath()
        .then(setDbPath)
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    GetCredentialsPath()
      .then(setCredsPath)
      .catch(() => {});
    GetCapabilities()
      .then((c) => setHasAi(c.hasAi))
      .catch(() => setHasAi(false));
    GetTTSCacheInfo()
      .then(setCacheInfo)
      .catch(() => {})
      .finally(() => setCacheLoading(false));
    GetImageCacheInfo()
      .then(setImageCacheInfo)
      .catch(() => {})
      .finally(() => setImageCacheLoading(false));
    GetDatabaseFileSize()
      .then(setDbFileSize)
      .catch(() => {})
      .finally(() => setDbSizeLoading(false));
  }, []);

  useEffect(() => {
    if (settings?.lastWordId) {
      GetEntity(settings.lastWordId)
        .then(setLastWordItem)
        .catch(() => {});
    }
  }, [settings?.lastWordId]);

  if (settingsLoading) {
    return (
      <Stack align="center" justify="center" style={{ height: "50vh" }}>
        <Loader size="xl" />
        <Text>Loading settings...</Text>
      </Stack>
    );
  }

  return (
    <>
      <TextInput
        ref={searchInputRef}
        placeholder="Search settings..."
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.currentTarget.value)}
        mb="xs"
      />

      {/* Database Information Section */}
      <Paper shadow="sm" radius="md" withBorder p="sm" mb="xs">
        <Group justify="space-between" mb="xs" gap="xs">
          <Group>
            <Title order={3}>Database Information</Title>
            <Badge color="teal">Active Database</Badge>
          </Group>
        </Group>

        {settingsError ? (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
            Failed to load database settings
          </Alert>
        ) : settings ? (
          <>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={300}>Setting</Table.Th>
                  <Table.Th>Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[
                  {
                    key: "Database Path",
                    value:
                      (dbPath || "Loading...") +
                      (dbSizeLoading
                        ? ""
                        : dbFileSize
                          ? ` (${(dbFileSize / 1024 / 1024).toFixed(2)} MB)`
                          : ""),
                  },
                  {
                    key: "TTS Cache",
                    value: cacheLoading
                      ? "Loading..."
                      : cacheInfo
                        ? `${cacheInfo.fileCount} file${cacheInfo.fileCount !== 1 ? "s" : ""}, ${(cacheInfo.totalSize / 1024 / 1024).toFixed(2)} MB`
                        : "No cache data",
                  },
                  {
                    key: "Image Cache",
                    value: imageCacheLoading
                      ? "Loading..."
                      : imageCacheInfo
                        ? `${imageCacheInfo.fileCount} file${imageCacheInfo.fileCount !== 1 ? "s" : ""}, ${(imageCacheInfo.totalSize / 1024 / 1024).toFixed(2)} MB`
                        : "No cache data",
                  },
                ]
                  .filter(
                    (row) =>
                      !searchQuery ||
                      row.key
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      row.value
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
                  )
                  .map((row) => (
                    <Table.Tr key={row.key}>
                      <Table.Td>
                        <Text fw={500}>{row.key}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text>{row.value}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
              </Table.Tbody>
            </Table>
          </>
        ) : null}
      </Paper>

      {/* Settings.json Section */}
      <Paper shadow="sm" radius="md" withBorder p="sm" mb="xs">
        <Group mb="xs" gap="xs">
          <Title order={3}>Application Settings</Title>
          <Badge color="blue">settings.json</Badge>
        </Group>
        <Text size="sm" c="dimmed">
          Location: ~/.local/share/trueblocks/poetry/settings.json
        </Text>

        {settingsError ? (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
            Failed to load settings
          </Alert>
        ) : settings ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={300}>Setting</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Object.entries(settings)
                .filter(([key]) => key !== "window" && key !== "database")
                .map(([key, value]) => {
                  let displayValue = String(value);

                  if (key === "lastWordId" && lastWordItem) {
                    displayValue = `${value} (${lastWordItem.primaryLabel})`;
                  } else if (key === "collapsed" && typeof value === "object") {
                    const bools = Object.values(
                      value as Record<string, boolean>,
                    ).map((b) => b.toString());
                    displayValue = `[ ${bools.join(" ")} ]`;
                  }

                  return { key, displayValue };
                })
                .filter(
                  ({ key, displayValue }) =>
                    !searchQuery ||
                    key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    displayValue
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()),
                )
                .map(({ key, displayValue }) => (
                  <Table.Tr key={key}>
                    <Table.Td>
                      <Text fw={500}>{key}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>{displayValue}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              {settings.window &&
                (!searchQuery ||
                  "window".includes(searchQuery.toLowerCase()) ||
                  `{x: ${settings.window.x}, y: ${settings.window.y}, w: ${settings.window.width}, h: ${settings.window.height}, lb: ${settings.window.leftbarWidth}}`
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())) && (
                  <Table.Tr>
                    <Table.Td>
                      <Text fw={500}>window</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>
                        {`{x: ${settings.window.x}, y: ${settings.window.y}, w: ${settings.window.width}, h: ${settings.window.height}, lb: ${settings.window.leftbarWidth}}`}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed">No settings found</Text>
        )}
      </Paper>

      {/* AI Credentials Section */}
      <Paper shadow="sm" radius="md" withBorder p="sm">
        <Group mb="xs" justify="space-between">
          <Group gap="xs">
            <Title order={3}>AI Credentials</Title>
            <Badge color={hasAi ? "green" : "gray"}>
              {hasAi === null
                ? "checking..."
                : hasAi
                  ? "configured"
                  : "not configured"}
            </Badge>
          </Group>
          <Button
            leftSection={<IconInfoCircle size={16} />}
            variant="light"
            size="xs"
            onClick={() => setEditEnvModalOpen(true)}
          >
            How to configure
          </Button>
        </Group>
        <Text size="sm" c="dimmed">
          Managed by hand in: {credsPath || "Loading..."}
        </Text>
      </Paper>

      <FirstRunModal
        opened={editEnvModalOpen}
        onClose={() => setEditEnvModalOpen(false)}
        mode="edit"
      />
    </>
  );
}
