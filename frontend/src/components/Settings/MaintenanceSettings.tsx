import { Stack, Title, Text, Accordion } from '@mantine/core'
import { ItemManagerTool } from './ItemManagerTool'

export function MaintenanceSettings() {
  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        Maintenance tools for database integrity and bulk updates.
      </Text>

      <Accordion variant="separated" defaultValue="title-rename">
        <Accordion.Item value="title-rename">
          <Accordion.Control>
            <Title order={4}>Item Manager</Title>
          </Accordion.Control>
          <Accordion.Panel>
            <ItemManagerTool />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  )
}
