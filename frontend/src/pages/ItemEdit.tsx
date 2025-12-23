import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Container,
  Title,
  Button,
  TextInput,
  Select,
  Textarea,
  Group,
  Alert,
  Paper,
  Loader,
  Stack,
  Grid,
  Badge,
  Text,
  Box,
  useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  GetItem,
  CreateItem,
  UpdateItem,
  SaveItemImage,
  GetItemImage,
  DeleteItemImage,
} from "@wailsjs/go/main/App.js";
import {
  ArrowLeft,
  Save,
  AlertCircle,
  Check,
  X,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import { useReferenceValidation } from "@hooks/useReferenceValidation";
import { database } from "@models";
export default function ItemEdit({
  onSave,
  onCancel,
}: { onSave?: () => void; onCancel?: () => void } = {}) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === "new";
  const imageBoxRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    itemId: 0,
    word: "",
    type: "Reference",
    definition: "",
    derivation: "",
    appendicies: "",
    source: "",
    sourcePg: "",
    mark: "",
  });

  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [cachedImage, setCachedImage] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Reference validation for definition field
  const { getMissingReferences, getExistingReferences, isValidating } =
    useReferenceValidation(formData.definition);

  const handleCreateMissingItem = async (word: string) => {
    const newItemId = Date.now() + Math.floor(Math.random() * 1000);
    try {
      await CreateItem({
        itemId: newItemId,
        word: word,
        type: "Reference",
        definition: "",
        derivation: "",
        appendicies: "",
        source: "",
        sourcePg: "",
        mark: "",
      } as database.Item);
      queryClient.invalidateQueries({ queryKey: ["allItems"] });
      notifications.show({
        title: "Item Created",
        message: `Created "${word}" as a new reference`,
        color: "green",
        icon: <Check size={18} />,
      });
    } catch {
      notifications.show({
        title: "Error",
        message: `Failed to create "${word}"`,
        color: "red",
        icon: <X size={18} />,
      });
    }
  };

  const { data: item, isLoading: isLoadingItem } = useQuery({
    queryKey: ["item", id],
    queryFn: () => GetItem(Number(id)),
    enabled: !isNew,
  });

  useEffect(() => {
    if (item) {
      setFormData({
        itemId: item.itemId,
        word: item.word,
        type: item.type === "Other" ? "Reference" : item.type,
        definition: item.definition || "",
        derivation: item.derivation || "",
        appendicies: item.appendicies || "",
        source: item.source || "",
        sourcePg: item.sourcePg || "",
        mark: item.mark || "",
      });
      // Load cached image if it exists
      setIsImageLoading(true);
      GetItemImage(item.itemId)
        .then((imageData) => {
          if (imageData) {
            setCachedImage(imageData);
          } else {
            setCachedImage(null);
          }
        })
        .catch(console.error)
        .finally(() => setIsImageLoading(false));
    } else if (isNew) {
      // Reset form when creating new item
      setFormData({
        itemId: 0,
        word: "",
        type: "Reference",
        definition: "",
        derivation: "",
        appendicies: "",
        source: "",
        sourcePg: "",
        mark: "",
      });
      setCachedImage(null);
      setPastedImage(null);
    }
  }, [item, isNew]);

  // Handle paste event for image
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (document.activeElement !== imageBoxRef.current) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setPastedImage(dataUrl);
            setCachedImage(null); // Clear cached image when new image is pasted
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // Handle delete/backspace for image
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement !== imageBoxRef.current) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setPastedImage(null);
        setCachedImage(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      try {
        if (isNew || data.itemId === 0) {
          // Generate a new item ID using current timestamp + random component
          const newItemId = Date.now() + Math.floor(Math.random() * 1000);
          await CreateItem({ ...data, itemId: newItemId } as database.Item);
          return { newId: newItemId };
        } else {
          await UpdateItem(data as database.Item);
          return { itemId: Number(id) };
        }
      } catch (error) {
        console.error("Error in mutationFn:", error);
        throw error;
      }
    },
    onSuccess: async (data: { newId?: number; itemId?: number }) => {
      const savedItemId = data.newId || data.itemId || Number(id);

      // Save or delete image based on current state
      try {
        if (isImageLoading) {
          console.warn(
            "Image is still loading, skipping image update to prevent accidental deletion",
          );
        } else if (pastedImage) {
          // Save the new pasted image
          await SaveItemImage(savedItemId, pastedImage);
          setCachedImage(pastedImage);
          setPastedImage(null);
        } else if (!pastedImage && !cachedImage) {
          // Delete image if both are cleared
          await DeleteItemImage(savedItemId);
        }
      } catch (error) {
        console.error("Error saving image:", error);
      }

      notifications.show({
        title: isNew ? "Item Created" : "Item Saved",
        message: "Your changes have been saved successfully",
        color: "green",
        icon: <Check size={18} />,
      });
      queryClient.invalidateQueries({ queryKey: ["recentItems"] });
      if (isNew) {
        // Navigate to the newly created item
        navigate(`/item/${data.newId || data.itemId}?tab=detail`);
      } else {
        queryClient.invalidateQueries({ queryKey: ["item", id] });
        if (onSave) {
          onSave();
        } else {
          navigate(`/item/${id}?tab=detail`);
        }
      }
    },
    onError: (error: Error) => {
      console.error("Save failed:", error);
      console.error("Full error object:", error);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      notifications.show({
        title: "Error Saving Item",
        message: error?.message || String(error) || "Failed to save changes",
        color: "red",
        icon: <X size={18} />,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.word.trim()) {
      alert("Word field is required");
      return;
    }
    if (!formData.definition.trim() || formData.definition === "MISSING DATA") {
      alert('Definition field is required and cannot be "MISSING DATA"');
      return;
    }
    // Validate tags
    const tagRegex = /\{([^:]+):[^}]+\}/g;
    let match;
    while ((match = tagRegex.exec(formData.definition)) !== null) {
      const tagType = match[1];
      if (!["w", "p", "t", "word", "writer", "title"].includes(tagType)) {
        alert(
          `Invalid tag type found: "${tagType}". Allowed types are: w, p, t, word, writer, title.`,
        );
        return;
      }
    }
    saveMutation.mutate(formData);
  };

  // Keyboard shortcut for cmd+s to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (!formData.word.trim()) {
          notifications.show({
            title: "Validation Error",
            message: "Word field is required",
            color: "red",
          });
          return;
        }
        if (
          !formData.definition.trim() ||
          formData.definition === "MISSING DATA"
        ) {
          notifications.show({
            title: "Validation Error",
            message:
              'Definition field is required and cannot be "MISSING DATA"',
            color: "red",
          });
          return;
        }
        // Validate tags
        const tagRegex = /\{([^:]+):[^}]+\}/g;
        let match;
        while ((match = tagRegex.exec(formData.definition)) !== null) {
          const tagType = match[1];
          if (!["w", "p", "t", "word", "writer", "title"].includes(tagType)) {
            notifications.show({
              title: "Validation Error",
              message: `Invalid tag type found: "${tagType}". Allowed types are: w, p, t, word, writer, title.`,
              color: "red",
            });
            return;
          }
        }
        saveMutation.mutate(formData);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formData, saveMutation]);

  if (isLoadingItem) {
    return (
      <Container>
        <Group justify="center" p="xl">
          <Loader size="xl" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="xl">
        <Button
          component={Link}
          to={isNew ? "/" : `/item/${id}?tab=detail`}
          variant="subtle"
          leftSection={<ArrowLeft size={20} />}
        >
          Back
        </Button>
        <Title order={2}>
          {isNew ? "New Item" : `Edit: ${item?.word || ""}`}
        </Title>
        <div />
      </Group>

      {saveMutation.isError && (
        <Alert
          icon={<AlertCircle size={20} />}
          title="Failed to save item"
          color="red"
          mb="md"
        >
          {saveMutation.error?.message ||
            String(saveMutation.error) ||
            "An unknown error occurred"}
        </Alert>
      )}

      <Paper shadow="sm" p="md" radius="md" withBorder>
        <form onSubmit={handleSubmit}>
          <Stack>
            <Grid>
              <Grid.Col span={10}>
                <TextInput
                  label="Word"
                  required
                  value={formData.word}
                  onChange={(e) =>
                    setFormData({ ...formData, word: e.target.value })
                  }
                  autoFocus={isNew}
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <Select
                  label="Type"
                  value={formData.type}
                  onChange={(value) =>
                    setFormData({ ...formData, type: value || "Reference" })
                  }
                  data={[
                    "Reference",
                    "Definition",
                    "Term",
                    "Concept",
                    "Title",
                    "Writer",
                  ]}
                />
              </Grid.Col>
            </Grid>

            <Textarea
              label="Definition"
              rows={12}
              value={formData.definition}
              onChange={(e) =>
                setFormData({ ...formData, definition: e.target.value })
              }
              placeholder="Enter the definition..."
              description="Use {w: word}, {p: person}, or {t: title} to reference other items"
              autoFocus={!isNew}
            />

            {/* Reference Validation Indicators */}
            {formData.definition &&
              (getExistingReferences().length > 0 ||
                getMissingReferences().length > 0) && (
                <Alert
                  color={getMissingReferences().length > 0 ? "orange" : "green"}
                  mb="xs"
                  style={{
                    position: "relative",
                    zIndex: 10,
                    marginTop: "-60px",
                    marginBottom: "60px",
                    pointerEvents: "none",
                    marginLeft: "auto",
                    width: "fit-content",
                    maxWidth: "80%",
                  }}
                  styles={{
                    root: { pointerEvents: "auto" },
                  }}
                >
                  <Stack gap="xs">
                    {getMissingReferences().length > 0 ? (
                      <Group gap="xs">
                        <Text size="sm" fw={500}>
                          <AlertCircle
                            size={16}
                            style={{ verticalAlign: "middle", marginRight: 4 }}
                          />
                          Missing references:
                        </Text>
                        {getMissingReferences().map((ref) => (
                          <Badge
                            key={ref}
                            color="orange"
                            size="sm"
                            variant="light"
                            rightSection={
                              <Plus
                                size={12}
                                style={{ cursor: "pointer" }}
                                onClick={() => handleCreateMissingItem(ref)}
                              />
                            }
                          >
                            {ref}
                          </Badge>
                        ))}
                      </Group>
                    ) : (
                      getExistingReferences().length > 0 && (
                        <Group gap="xs">
                          <Text size="sm" fw={500}>
                            <Check
                              size={16}
                              style={{
                                verticalAlign: "middle",
                                marginRight: 4,
                              }}
                            />
                            Valid references:
                          </Text>
                          {getExistingReferences().map((result) => (
                            <Badge
                              key={result.reference}
                              color="green"
                              size="sm"
                              variant="light"
                            >
                              {result.reference}
                            </Badge>
                          ))}
                        </Group>
                      )
                    )}
                    {isValidating && (
                      <Text size="xs" c="dimmed">
                        Validating references...
                      </Text>
                    )}
                  </Stack>
                </Alert>
              )}

            <TextInput
              label="Etymology"
              value={formData.derivation}
              onChange={(e) =>
                setFormData({ ...formData, derivation: e.target.value })
              }
              placeholder="Word origin and derivation..."
            />

            <TextInput
              label="Notes / Appendices"
              value={formData.appendicies}
              onChange={(e) =>
                setFormData({ ...formData, appendicies: e.target.value })
              }
              placeholder="Additional notes, usage examples, etc..."
            />

            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Source"
                  value={formData.source}
                  onChange={(e) =>
                    setFormData({ ...formData, source: e.target.value })
                  }
                  placeholder="Reference source..."
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Page"
                  value={formData.sourcePg}
                  onChange={(e) =>
                    setFormData({ ...formData, sourcePg: e.target.value })
                  }
                  placeholder="Page number..."
                />
              </Grid.Col>
            </Grid>

            {/* Image Paste Area */}
            {formData.type === "Writer" && (
              <Box>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500}>
                    Image
                  </Text>
                  {isFocused && !pastedImage && !cachedImage && (
                    <Badge color="blue" variant="light" size="sm">
                      Paste image now (Cmd+V)
                    </Badge>
                  )}
                </Group>
                <Paper
                  ref={imageBoxRef}
                  tabIndex={0}
                  p="md"
                  withBorder
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  style={{
                    minHeight: "200px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    backgroundColor:
                      pastedImage || cachedImage
                        ? "transparent"
                        : isDark
                          ? "var(--mantine-color-dark-6)"
                          : "var(--mantine-color-gray-0)",
                    outline: "none",
                    borderColor: isFocused
                      ? "var(--mantine-color-blue-filled)"
                      : undefined,
                    boxShadow: isFocused
                      ? "0 0 0 2px var(--mantine-color-blue-light)"
                      : undefined,
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => imageBoxRef.current?.focus()}
                >
                  {isImageLoading ? (
                    <Loader size="sm" />
                  ) : pastedImage || cachedImage ? (
                    <Box
                      style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: "600px",
                      }}
                    >
                      <img
                        src={pastedImage || cachedImage || ""}
                        alt="Item image"
                        style={{
                          width: "100%",
                          height: "auto",
                          display: "block",
                        }}
                      />
                      {pastedImage && (
                        <Badge
                          color="yellow"
                          size="sm"
                          style={{ position: "absolute", top: 8, right: 8 }}
                        >
                          Unsaved
                        </Badge>
                      )}
                    </Box>
                  ) : (
                    <Stack align="center" gap="xs">
                      <ImageIcon
                        size={48}
                        style={{
                          opacity: isFocused ? 0.8 : 0.3,
                          color: isFocused
                            ? "var(--mantine-color-blue-filled)"
                            : undefined,
                        }}
                      />
                      <Text size="sm" c={isFocused ? "blue" : "dimmed"}>
                        {isFocused
                          ? "Paste image now (Cmd+V)"
                          : "Click here and press Cmd+V to paste an image"}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Press Delete or Backspace to remove
                      </Text>
                    </Stack>
                  )}
                </Paper>
              </Box>
            )}

            <TextInput
              label="Mark / Tag"
              value={formData.mark}
              onChange={(e) =>
                setFormData({ ...formData, mark: e.target.value })
              }
              placeholder="Optional mark or tag..."
            />

            <Group justify="flex-end" mt="md">
              {onCancel ? (
                <Button onClick={onCancel} variant="default">
                  Cancel
                </Button>
              ) : (
                <Button onClick={() => navigate(-1)} variant="default">
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                loading={saveMutation.isPending}
                leftSection={<Save size={20} />}
              >
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
