import { Modal, Button, Text, Stack, Group, Code } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";

interface FirstRunModalProps {
  opened: boolean;
  onClose: () => void;
  mode?: "first-run" | "edit";
}

export function FirstRunModal({
  opened,
  onClose,
  mode = "first-run",
}: FirstRunModalProps) {
  const credsPath = "~/.config/trueblocks/credentials";

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton
      centered
      size="md"
      title={
        <Group gap="xs">
          <IconSparkles size={20} color="#228be6" />
          <Text fw={700}>
            {mode === "edit" ? "AI Credentials" : "Welcome to Poetry"}
          </Text>
        </Group>
      }
    >
      <Stack>
        <Text>
          This application includes AI-powered features like Text-to-Speech and
          automated definitions. They require an OpenAI API key.
        </Text>
        <Text size="sm">
          Keys are managed outside the app. To enable AI features, add a line
          like this to <Code>{credsPath}</Code> (file mode 600) and restart:
        </Text>
        <Code block>OPENAI_API_KEY=your-key-here</Code>
        <Text size="sm" c="dimmed">
          Verify with <Code>tb-creds list</Code>. The app never stores or
          displays key values.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button onClick={onClose}>Got it</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
