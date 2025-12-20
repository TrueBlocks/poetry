import { Link, useNavigate } from 'react-router-dom'
import { Group, Title, Button, Badge, ActionIcon } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ArrowLeft, Edit, Trash2, Network, Sparkles, PilcrowIcon, Copy, Check, Volume2 } from 'lucide-react'
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime.js'
import { getItemColor } from '../../utils/colors'

interface ItemHeaderProps {
  item: any
  itemId: string
  links: any[] | null
  revealMarkdown: boolean
  onToggleRevealMarkdown: () => void
  onDelete: () => void
  onSpeakWord: () => void
  onSpeakQuote: () => void
  deleteLoading: boolean
}

export function ItemHeader({
  item,
  itemId,
  links,
  revealMarkdown,
  onToggleRevealMarkdown,
  onDelete,
  onSpeakWord,
  onSpeakQuote,
  deleteLoading
}: ItemHeaderProps) {
  const navigate = useNavigate()

  return (
    <>
      {/* Action Bar */}
      <div style={{
        borderBottom: '1px solid #e9ecef',
        padding: '1rem 2rem'
      }}>
        <Group justify="space-between">
          <Group gap="md">
            <Button
              variant="subtle"
              leftSection={<ArrowLeft size={18} />}
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
            <Button
              variant="subtle"
              leftSection={<Sparkles size={18} />}
              onClick={() => {
                let query = ''
                const type = item?.type || ''
                
                if (type === 'Title' || type === 'Writer') {
                  query = `"${item?.word || ''}"`
                } else {
                  query = item?.definition 
                    ? `${item.word} ${item.definition}`
                    : item?.word || ''
                }
                
                BrowserOpenURL(`https://www.google.com/search?q=${encodeURIComponent(query)}&ai=1`)
              }}
            >
              AI
            </Button>
            <Button
              variant={revealMarkdown ? 'filled' : 'subtle'}
              leftSection={<PilcrowIcon size={18} />}
              onClick={onToggleRevealMarkdown}
              title="Show/hide markdown formatting"
            >
              ¶
            </Button>
          </Group>
          <Group gap="sm">
            <Button
              component={Link}
              to={`/item/${itemId}/edit`}
              leftSection={<Edit size={16} />}
            >
              Edit
            </Button>
            <Button
              color="red"
              leftSection={<Trash2 size={16} />}
              onClick={onDelete}
              loading={deleteLoading}
              disabled={(links && links.filter((l: any) => l.destinationItemId === Number(itemId)).length > 0) || undefined}
              title={links && links.filter((l: any) => l.destinationItemId === Number(itemId)).length > 0 ? "Cannot delete: item has incoming connections" : "Delete this item"}
            >
              Delete
            </Button>
          </Group>
        </Group>
      </div>

      {/* Title Row */}
      <Group gap="sm" align="center">
        <Title order={1} size="3rem" mb="sm">{item.word}</Title>
        <ActionIcon
          size="lg"
          variant="subtle"
          color="gray"
          title="Copy to clipboard"
          onClick={() => {
            navigator.clipboard.writeText(item.word)
            notifications.show({
              title: 'Copied!',
              message: `"${item.word}" copied to clipboard`,
              color: 'green',
              icon: <Check size={16} />,
            })
          }}
        >
          <Copy size={20} />
        </ActionIcon>
        <ActionIcon
          size="lg"
          variant="subtle"
          color="gray"
          title="View in graph"
          component={Link}
          to={`/item/${itemId}?tab=graph`}
        >
          <Network size={20} />
        </ActionIcon>
      </Group>
      <Group gap="sm">
        <Badge 
          size="lg"
          style={{ backgroundColor: getItemColor(item.type), color: '#000' }}
        >
          {item.type}
        </Badge>
        {item.type === 'Reference' && (
          <ActionIcon
            size="lg"
            variant="light"
            color="blue"
            title="Pronounce word"
            onClick={onSpeakWord}
          >
            <Volume2 size={22} />
          </ActionIcon>
        )}
        {item.type === 'Title' && item.definition && /\[\s*\n/.test(item.definition) && (
          <ActionIcon
            size="lg"
            variant="light"
            color="green"
            title="Read quoted text"
            onClick={onSpeakQuote}
          >
            <Volume2 size={22} />
          </ActionIcon>
        )}
      </Group>
    </>
  )
}
