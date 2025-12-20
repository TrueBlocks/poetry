import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Tabs } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Network } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import ItemDetail from './ItemDetail'
import Graph from './Graph'
import ItemEdit from './ItemEdit'
import { GetSettings, SaveTabSelection, GetItem, GetItemByWord, SaveLastWord } from '../../wailsjs/go/main/App.js'

export default function ItemPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNewItem = id === 'new'
  
  const { data: settings } = useQuery({
    queryKey: ['allSettings'],
    queryFn: GetSettings,
  })

  const { data: item, error } = useQuery({
    queryKey: ['item', id],
    queryFn: () => GetItem(Number(id)),
    enabled: !!id && !isNewItem,
  })

  useEffect(() => {
    if (error && id && !isNewItem) {
      GetItemByWord('poetry')
        .then(poetryItem => {
          if (poetryItem) {
            SaveLastWord(poetryItem.itemId).catch(console.error)
            navigate(`/item/${poetryItem.itemId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`, { replace: true })
            notifications.show({
              title: 'Item Not Found',
              message: 'Previous item no longer exists, showing: poetry',
              color: 'yellow',
            })
          }
        })
        .catch(console.error)
    }
  }, [error, id, isNewItem, navigate, searchParams])

  useEffect(() => {
    if (item?.itemId && id && !isNewItem) {
      SaveLastWord(Number(id)).catch(console.error)
    }
  }, [id, item?.itemId, isNewItem])

  const tabFromUrl = searchParams.get('tab')
  const editModeFromUrl = searchParams.get('edit') === 'true'
  const activeTab = tabFromUrl || settings?.tabSelections?.['itemView'] || 'detail'
  const [isEditMode, setIsEditMode] = useState(editModeFromUrl || isNewItem)

  // Update edit mode when URL changes
  useEffect(() => {
    setIsEditMode(editModeFromUrl || isNewItem)
  }, [editModeFromUrl, isNewItem])

  const handleTabChange = (value: string | null) => {
    if (value) {
      // Clear edit mode when switching tabs
      setSearchParams({ tab: value })
      setIsEditMode(false)
      SaveTabSelection('itemView', value).catch(console.error)
    }
  }

  const handleEnterEditMode = () => {
    setSearchParams({ tab: 'detail', edit: 'true' })
    setIsEditMode(true)
  }

  const handleExitEditMode = () => {
    setSearchParams({ tab: 'detail' })
    setIsEditMode(false)
  }

  return (
    <Tabs value={activeTab} onChange={handleTabChange}>
      <Tabs.List>
        <Tabs.Tab value="detail" leftSection={<BookOpen size={16} />}>
          Detail
        </Tabs.Tab>
        <Tabs.Tab value="graph" leftSection={<Network size={16} />}>
          Graph
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="detail" pt="md">
        {isEditMode ? (
          <ItemEdit onSave={handleExitEditMode} onCancel={handleExitEditMode} />
        ) : (
          <ItemDetail onEnterEditMode={handleEnterEditMode} />
        )}
      </Tabs.Panel>

      <Tabs.Panel value="graph" pt="md">
        <Graph selectedItemId={id ? Number(id) : undefined} />
      </Tabs.Panel>
    </Tabs>
  )
}
