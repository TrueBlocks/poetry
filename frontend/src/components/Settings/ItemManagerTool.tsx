import { useState, useRef, useEffect } from "react";
import * as models from "@wailsjs/go/models";
import {
  TextInput,
  Button,
  Stack,
  Group,
  Text,
  Alert,
  Badge,
  Paper,
  Select,
  Grid,
  Box,
} from "@mantine/core";
import {
  SearchItemsWithOptions,
  UpdateItem,
  GetSettings,
  UpdateSettings,
  DeleteItem,
} from "@wailsjs/go/main/App";
import { LogInfo, LogError } from "@wailsjs/runtime/runtime";
import { database } from "@wailsjs/go/models";
import { notifications } from "@mantine/notifications";
import { AlertCircle, Check, Search, ArrowRight } from "lucide-react";
import { LogError as UtilsLogError } from "@utils/logger";

const ITEM_TYPES = [
  "Reference",
  "Title",
  "Writer",
  "School",
  "Term",
  "Source",
  "Cliche",
  "Name",
];

export function ItemManagerTool() {
  const [oldType, setOldType] = useState<string>("Title");
  const [newType, setNewType] = useState<string>("Title");
  const [oldTitle, setOldTitle] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [affectedItems, setAffectedItems] = useState<database.Item[]>([]);
  const [titleItem, setTitleItem] = useState<database.Item | null>(null);
  const [_, setTargetItem] = useState<database.Item | null>(null);
  const [isMerge, setIsMerge] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [__, setExecutedCount] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const oldTitleInputRef = useRef<HTMLInputElement>(null);

  // Load settings on mount
  useEffect(() => {
    GetSettings()
      .then((settings) => {
        if (settings) {
          if (settings.managerOldType) setOldType(settings.managerOldType);
          if (settings.managerNewType) setNewType(settings.managerNewType);
        }
      })
      .catch((e) => UtilsLogError(`Failed to load settings: ${e}`));
  }, []);

  // Save settings on change
  useEffect(() => {
    GetSettings()
      .then((s) => {
        if (s) {
          const newSettings = new models.settings.Settings({
            ...s,
            managerOldType: oldType,
            managerNewType: newType,
          });
          UpdateSettings(newSettings).catch((e) =>
            UtilsLogError(`Failed to update settings: ${e}`),
          );
        }
      })
      .catch((e) => UtilsLogError(`Failed to get settings: ${e}`));
  }, [oldType, newType]);

  useEffect(() => {
    // Focus the input when the component mounts
    if (oldTitleInputRef.current) {
      oldTitleInputRef.current.focus();
    }
  }, []);

  const handlePreview = async () => {
    if (!oldTitle || !newTitle) return;

    setIsPreviewing(true);
    setExecuted(false);
    setAffectedItems([]);
    setTitleItem(null);
    setTargetItem(null);
    setIsMerge(false);
    setConfirming(false);
    LogInfo(
      `Previewing rename: "${oldTitle}" (${oldType}) -> "${newTitle}" (${newType})`,
    );

    try {
      // 1. Search for the Source item itself
      const escapedOldTitle = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const titleSearchOpts = new database.SearchOptions({
        query: `^${escapedOldTitle}$`,
        types: [oldType],
        useRegex: true,
        caseSensitive: true,
        hasImage: false,
        hasTts: false,
        source: "",
      });

      const titleResults = await SearchItemsWithOptions(titleSearchOpts);
      if (titleResults && titleResults.length > 0) {
        // Pick the exact match if multiple (though regex ^$ should ensure exact)
        const exact = titleResults.find(
          (i) => i.word === oldTitle && i.type === oldType,
        );
        if (exact) setTitleItem(exact);
      } else {
        // Warn if source item not found
        notifications.show({
          title: "Item Not Found",
          message: `Could not find item "${oldTitle}" of type "${oldType}".`,
          color: "orange",
        });
      }

      // 2. Search for the Target item (to check for merge)
      const escapedNewTitle = newTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const targetSearchOpts = new database.SearchOptions({
        query: `^${escapedNewTitle}$`,
        types: [newType],
        useRegex: true,
        caseSensitive: true,
        hasImage: false,
        hasTts: false,
        source: "",
      });

      const targetResults = await SearchItemsWithOptions(targetSearchOpts);
      if (targetResults && targetResults.length > 0) {
        const exactTarget = targetResults.find(
          (i) => i.word === newTitle && i.type === newType,
        );
        if (exactTarget) {
          setTargetItem(exactTarget);
          setIsMerge(true);
          notifications.show({
            title: "Merge Detected",
            message: `Item "${newTitle}" already exists. This will be a merge operation.`,
            color: "yellow",
          });
        }
      }

      // 3. Search for references {type: OldTitle}
      // Determine tag prefix based on type
      const getTagPrefix = (t: string) => {
        if (t === "Title") return "title";
        if (t === "Writer") return "writer";
        return "word";
      };
      const tagPrefix = getTagPrefix(oldType);
      const refQuery = `\\{${tagPrefix}:\\s*${escapedOldTitle}\\}`;

      const refSearchOpts = new database.SearchOptions({
        query: refQuery,
        types: [], // All types
        useRegex: true,
        caseSensitive: true,
        hasImage: false,
        hasTts: false,
        source: "",
      });

      const refResults = await SearchItemsWithOptions(refSearchOpts);
      if (refResults) {
        setAffectedItems(refResults);
      }
    } catch (error) {
      notifications.show({
        title: "Error searching",
        message: String(error),
        color: "red",
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExecute = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setIsExecuting(true);
    LogInfo(
      `Executing rename: "${oldTitle}" (${oldType}) -> "${newTitle}" (${newType})`,
    );

    try {
      let successCount = 0;
      const escapedOldTitle = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const getTagPrefix = (t: string) => {
        if (t === "Title") return "title";
        if (t === "Writer") return "writer";
        return "word";
      };
      const oldTag = getTagPrefix(oldType);
      const newTag = getTagPrefix(newType);

      const regex = new RegExp(`\\{${oldTag}:\\s*${escapedOldTitle}\\}`, "g");
      const replacement = `{${newTag}: ${newTitle}}`;

      // 1. Handle the Source Item
      if (titleItem) {
        if (isMerge) {
          // Merge: Delete the old item
          LogInfo(`Merging: Deleting old item ${titleItem.word}`);
          await DeleteItem(titleItem.itemId);
          successCount++;
        } else {
          // Rename: Update the old item
          LogInfo(`Updating Source item: ${titleItem.word} -> ${newTitle}`);
          const updatedTitleItem = new database.Item({ ...titleItem });
          updatedTitleItem.word = newTitle;
          updatedTitleItem.type = newType;

          // Also update references inside the item itself
          if (updatedTitleItem.definition)
            updatedTitleItem.definition = updatedTitleItem.definition.replace(
              regex,
              replacement,
            );
          if (updatedTitleItem.derivation)
            updatedTitleItem.derivation = updatedTitleItem.derivation.replace(
              regex,
              replacement,
            );
          if (updatedTitleItem.appendicies)
            updatedTitleItem.appendicies = updatedTitleItem.appendicies.replace(
              regex,
              replacement,
            );

          await UpdateItem(updatedTitleItem);
          successCount++;
        }
      }

      // 2. Update all referencing items
      for (const item of affectedItems) {
        // Skip if it's the source item (already handled)
        if (titleItem && item.itemId === titleItem.itemId) continue;

        const updatedItem = new database.Item({ ...item });
        let changed = false;

        if (updatedItem.definition) {
          const newVal = updatedItem.definition.replace(regex, replacement);
          if (newVal !== updatedItem.definition) {
            updatedItem.definition = newVal;
            changed = true;
          }
        }
        if (updatedItem.derivation) {
          const newVal = updatedItem.derivation.replace(regex, replacement);
          if (newVal !== updatedItem.derivation) {
            updatedItem.derivation = newVal;
            changed = true;
          }
        }
        if (updatedItem.appendicies) {
          const newVal = updatedItem.appendicies.replace(regex, replacement);
          if (newVal !== updatedItem.appendicies) {
            updatedItem.appendicies = newVal;
            changed = true;
          }
        }

        if (changed) {
          LogInfo(`Updating reference in item: ${item.word}`);
          await UpdateItem(updatedItem);
          successCount++;
        }
      }

      LogInfo(`Rename complete. Updated ${successCount} items.`);
      notifications.show({
        title: "Operation Complete",
        message: `Successfully updated ${successCount} items.`,
        color: "green",
      });
      setExecuted(true);
      setExecutedCount(successCount);
      setAffectedItems([]);
      setTitleItem(null);
      setTargetItem(null);
      setIsMerge(false);
      setOldTitle("");
      setNewTitle("");
      setConfirming(false);
    } catch (error) {
      LogError(`Error executing rename: ${String(error)}`);
      notifications.show({
        title: "Error executing rename",
        message: String(error),
        color: "red",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500}>Item Manager</Text>
          <Badge color="blue" variant="light">
            Beta
          </Badge>
        </Group>

        <Text size="sm" c="dimmed">
          Rename items, change their type, or merge them. This tool will also
          update all references in other items.
        </Text>

        <Grid>
          <Grid.Col span={8}>
            <TextInput
              label="Old Item Name"
              placeholder="Exact name of item to change"
              value={oldTitle}
              onChange={(e) => setOldTitle(e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              label="Old Type"
              data={ITEM_TYPES}
              value={oldType}
              onChange={(val) => setOldType(val || "Title")}
              allowDeselect={false}
            />
          </Grid.Col>

          <Grid.Col span={8}>
            <TextInput
              label="New Item Name"
              placeholder="New name for the item"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              label="New Type"
              data={ITEM_TYPES}
              value={newType}
              onChange={(val) => setNewType(val || "Title")}
              allowDeselect={false}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end">
          <Button
            variant="light"
            onClick={handlePreview}
            loading={isPreviewing}
            disabled={!oldTitle || !newTitle}
            leftSection={<Search size={16} />}
          >
            Preview Changes
          </Button>
          <Button
            color={confirming ? "red" : "blue"}
            onClick={handleExecute}
            loading={isExecuting}
            disabled={!affectedItems.length && !titleItem}
          >
            {confirming
              ? "Click to Confirm"
              : isMerge
                ? "Execute Merge"
                : "Execute Rename"}
          </Button>
        </Group>

        {executed && (
          <Alert icon={<Check size={16} />} title="Success" color="green">
            Successfully {isMerge ? "merged" : "renamed"} item and updated
            references.
          </Alert>
        )}

        {isMerge && !executed && (
          <Alert
            icon={<AlertCircle size={16} />}
            title="Merge Warning"
            color="yellow"
          >
            Item &quot;{newTitle}&quot; already exists. Proceeding will DELETE
            &quot;{oldTitle}
            &quot; and update all references to point to &quot;{newTitle}&quot;.
          </Alert>
        )}

        {(affectedItems.length > 0 || titleItem) && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Found {affectedItems.length} references to update:
            </Text>

            {titleItem && (
              <Paper p="xs" withBorder bg="var(--mantine-color-blue-0)">
                <Group>
                  <Badge>Source</Badge>
                  <Text size="sm">
                    {titleItem.word} ({titleItem.type})
                  </Text>
                  <ArrowRight size={16} />
                  <Text size="sm">
                    {newTitle} ({newType})
                  </Text>
                  {isMerge && <Badge color="yellow">MERGE</Badge>}
                </Group>
              </Paper>
            )}

            <Box style={{ maxHeight: 300, overflowY: "auto" }}>
              <Stack gap={4}>
                {affectedItems.map((item) => (
                  <Paper key={item.itemId} p="xs" withBorder>
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        {item.word}
                      </Text>
                      <Badge size="sm" variant="outline">
                        {item.type}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {item.definition}
                    </Text>
                  </Paper>
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
