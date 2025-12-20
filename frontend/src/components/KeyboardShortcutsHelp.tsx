import { useEffect, useState } from 'react'
import { Modal, Text, Stack, Group, Kbd, Title } from '@mantine/core'
import { Command } from 'lucide-react'

export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault()
          setOpen(true)
        }
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const shortcuts = [
    { key: '⌘K or Ctrl+K', description: 'Open command palette' },
    { key: '/', description: 'Jump to search' },
    { key: 'n', description: 'Create new item' },
    { key: 'h', description: 'Go to home/dashboard' },
    { key: 'g', description: 'Open graph view' },
    { key: '⌘S or Ctrl+S', description: 'Save current item (in edit mode)' },
    { key: '⌘X or Ctrl+X', description: 'Export both formats (JSON + Markdown)' },
    { key: '⌘1-7', description: 'Navigate sections (Dashboard, Item, Search...)' },
    { key: '↑ / ↓', description: 'Navigate search results' },
    { key: 'Enter', description: 'Open selected search result' },
    { key: 'Esc', description: 'Go back / Close dialogs' },
    { key: '?', description: 'Show keyboard shortcuts' },
  ]

  return (
    <Modal opened={open} onClose={() => setOpen(false)} title={<Group><Command size={24} /><Title order={3}>Keyboard Shortcuts</Title></Group>} size="lg">
      <Stack gap="sm">
        {shortcuts.map((shortcut, index) => (
          <Group key={index} justify="space-between" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
            <Text>{shortcut.description}</Text>
            <Kbd>{shortcut.key}</Kbd>
          </Group>
        ))}
      </Stack>
      
      <Text size="sm" c="dimmed" ta="center" mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
        Press <Kbd>Esc</Kbd> or click outside to close
      </Text>
    </Modal>
  )
}
