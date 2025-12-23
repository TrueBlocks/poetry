import { useState } from "react";
import {
  Modal,
  Button,
  Text,
  Stack,
  Group,
  PasswordInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { SaveEnvVar } from "@wailsjs/go/main/App";
import { Check, Sparkles } from "lucide-react";

interface FirstRunModalProps {
  opened: boolean;
  onClose: () => void;
  mode?: "first-run" | "edit";
  initialKey?: string;
}

export function FirstRunModal({
  opened,
  onClose,
  mode = "first-run",
  initialKey = "",
}: FirstRunModalProps) {
  const [step, setStep] = useState<"ask" | "key">(
    mode === "edit" ? "key" : "ask",
  );
  const [apiKey, setApiKey] = useState(initialKey);
  const [loading, setLoading] = useState(false);

  const handleOptOut = async () => {
    setLoading(true);
    try {
      // Save empty key to indicate user has seen this but opted out
      await SaveEnvVar("OPENAI_API_KEY", "");
      notifications.show({
        title: "AI Features Disabled",
        message: "You can enable them later in Settings.",
        color: "blue",
      });
      onClose();
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to save preference.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      notifications.show({
        title: "Error",
        message: "Please enter an API Key.",
        color: "red",
      });
      return;
    }

    setLoading(true);
    try {
      await SaveEnvVar("OPENAI_API_KEY", apiKey.trim());
      notifications.show({
        title: "AI Configured",
        message: "Your OpenAI API Key has been saved.",
        color: "green",
        icon: <Check size={18} />,
      });
      onClose();
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to save API Key.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={mode === "edit" ? onClose : () => {}} // Allow closing in edit mode
      withCloseButton={mode === "edit"}
      centered
      size="md"
      title={
        <Group gap="xs">
          <Sparkles size={20} color="#228be6" />
          <Text fw={700}>
            {mode === "edit"
              ? "Edit Environment Variables"
              : "Welcome to Poetry"}
          </Text>
        </Group>
      }
    >
      {step === "ask" ? (
        <Stack>
          <Text>
            This application includes AI-powered features like Text-to-Speech
            and automated definitions.
          </Text>
          <Text fw={500}>Do you wish to enable these features?</Text>
          <Text size="sm" c="dimmed">
            You will need an OpenAI API Key. You can change this later in
            Settings.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleOptOut} loading={loading}>
              No, thanks
            </Button>
            <Button onClick={() => setStep("key")} loading={loading}>
              Yes, enable AI
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Text>Please enter your OpenAI API Key.</Text>
          <PasswordInput
            label="OpenAI API Key"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.currentTarget.value)}
            required
          />
          <Text size="xs" c="dimmed">
            The key will be stored locally in your app data folder.
          </Text>
          <Group justify="flex-end" mt="md">
            {mode === "first-run" && (
              <Button
                variant="subtle"
                onClick={() => setStep("ask")}
                disabled={loading}
              >
                Back
              </Button>
            )}
            <Button onClick={handleSaveKey} loading={loading}>
              {mode === "edit" ? "Save Changes" : "Save & Continue"}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
