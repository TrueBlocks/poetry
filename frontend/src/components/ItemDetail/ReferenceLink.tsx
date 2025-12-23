import { Link } from "react-router-dom";
import {
  Anchor,
  ActionIcon,
  useMantineTheme,
  useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Network, Volume2, Copy } from "lucide-react";
import { SpeakWord } from "../../../wailsjs/go/main/App.js";
import { useItemImage, useEnvVars } from "../../hooks/useItemData";
import { prepareTTSText } from "../../utils/tts";
import { REFERENCE_COLOR_MAP } from "../../utils/references";

interface ReferenceLinkProps {
  matchedItem: any;
  displayWord: string;
  refType: string;
  stopAudio: () => void;
  currentAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
  parentItem?: any;
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
  const { data: envVars } = useEnvVars();

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

    const finalText = prepareTTSText(matchedItem.definition, matchedItem.word);
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
      const base64Audio = await SpeakWord(finalText);
      notifications.hide("tts-inline-loading");

      if (!base64Audio || base64Audio === "") {
        notifications.show({
          title: "No Audio Generated",
          message: "The TTS service returned no audio",
          color: "orange",
        });
        return;
      }

      const audioBlob = base64ToBlob(base64Audio, "audio/mpeg");
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
    } catch (err: any) {
      notifications.hide("tts-inline-loading");
      notifications.show({
        title: "Error",
        message: err.message || "Failed to generate speech",
        color: "red",
      });
    }
  };

  const handleCopyClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const quoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/;
    const match = matchedItem.definition.match(quoteRegex);
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
              envVars?.["OPENAI_API_KEY"]
                ? "Read quoted text"
                : "Configure OpenAI API Key in Settings to enable TTS"
            }
            disabled={!envVars?.["OPENAI_API_KEY"]}
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

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
