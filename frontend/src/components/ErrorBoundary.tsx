import { Component, ReactNode } from "react";
import { Container, Title, Text, Button, Paper, Stack } from "@mantine/core";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container size="sm" py="xl">
          <Paper p="xl" withBorder>
            <Stack gap="md" align="center">
              <AlertTriangle size={48} color="red" />
              <Title order={2}>
                {this.props.fallbackTitle || "Something went wrong"}
              </Title>
              <Text c="dimmed" ta="center">
                An unexpected error occurred. Try resetting the component or
                refreshing the page.
              </Text>
              {this.state.error && (
                <Paper p="md" bg="gray.1" style={{ width: "100%" }}>
                  <Text
                    size="sm"
                    ff="monospace"
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {this.state.error.toString()}
                  </Text>
                </Paper>
              )}
              <Button onClick={this.handleReset}>Reset Component</Button>
              <Button variant="subtle" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </Stack>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}
