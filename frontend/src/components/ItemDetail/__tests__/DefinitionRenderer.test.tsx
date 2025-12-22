import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { DefinitionRenderer } from "../DefinitionRenderer";
import { BrowserRouter } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockItems = [
  {
    itemId: 1,
    word: "Shakespeare",
    type: "Writer",
    definition: "English playwright",
  },
  {
    itemId: 2,
    word: "Hamlet",
    type: "Title",
    definition: "A tragedy by Shakespeare",
  },
  {
    itemId: 3,
    word: "poetry",
    type: "Reference",
    definition: "Literary art form",
  },
];

const mockStopAudio = vi.fn();
const mockAudioRef = { current: null };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <BrowserRouter>{component}</BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
};

describe("DefinitionRenderer", () => {
  test("renders plain text without references", () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="This is plain text"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />,
    );
    expect(container.textContent).toContain("This is plain text");
  });

  test("renders word: reference - shows word in output", () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="A form of {word: poetry}"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />,
    );
    expect(container.textContent).toContain("poetry");
    expect(container.textContent).toContain("A form of");
  });

  test("renders writer: reference with possessive", () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="{writer: Shakespeare's} works"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />,
    );
    expect(container.textContent).toContain("Shakespeare");
    expect(container.textContent).toContain("works");
  });

  test("renders title: reference - shows title in output", () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="The play {title: Hamlet}"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />,
    );
    expect(container.textContent).toContain("Hamlet");
    expect(container.textContent).toContain("The play");
  });

  test("renders unmatched reference as plain text", () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="Reference to {word: NonExistent}"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />,
    );
    expect(container.textContent).toContain("NonExistent");
  });

  test("handles block quotes with square brackets", () => {
    const textWithQuote = "Some text [\nQuoted line\n] more text";
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text={textWithQuote}
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />,
    );
    expect(container.textContent).toContain("Quoted line");
  });

  test("renders multiple references in one text", () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="{writer: Shakespeare's} play {title: Hamlet} is {word: poetry}"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />,
    );
    expect(container.textContent).toContain("Shakespeare");
    expect(container.textContent).toContain("Hamlet");
    expect(container.textContent).toContain("poetry");
  });

  test("renders poem with line numbers for long poems", () => {
    const longPoemContent = Array(15).fill("Line of poem").join("\n");
    const text = `[\n${longPoemContent}\n]`;
    const item = { type: "Title", word: "My Poem" };

    const { container } = renderWithRouter(
      <DefinitionRenderer
        text={text}
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
        item={item}
      />,
    );

    // Check for content
    expect(container.textContent).toContain("Line of poem");

    // Check for line numbers (PoemRenderer adds them every 5th line)
    expect(container.textContent).toContain("5");
    expect(container.textContent).toContain("10");
  });
});
