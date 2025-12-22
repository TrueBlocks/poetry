import { createTheme } from "@mantine/core";

export const theme = createTheme({
  components: {
    Paper: {
      defaultProps: {
        withBorder: true,
      },
      styles: {
        root: {
          // Match the footer border color as requested
          borderColor: "var(--mantine-color-gray-4)",
        },
      },
    },
    AppShell: {
      styles: {
        navbar: {
          borderColor: "var(--mantine-color-gray-4)",
        },
        header: {
          borderColor: "var(--mantine-color-gray-4)",
        },
      },
    },
    // Removed Table override to prevent "overpowering" grid lines
    // Tables will use the default subtle border
  },
});
