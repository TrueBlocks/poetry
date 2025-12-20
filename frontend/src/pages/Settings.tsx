import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Container, Title, Tabs, Loader, Center } from '@mantine/core'
import { Settings as SettingsIcon, Wrench } from 'lucide-react'
import { GeneralSettings } from '../components/Settings/GeneralSettings'
import { MaintenanceSettings } from '../components/Settings/MaintenanceSettings'
import { GetAllSettings, SaveTabSelection } from '../../wailsjs/go/main/App'

export default function Settings() {
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['allSettings'],
    queryFn: GetAllSettings,
  })

  useEffect(() => {
    if (settings?.tabSelections?.['settings']) {
      setActiveTab(settings.tabSelections['settings'])
    } else if (settings) {
      setActiveTab('general')
    }
  }, [settings])

  const handleTabChange = (value: string | null) => {
    if (value) {
      setActiveTab(value)
      SaveTabSelection('settings', value)
    }
  }

  if (isLoading && !activeTab) {
    return (
      <Container size="lg">
        <Title order={1} mb="md">Settings</Title>
        <Center h={200}>
          <Loader />
        </Center>
      </Container>
    )
  }

  return (
    <Container size="lg">
      <Title order={1} mb="md">Settings</Title>

      <Tabs value={activeTab || 'general'} onChange={handleTabChange}>
        <Tabs.List mb="md">
          <Tabs.Tab value="general" leftSection={<SettingsIcon size={16} />}>
            General
          </Tabs.Tab>
          <Tabs.Tab value="maintenance" leftSection={<Wrench size={16} />}>
            Maintenance
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general">
          <GeneralSettings />
        </Tabs.Panel>

        <Tabs.Panel value="maintenance">
          <MaintenanceSettings />
        </Tabs.Panel>
      </Tabs>
    </Container>
  )
}
