import { Link } from "react-router-dom";
import {
  Anchor,
  ActionIcon,
  useMantineTheme,
  useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Network, Volume2, Copy } from "lucide-react";
import { SpeakWord } from "@wailsjs/go/main/App.js";
import { useItemImage, useCapabilities } from "@hooks/useItemData";
import { prepareTTSText } from "@utils/tts";
import { REFERENCE_COLOR_MAP } from "@utils/references";
import { database } from "@models";

interface ReferenceLinkProps {
  matchedItem: database.Item;
  displayWord: string;
  refType: string;
  stopAudio: () => void;
  currentAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
  parentItem?: database.Item;
}

export function ReferenceLink({
  matchedItem,
  displayWord,
  refType,
  stopAudio,
  currentAudioRef,
  parentItem,
}: ReferenceLinkProps) {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const imageUrl = useItemImage(matchedItem.itemId, matchedItem.type);
  const { data: capabilities } = useCapabilities();

  const isDark = colorScheme === "dark";
  const colorName = REFERENCE_COLOR_MAP[refType];
  const color = colorName
    ? theme.colors[colorName][isDark ? 3 : 6]
    : isDark
      ? "var(--mantine-color-text)"
      : "#000000";

  // Check if this is a Title with quoted text
  const hasQuotedText =
    matchedItem.type === "Title" &&
    matchedItem.definition &&
    /\[\s*\n/.test(matchedItem.definition);

  // Check if this link is part of a "Written by:" line in a Title item
  const isWrittenByLine =
    parentItem?.type === "Title" &&
    parentItem?.definition?.includes(
      `Written by: {writer: ${matchedItem.word}}`,
    );

  const handleTTSClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    stopAudio();

    const finalText = prepareTTSText(
      matchedItem.definition || "",
      matchedItem.word,
    );
    if (!finalText) {
      notifications.show({
        title: "No Quote Found",
        message: "Could not find quoted text",
        color: "orange",
      });
      return;
    }

    notifications.show({
      id: "tts-inline-loading",
      title: "Generating speech...",
      message: "Please wait",
      loading: true,
      autoClose: false,
    });

    try {
      const result = await SpeakWord(
        finalText,
        parentItem?.type || "",
        parentItem?.word || "",
        1,
      );

      if (result.error) {
        notifications.update({
          id: "tts-inline-loading",
          title: "TTS Error",
          message: result.error,
          color: "red",
          loading: false,
          autoClose: result.errorType === "missing_key" ? false : 5000,
          withCloseButton: true,
        });
        return;
      }

      if (result.cached) {
        notifications.update({
          id: "tts-inline-loading",
          title: "Using cached audio",
          message: "Playing from cache",
          color: "green",
          loading: false,
          autoClose: 1500,
        });
      } else {
        notifications.hide("tts-inline-loading");
      }

      const audioData = result.audioData;
      let uint8Array: Uint8Array;
      if (typeof audioData === "string") {
        const binaryString = atob(audioData);
        uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
      } else if (audioData instanceof Uint8Array) {
        uint8Array = audioData;
      } else if (Array.isArray(audioData)) {
        uint8Array = new Uint8Array(audioData);
      } else {
        throw new Error("Unexpected audio data format");
      }

      const audioBlob = new Blob([uint8Array as BlobPart], {
        type: "audio/mpeg",
      });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      currentAudioRef.current = audio;
      await audio.play();

      notifications.show({
        title: "Playing Quote",
        message: `"${matchedItem.word}"`,
        color: "green",
        autoClose: 3000,
      });
    } catch (err: unknown) {
      notifications.hide("tts-inline-loading");
      notifications.show({
        title: "Error",
        message:
          err instanceof Error ? err.message : "Failed to generate speech",
        color: "red",
      });
    }
  };

  const handleCopyClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const quoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/;
    const match = matchedItem.definition?.match(quoteRegex);
    if (match && match[1]) {
      const quotedText = match[1].replace(/[\\\/]$/gm, "").trim();
      await navigator.clipboard.writeText(quotedText);
      notifications.show({
        title: "Copied",
        message: "Quote copied to clipboard",
        color: "blue",
        autoClose: 2000,
      });
    }
  };

  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <Anchor
        component={Link}
        to={`/item/${matchedItem.itemId}?tab=detail`}
        onClick={(e: React.MouseEvent) => {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
          }
        }}
        style={{
          color,
          fontWeight: 600,
          textDecoration: "underline",
          fontVariant: "small-caps",
        }}
      >
        {displayWord}
      </Anchor>

      {imageUrl && !isWrittenByLine && (
        <Anchor
          component={Link}
          to={`/item/${matchedItem.itemId}?tab=detail`}
          style={{
            marginLeft: "6px",
            display: "inline-block",
            verticalAlign: "middle",
            lineHeight: 0,
          }}
        >
          <img
            src={imageUrl}
            alt={displayWord}
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid var(--mantine-color-default-border)",
            }}
          />
        </Anchor>
      )}

      <Anchor
        component={Link}
        to={`/item/${matchedItem.itemId}?tab=graph`}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
        }}
        style={{
          marginLeft: "6px",
          display: "inline-block",
          verticalAlign: "middle",
          opacity: 0.6,
        }}
        title="Show in graph"
      >
        <Network size={14} />
      </Anchor>

      {hasQuotedText && (
        <>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="green"
            style={{
              marginLeft: "6px",
              display: "inline-block",
              verticalAlign: "middle",
            }}
            title={
              capabilities?.hasTts
                ? "Read quoted text"
                : "Configure OpenAI API Key in Settings to enable TTS"
            }
            disabled={!capabilities?.hasTts}
            onClick={handleTTSClick}
          >
            <Volume2 size={14} />
          </ActionIcon>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="blue"
            style={{
              marginLeft: "6px",
              display: "inline-block",
              verticalAlign: "middle",
            }}
            title="Copy quoted text"
            onClick={handleCopyClick}
          >
            <Copy size={14} />
          </ActionIcon>
        </>
      )}
    </span>
  );
}
