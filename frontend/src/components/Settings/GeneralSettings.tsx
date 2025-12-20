import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Title, Text, Paper, Table, Loader, Alert, Group, Badge, Button, TextInput, Stack } from '@mantine/core'
import { GetAllSettings, GetEnvVars, GetEnvLocation, SelectDataFolder, GetTTSCacheInfo, GetImageCacheInfo, GetDatabaseFileSize, GetItem } from '../../../wailsjs/go/main/App.js'
import { AlertCircle, FolderOpen, Search } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { useState, useRef, useEffect } from 'react'

export function GeneralSettings() {
  const queryClient = useQueryClient()
  const [changingFolder, setChangingFolder] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === '/' || e.key === '?')) {
        e.preventDefault()
        e.stopPropagation()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ['allSettings'],
    queryFn: GetAllSettings,
    refetchInterval: 500, // Refetch every 500ms to show window changes in real-time
  })

  const { data: envVars, isLoading: envLoading, error: envError } = useQuery({
    queryKey: ['envVars'],
    queryFn: GetEnvVars,
  })

  const { data: envLocation } = useQuery({
    queryKey: ['envLocation'],
    queryFn: GetEnvLocation,
  })

  const { data: cacheInfo, isLoading: cacheLoading } = useQuery({
    queryKey: ['ttsCacheInfo'],
    queryFn: GetTTSCacheInfo,
  })

  const { data: imageCacheInfo, isLoading: imageCacheLoading } = useQuery({
    queryKey: ['imageCacheInfo'],
    queryFn: GetImageCacheInfo,
  })

  const { data: dbFileSize, isLoading: dbSizeLoading } = useQuery({
    queryKey: ['databaseFileSize'],
    queryFn: GetDatabaseFileSize,
  })

  const { data: lastWordItem } = useQuery({
    queryKey: ['lastWordItem', settings?.lastWordId],
    queryFn: () => settings?.lastWordId ? GetItem(settings.lastWordId) : null,
    enabled: !!settings?.lastWordId,
  })

  const handleChangeDataFolder = async () => {
    setChangingFolder(true)
    try {
      const selectedFolder = await SelectDataFolder()
      if (selectedFolder) {
        queryClient.invalidateQueries()
        notifications.show({
          title: 'Data Folder Changed',
          message: `Database moved to: ${selectedFolder}`,
          color: 'green',
        })
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: `Failed to change data folder: ${(error as Error).message}`,
        color: 'red',
        autoClose: false,
      })
    } finally {
      setChangingFolder(false)
    }
  }

  if (settingsLoading || envLoading) {
    return (
      <Stack align="center" justify="center" style={{ height: '50vh' }}>
        <Loader size="xl" />
        <Text>Loading settings...</Text>
      </Stack>
    )
  }

  return (
    <>
      <TextInput
        ref={searchInputRef}
        placeholder="Search settings..."
        leftSection={<Search size={16} />}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.currentTarget.value)}
        mb="xs"
      />

      {/* Database Information Section */}
      <Paper shadow="sm" radius="md" withBorder p="sm" mb="xs">
        <Group justify="space-between" mb="xs" gap="xs">
          <Group>
            <Title order={3}>Database Information</Title>
            <Badge color="teal">Active Database</Badge>
          </Group>
          <Button
            leftSection={<FolderOpen size={16} />}
            onClick={handleChangeDataFolder}
            loading={changingFolder}
            variant="light"
          >
            Change Data Folder
          </Button>
        </Group>

        {settingsError ? (
          <Alert icon={<AlertCircle size={16} />} color="red" title="Error">
            Failed to load database settings
          </Alert>
        ) : settings ? (
          <>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={300}>Setting</Table.Th>
                  <Table.Th>Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[
                  { key: 'Database File', value: settings.database?.file || 'poetry.db' },
                  { key: 'Data Folder', value: settings.database?.folder || 'Not set (using current directory)' },
                  { 
                    key: 'Full Path', 
                    value: (settings.database?.folder 
                      ? `${settings.database.folder}/${settings.database.file || 'poetry.db'}`
                      : settings.database?.file || 'poetry.db') + 
                      (dbSizeLoading ? '' : dbFileSize ? ` (${(dbFileSize / 1024 / 1024).toFixed(2)} MB)` : '')
                  },
                  { 
                    key: 'TTS Cache', 
                    value: cacheLoading ? 'Loading...' : cacheInfo ? 
                      `${cacheInfo.fileCount} file${cacheInfo.fileCount !== 1 ? 's' : ''}, ${(cacheInfo.totalSize / 1024 / 1024).toFixed(2)} MB` : 
                      'No cache data'
                  },
                  { 
                    key: 'Image Cache', 
                    value: imageCacheLoading ? 'Loading...' : imageCacheInfo ? 
                      `${imageCacheInfo.fileCount} file${imageCacheInfo.fileCount !== 1 ? 's' : ''}, ${(imageCacheInfo.totalSize / 1024 / 1024).toFixed(2)} MB` : 
                      'No cache data'
                  },
                ]
                  .filter(row => 
                    !searchQuery || 
                    row.key.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    row.value.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(row => (
                    <Table.Tr key={row.key}>
                      <Table.Td>
                        <Text fw={500}>{row.key}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text>{row.value}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
              </Table.Tbody>
            </Table>
          </>
        ) : null}
      </Paper>

      {/* Settings.json Section */}
      <Paper shadow="sm" radius="md" withBorder p="sm" mb="xs">
        <Group mb="xs" gap="xs">
          <Title order={3}>Application Settings</Title>
          <Badge color="blue">settings.json</Badge>
        </Group>
        <Text size="sm" c="dimmed">
          Location: ~/.local/share/trueblocks/poetry/settings.json
        </Text>

        {settingsError ? (
          <Alert icon={<AlertCircle size={16} />} color="red" title="Error">
            Failed to load settings
          </Alert>
        ) : settings ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={300}>Setting</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Object.entries(settings)
                .filter(([key]) => key !== 'window' && key !== 'database')
                .map(([key, value]) => {
                  let displayValue = String(value)
                  
                  if (key === 'lastWordId' && lastWordItem) {
                    displayValue = `${value} (${lastWordItem.word})`
                  } else if (key === 'collapsed' && typeof value === 'object') {
                    const bools = Object.values(value as Record<string, boolean>).map(b => b.toString())
                    displayValue = `[ ${bools.join(' ')} ]`
                  }
                  
                  return { key, displayValue }
                })
                .filter(({ key, displayValue }) => 
                  !searchQuery || 
                  key.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  displayValue.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(({ key, displayValue }) => (
                  <Table.Tr key={key}>
                    <Table.Td>
                      <Text fw={500}>{key}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>{displayValue}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              {settings.window && (!searchQuery || 
                'window'.includes(searchQuery.toLowerCase()) || 
                `{x: ${settings.window.x}, y: ${settings.window.y}, w: ${settings.window.width}, h: ${settings.window.height}, lb: ${settings.window.leftbarWidth}}`.toLowerCase().includes(searchQuery.toLowerCase())
              ) && (
                <Table.Tr>
                  <Table.Td>
                    <Text fw={500}>window</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text>
                      {`{x: ${settings.window.x}, y: ${settings.window.y}, w: ${settings.window.width}, h: ${settings.window.height}, lb: ${settings.window.leftbarWidth}}`}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed">No settings found</Text>
        )}
      </Paper>

      {/* Environment Variables Section */}
      <Paper shadow="sm" radius="md" withBorder p="sm">
        <Group mb="xs" gap="xs">
          <Title order={3}>Environment Variables</Title>
          <Badge color="green">.env</Badge>
        </Group>
        <Text size="sm" c="dimmed">
          Location: {envLocation || 'Loading...'}
        </Text>

        {envError ? (
          <Alert icon={<AlertCircle size={16} />} color="red" title="Error">
            Failed to load environment variables
          </Alert>
        ) : envVars && Object.keys(envVars).length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={300}>Setting</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Object.entries(envVars)
                .filter(([key, value]) => 
                  !searchQuery || 
                  key.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  value.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(([key, value]) => (
                  <Table.Tr key={key}>
                    <Table.Td>
                      <Text fw={500}>{key}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>{value}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Alert icon={<AlertCircle size={16} />} color="blue" title="No .env file found">
            No .env file found in the current working directory. Create one to set environment variables.
          </Alert>
        )}
      </Paper>
    </>
  )
}
