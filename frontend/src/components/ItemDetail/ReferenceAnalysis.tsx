import { Alert, Title, Text, Group, Badge } from "@mantine/core";
import { AlertTriangle } from "lucide-react";

interface ReferenceAnalysisProps {
  dataQuality: {
    unlinkedRefs: string[];
    extraLinks: string[];
    hasIssues: boolean;
  } | null;
  creatingLinkFor: string | null;
  deletingLinkFor: string | null;
  onCreateLink: (ref: string) => void;
  onDeleteLink: (word: string) => void;
}

export function ReferenceAnalysis({
  dataQuality,
  creatingLinkFor,
  deletingLinkFor,
  onCreateLink,
  onDeleteLink,
}: ReferenceAnalysisProps) {
  if (!dataQuality || !dataQuality.hasIssues) {
    return null;
  }

  return (
    <Alert color="yellow" icon={<AlertTriangle size={20} />} mt="md">
      <Title order={3} size="md" mb="sm">
        Data Quality Issues
      </Title>
      {dataQuality.unlinkedRefs.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb="xs">
            References in definition not linked (click to create link):
          </Text>
          <Group gap="xs" mb="md">
            {dataQuality.unlinkedRefs.map((ref: string, idx: number) => {
              const isCreating = creatingLinkFor === ref;
              return (
                <Badge
                  key={idx}
                  color="red"
                  variant="light"
                  style={{ cursor: "pointer" }}
                  onClick={() => !isCreating && onCreateLink(ref)}
                >
                  {isCreating ? "Creating..." : ref}
                </Badge>
              );
            })}
          </Group>
        </div>
      )}
      {dataQuality.extraLinks.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb="xs">
            Linked items not in definition (click to remove link):
          </Text>
          <Group gap="xs">
            {dataQuality.extraLinks.map((word: string, idx: number) => {
              const isDeleting = deletingLinkFor === word;
              return (
                <Badge
                  key={idx}
                  color="orange"
                  variant="light"
                  style={{ cursor: "pointer" }}
                  onClick={() => !isDeleting && onDeleteLink(word)}
                >
                  {isDeleting ? "Deleting..." : word}
                </Badge>
              );
            })}
          </Group>
        </div>
      )}
    </Alert>
  );
}
