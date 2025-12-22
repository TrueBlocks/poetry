import { Container, Title, Text, Stack, Paper, Table, Select, Pagination, Badge, Anchor, Loader, Group, TextInput, Alert, Checkbox, Modal, Button } from '@mantine/core'
import { useDebouncedValue, useDisclosure } from '@mantine/hooks'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'
import { SearchItems, GetAllLinks, GetAllCliches, GetAllNames, GetAllLiteraryTerms, MergeLiteraryTerm, DeleteLiteraryTerm, GetAllSources, GetSettings, GetItemImage, RunAdHocQuery, AddRecentSearch, ToggleItemMark } from '../../wailsjs/go/main/App.js'
import { LogInfo, LogError } from '../../wailsjs/runtime/runtime.js'
import { ArrowUp, ArrowDown, ChevronsUpDown, Search, AlertTriangle, Merge } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { useUIStore } from '../stores/useUIStore'
// import { getItemColor } from '../utils/colors'
// import { DefinitionRenderer } from '../components/ItemDetail/DefinitionRenderer'

const ITEMS_PER_PAGE = 15

type SortDirection = 'asc' | 'desc' | ''

interface SortState {
  field1: string
  dir1: SortDirection
  field2: string
  dir2: SortDirection
}

interface ColumnDef {
  field: string
  header: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  width?: string | number
  render?: (row: any, allData?: any) => React.ReactNode
}

interface SortableTableProps {
  tableName: string
  columns: ColumnDef[]
  data: any[]
  keyField: string
  sortState: SortState
  onSort: (field: string) => void
  getSortIcon: (field: string) => React.ReactNode
  getSortIndicator: (field: string) => string
  extraData?: any
  useIndexAsKey?: boolean
}

function SortableTable({ columns, data, keyField, onSort, getSortIcon, getSortIndicator, extraData, useIndexAsKey }: SortableTableProps) {
  const SortableHeader = ({ field, children, align, width }: { field: string; children: React.ReactNode; align?: 'left' | 'right' | 'center'; width?: string | number }) => {
    const style: React.CSSProperties = {
      cursor: 'pointer',
      userSelect: 'none',
      textAlign: align || 'left',
      width: width
    }
    
    return (
      <Table.Th style={style} onClick={() => onSort(field)}>
        <Group gap={4} wrap="nowrap" justify={align === 'right' ? 'flex-end' : 'flex-start'}>
          {children}
          {getSortIcon(field)}
          {getSortIndicator(field) && (
            <Text size="xs" c="dimmed" fw={700}>{getSortIndicator(field)}</Text>
          )}
        </Group>
      </Table.Th>
    )
  }

  return (
    <Table striped highlightOnHover style={{ tableLayout: 'fixed', width: '100%' }}>
      <Table.Thead>
        <Table.Tr>
          {columns.map((col) => (
            col.sortable !== false ? (
              <SortableHeader key={col.field} field={col.field} align={col.align} width={col.width}>
                {col.header}
              </SortableHeader>
            ) : (
              <Table.Th key={col.field} style={{ textAlign: col.align || 'left', width: col.width }}>
                {col.header}
              </Table.Th>
            )
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data.map((row: any, index: number) => (
          <Table.Tr key={useIndexAsKey ? `row-${index}` : row[keyField]}>
            {columns.map((col) => (
              <Table.Td key={col.field} style={{ 
                textAlign: col.align || 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {col.render ? col.render(row, extraData) : row[col.field]}
              </Table.Td>
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

export default function Tables() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const { lastTable, setLastTable, tableSorts, setTableSort, currentSearch, setCurrentSearch } = useUIStore()
  const [selectedTable, setSelectedTable] = useState<string>(lastTable || 'items')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState(currentSearch || '')
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 500)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchInitialized = useRef(false)
  
  const sortState = tableSorts[selectedTable] || {
    field1: '',
    dir1: '',
    field2: '',
    dir2: ''
  }

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

  // Handle URL parameters
  useEffect(() => {
    const tableParam = searchParams.get('table')
    const filterParam = searchParams.get('filter')
    const sqlParam = searchParams.get('sql')

    if (tableParam) {
      setSelectedTable(tableParam)
    }
    
    if (filterParam) {
      setFilterType(filterParam)
    } else {
      setFilterType(null)
    }

    if (sqlParam) {
      setSearchQuery(sqlParam)
      setSelectedTable('adhoc')
    }
  }, [searchParams])

  // Determine if current search is SQL
  const isSqlSearch = useMemo(() => {
    return debouncedSearchQuery.trim().toUpperCase().startsWith('SELECT')
  }, [debouncedSearchQuery])

  // Automatically switch to adhoc table if SQL is detected
  useEffect(() => {
    if (isSqlSearch && selectedTable !== 'adhoc') {
      setSelectedTable('adhoc')
    }
  }, [isSqlSearch, selectedTable])

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: GetSettings,
    refetchInterval: 500,
  })



  // Load search query from settings only once on mount/initial load
  useEffect(() => {
    if (settings?.currentSearch !== undefined && !searchInitialized.current) {
      setSearchQuery(settings.currentSearch)
      searchInitialized.current = true
    }
  }, [settings])

  // Fetch all items
  const { data: allItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['allItems'],
    queryFn: () => SearchItems(''),
    enabled: selectedTable === 'items',
  })

  // Fetch all links
  const { data: allLinks, isLoading: linksLoading } = useQuery({
    queryKey: ['allLinks'],
    queryFn: () => GetAllLinks(),
  })

  // Fetch all cliches
  const { data: allCliches, isLoading: clichesLoading } = useQuery({
    queryKey: ['allCliches'],
    queryFn: () => GetAllCliches(),
    enabled: selectedTable === 'cliches',
  })

  // Fetch all names
  const { data: allNames, isLoading: namesLoading } = useQuery({
    queryKey: ['allNames'],
    queryFn: () => GetAllNames(),
    enabled: selectedTable === 'names',
  })

  // Fetch all literary terms
  const { data: allLiteraryTerms, isLoading: literaryTermsLoading } = useQuery({
    queryKey: ['allLiteraryTerms'],
    queryFn: () => GetAllLiteraryTerms(),
    enabled: selectedTable === 'literaryTerms',
  })

  // Fetch all sources
  const { data: allSources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['allSources'],
    queryFn: () => GetAllSources(),
    enabled: selectedTable === 'sources',
  })

  // Fetch ad-hoc query results
  const { data: adHocResults, isLoading: adHocLoading, error: adHocError } = useQuery({
    queryKey: ['adHocQuery', debouncedSearchQuery],
    queryFn: () => isSqlSearch ? RunAdHocQuery(debouncedSearchQuery) : Promise.resolve([]),
    enabled: selectedTable === 'adhoc' && isSqlSearch,
  })

  const isLoading = itemsLoading || linksLoading || clichesLoading || namesLoading || literaryTermsLoading || sourcesLoading || adHocLoading

  // Calculate link counts for items
  const linkCounts = useMemo(() => {
    if (!allLinks || selectedTable !== 'items') return {}
    
    const counts: Record<number, { incoming: number; outgoing: number }> = {}
    allLinks.forEach((link: any) => {
      if (!counts[link.sourceItemId]) {
        counts[link.sourceItemId] = { incoming: 0, outgoing: 0 }
      }
      if (!counts[link.destinationItemId]) {
        counts[link.destinationItemId] = { incoming: 0, outgoing: 0 }
      }
      counts[link.sourceItemId].outgoing++
      counts[link.destinationItemId].incoming++
    })
    return counts
  }, [allLinks, selectedTable])

  const [itemImages, setItemImages] = useState<Record<number, string | null>>({})

  // Map Title items to their Writer items
  const titleToWriter = useMemo(() => {
    if (!allItems || !allLinks) return new Map<number, number>()
    
    const itemTypes = new Map<number, string>()
    allItems.forEach((i: any) => itemTypes.set(i.itemId, i.type))
    
    const map = new Map<number, number>()
    
    allLinks.forEach((l: any) => {
      const sType = itemTypes.get(l.sourceItemId)
      const dType = itemTypes.get(l.destinationItemId)
      
      if (sType === 'Title' && dType === 'Writer') {
        map.set(l.sourceItemId, l.destinationItemId)
      } else if (dType === 'Title' && sType === 'Writer') {
        map.set(l.destinationItemId, l.sourceItemId)
      }
    })
    
    return map
  }, [allItems, allLinks])

  // Handle column click for sorting
  const handleColumnClick = (field: string) => {
    let newState = { ...sortState }

    // If clicking the first sort field
    if (sortState.field1 === field) {
      // Cycle through: asc -> desc -> unsorted
      if (sortState.dir1 === 'asc') {
        newState.dir1 = 'desc'
      } else if (sortState.dir1 === 'desc') {
        // Remove this field, promote field2 to field1
        newState.field1 = sortState.field2
        newState.dir1 = sortState.dir2
        newState.field2 = ''
        newState.dir2 = ''
      }
    }
    // If clicking the second sort field
    else if (sortState.field2 === field) {
      // Cycle through: asc -> desc -> unsorted
      if (sortState.dir2 === 'asc') {
        newState.dir2 = 'desc'
      } else if (sortState.dir2 === 'desc') {
        newState.field2 = ''
        newState.dir2 = ''
      }
    }
    // Clicking a new field
    else {
      if (!sortState.field1) {
        // Set as primary sort
        newState.field1 = field
        newState.dir1 = 'asc'
      } else if (!sortState.field2) {
        // Set as secondary sort
        newState.field2 = field
        newState.dir2 = 'asc'
      } else {
        // Already have two sorts, replace the secondary
        newState.field2 = field
        newState.dir2 = 'asc'
      }
    }

    setTableSort(selectedTable, newState)
  }

  // Get sort icon for a column
  const getSortIcon = (field: string) => {
    if (sortState.field1 === field) {
      return sortState.dir1 === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
    }
    if (sortState.field2 === field) {
      return sortState.dir2 === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
    }
    return <ChevronsUpDown size={14} style={{ opacity: 0.3 }} />
  }

  // Get sort indicator (1 or 2)
  const getSortIndicator = (field: string) => {
    if (sortState.field1 === field) return '1'
    if (sortState.field2 === field) return '2'
    return ''
  }

  // Sort data
  const sortData = (data: any[]) => {
    if (!sortState.field1) return data

    return [...data].sort((a, b) => {
      // Primary sort
      let result = compareValues(a, b, sortState.field1, sortState.dir1)
      
      // Secondary sort if primary is equal
      if (result === 0 && sortState.field2) {
        result = compareValues(a, b, sortState.field2, sortState.dir2)
      }
      
      return result
    })
  }

  const compareValues = (a: any, b: any, field: string, dir: SortDirection) => {
    let aVal = a[field]
    let bVal = b[field]

    // Handle link counts for items table
    if (field === 'nIncoming') {
      aVal = linkCounts[a.itemId]?.incoming || 0
      bVal = linkCounts[b.itemId]?.incoming || 0
    } else if (field === 'nOutgoing') {
      aVal = linkCounts[a.itemId]?.outgoing || 0
      bVal = linkCounts[b.itemId]?.outgoing || 0
    }

    // Handle undefined/null
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return dir === 'asc' ? 1 : -1
    if (bVal == null) return dir === 'asc' ? -1 : 1

    // Compare based on type
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return dir === 'asc' ? aVal - bVal : bVal - aVal
    }

    // String comparison
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    const result = aStr.localeCompare(bStr)
    return dir === 'asc' ? result : -result
  }

  // Calculate pagination for current table
  const getCurrentData = () => {
    let sourceData: any[] = []
    
    if (selectedTable === 'items' && allItems) {
      sourceData = allItems
    } else if (selectedTable === 'links' && allLinks) {
      sourceData = allLinks
    } else if (selectedTable === 'cliches' && allCliches) {
      sourceData = allCliches
    } else if (selectedTable === 'names' && allNames) {
      sourceData = allNames
    } else if (selectedTable === 'literaryTerms' && allLiteraryTerms) {
      sourceData = allLiteraryTerms
    } else if (selectedTable === 'sources' && allSources) {
      sourceData = allSources
    } else if (selectedTable === 'adhoc' && adHocResults) {
      sourceData = adHocResults
    }

    // Apply URL filters
    if (filterType && selectedTable === 'items') {
      sourceData = sourceData.filter((row: any) => {
        switch (filterType) {
          case 'quotes':
            // Matches logic in pkg/parser/parser.go IsPoem()
            if (row.type !== 'Title' || !row.definition) return false
            const openBrackets = (row.definition.match(/\[/g) || []).length
            const closeBrackets = (row.definition.match(/\]/g) || []).length
            return openBrackets > 0 && openBrackets === closeBrackets
          case 'writer':
            return row.type === 'Writer'
          case 'reference':
            return row.type === 'Reference'
          case 'title':
            return row.type === 'Title'
          case 'cited':
            return row.source && row.source !== ''
          default:
            return true
        }
      })
    }

    // Apply search filter (skip for adhoc queries as the query IS the search)
    if (searchQuery && selectedTable !== 'adhoc') {
      const lowerQuery = searchQuery.toLowerCase()
      sourceData = sourceData.filter((row: any) => {
        return Object.values(row).some(value => 
          value != null && String(value).toLowerCase().includes(lowerQuery)
        )
      })
    }

    // Apply sorting
    const sortedData = sortData(sourceData)

    if (sortedData.length > 0) {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
      const endIndex = startIndex + ITEMS_PER_PAGE
      return {
        data: sortedData.slice(startIndex, endIndex),
        total: sortedData.length,
        totalPages: Math.ceil(sortedData.length / ITEMS_PER_PAGE),
      }
    }
    
    return { data: [], total: 0, totalPages: 0 }
  }

  const { data, total, totalPages } = getCurrentData()

  // Fetch images for visible items
  useEffect(() => {
    if (selectedTable !== 'items' || !data) return

    const fetchImages = async () => {
      const idsToFetch = new Set<number>()
      
      data.forEach((row: any) => {
        if (row.type === 'Writer') {
          idsToFetch.add(row.itemId)
        } else if (row.type === 'Title') {
          const writerId = titleToWriter.get(row.itemId)
          if (writerId) idsToFetch.add(writerId)
        }
      })

      // Filter out already fetched
      const missingIds = Array.from(idsToFetch).filter(id => itemImages[id] === undefined)
      
      if (missingIds.length === 0) return

      const newImages: Record<number, string | null> = {}
      
      await Promise.all(missingIds.map(async (id) => {
        try {
          const img = await GetItemImage(id)
          newImages[id] = img || null
        } catch (e) {
          newImages[id] = null
        }
      }))
      
      setItemImages(prev => ({ ...prev, ...newImages }))
    }

    fetchImages()
  }, [data, selectedTable, titleToWriter])

  // Reset to page 1 when changing tables or search
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchQuery])

  // Save search query to settings when it changes
  useEffect(() => {
    setCurrentSearch(debouncedSearchQuery)
  }, [debouncedSearchQuery])

  // Keyboard navigation for pagination
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const step = e.repeat ? 3 : 1
        setCurrentPage(prev => Math.max(1, prev - step))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        const step = e.repeat ? 3 : 1
        setCurrentPage(prev => Math.min(totalPages, prev + step))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setCurrentPage(1)
      } else if (e.key === 'End') {
        e.preventDefault()
        setCurrentPage(totalPages)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [totalPages])

  // Load last table from store if not in URL
  useEffect(() => {
    if (lastTable && !searchParams.get('table')) {
      setSelectedTable(lastTable)
    }
  }, [lastTable, searchParams])

  const handleTableChange = (value: string | null) => {
    if (value) {
      setSelectedTable(value)
      setCurrentPage(1)
      setLastTable(value)
    }
  }

  const handleMarkToggle = async (itemId: number, currentMark: string | null) => {
    const newMark = !currentMark
    try {
      // Clear table data immediately to prevent stale data display
      if (selectedTable === 'adhoc') {
        queryClient.setQueryData(['adHocQuery', debouncedSearchQuery], [])
      } else if (selectedTable === 'items') {
        // For items table, we can't easily clear just one item, but we can force a loading state
        // or just let the invalidation handle it. The user specifically mentioned "appending" which likely refers to adhoc results.
      }

      await ToggleItemMark(itemId, newMark)
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['allItems'] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      if (selectedTable === 'adhoc') {
        queryClient.invalidateQueries({ queryKey: ['adHocQuery'] })
      }
    } catch (error) {
      console.error('Failed to toggle mark:', error)
    }
  }

  // Column definitions for each table
  const itemsColumns: ColumnDef[] = [
    {
      field: 'mark',
      header: '',
      width: 40,
      sortable: false,
      align: 'center',
      render: (row) => (
        <Checkbox 
          checked={!!row.mark} 
          onChange={() => handleMarkToggle(row.itemId, row.mark)}
          size="xs"
        />
      )
    },
    {
      field: 'type',
      header: 'Type',
      width: '10%',
      render: (row) => <Badge size="sm">{row.type}</Badge>
    },
    {
      field: 'word',
      header: 'Word',
      width: '20%',
      render: (row, extraData) => {
        let imageSrc = null
        let linkedItemId: number | null = null

        if (row.type === 'Writer') {
          imageSrc = extraData?.itemImages?.[row.itemId]
          linkedItemId = row.itemId
        } else if (row.type === 'Title') {
          const writerId = extraData?.titleToWriter?.get(row.itemId)
          if (writerId) {
            imageSrc = extraData?.itemImages?.[writerId]
            linkedItemId = writerId
          }
        }

        return (
          <Group gap="xs" wrap="nowrap">
            <Anchor component={Link} to={`/item/${row.itemId}?tab=detail`} fw={600}>
              {row.word}
            </Anchor>
            {imageSrc && (
              linkedItemId ? (
                <Link to={`/item/${linkedItemId}?tab=detail`} style={{ display: 'block', lineHeight: 0 }}>
                  <img 
                    src={imageSrc} 
                    style={{ 
                      width: 20, 
                      height: 20, 
                      borderRadius: '50%', 
                      objectFit: 'cover', 
                      display: 'block' 
                    }} 
                  />
                </Link>
              ) : (
                <img 
                  src={imageSrc} 
                  style={{ 
                    width: 20, 
                    height: 20, 
                    borderRadius: '50%', 
                    objectFit: 'cover', 
                    display: 'block' 
                  }} 
                />
              )
            )}
          </Group>
        )
      }
    },
    {
      field: 'nIncoming',
      header: 'In',
      align: 'right',
      width: '8%',
      render: (row, extraData) => {
        const counts = extraData?.linkCounts?.[row.itemId] || { incoming: 0, outgoing: 0 }
        return <Text size="sm">{counts.incoming}</Text>
      }
    },
    {
      field: 'nOutgoing',
      header: 'Out',
      align: 'right',
      width: '8%',
      render: (row, extraData) => {
        const counts = extraData?.linkCounts?.[row.itemId] || { incoming: 0, outgoing: 0 }
        return <Text size="sm">{counts.outgoing}</Text>
      }
    },
    {
      field: 'definition',
      header: 'Definition (Preview)',
      width: '54%',
      render: (row) => (
        <div>
          {row.definition ? (
            <Text size="sm" lineClamp={2}>{row.definition}</Text>
            // <DefinitionRenderer 
            //   definition={row.definition} 
            //   compact={true}
            //   lineClamp={2}
            // />
          ) : (
            <Text size="sm"><em style={{ color: '#999' }}>No definition</em></Text>
          )}
        </div>
      )
    }
  ]

  const linksColumns: ColumnDef[] = [
    {
      field: 'sourceItemId',
      header: 'Source Item',
      width: '30%',
      render: (row) => (
        <Anchor component={Link} to={`/item/${row.sourceItemId}?tab=detail`} size="sm">
          Item #{row.sourceItemId}
        </Anchor>
      )
    },
    {
      field: 'destinationItemId',
      header: 'Destination Item',
      width: '30%',
      render: (row) => (
        <Anchor component={Link} to={`/item/${row.destinationItemId}?tab=detail`} size="sm">
          Item #{row.destinationItemId}
        </Anchor>
      )
    },
    {
      field: 'linkType',
      header: 'Link Type',
      width: '20%',
      render: (row) => <Badge size="sm" variant="light">{row.linkType}</Badge>
    },
    {
      field: 'createdAt',
      header: 'Created',
      width: '20%',
      render: (row) => (
        <Text size="sm" c="dimmed">
          {new Date(row.createdAt).toLocaleDateString()}
        </Text>
      )
    }
  ]

  const clichesColumns: ColumnDef[] = [
    {
      field: 'phrase',
      header: 'Phrase',
      width: '70%',
      render: (row) => <Text fw={600}>{row.phrase}</Text>
    },
    {
      field: 'createdAt',
      header: 'Created',
      width: '30%',
      render: (row) => (
        <Text size="sm" c="dimmed">
          {new Date(row.createdAt).toLocaleDateString()}
        </Text>
      )
    }
  ]

  const namesColumns: ColumnDef[] = [
    {
      field: 'name',
      header: 'Name',
      width: '20%',
      render: (row) => <Text fw={600}>{row.name}</Text>
    },
    {
      field: 'type',
      header: 'Type',
      width: '10%',
      render: (row) => row.type ? <Badge size="sm">{row.type}</Badge> : <em style={{ color: '#999' }}>—</em>
    },
    {
      field: 'gender',
      header: 'Gender',
      width: '10%',
      render: (row) => row.gender ? <Badge size="sm" color={row.gender === 'male' ? 'blue' : row.gender === 'female' ? 'pink' : 'gray'}>{row.gender}</Badge> : <em style={{ color: '#999' }}>—</em>
    },
    {
      field: 'description',
      header: 'Description (Preview)',
      width: '65%',
      render: (row) => (
        <Text size="sm" lineClamp={2}>
          {row.description || <em style={{ color: '#999' }}>No description</em>}
        </Text>
      )
    }
  ]

  const handleMergeTerm = async (termId: number, termName: string) => {
    try {
      LogInfo(`Merging term: ${termName} (${termId})`)
      await MergeLiteraryTerm(termId)
      queryClient.invalidateQueries({ queryKey: ['allLiteraryTerms'] })
      notifications.show({
        title: 'Merged',
        message: `Merged ${termName} into items table`,
        color: 'green',
      })
    } catch (error) {
      LogError(`Failed to merge term: ${error}`)
      notifications.show({
        title: 'Error',
        message: 'Failed to merge term',
        color: 'red',
      })
    }
  }

  const handleDeleteTerm = async (termId: number, termName: string) => {
    LogInfo(`Requesting delete for term: ${termName} (${termId})`)
    try {
      await DeleteLiteraryTerm(termId)
      LogInfo(`Successfully deleted term: ${termName}`)
      queryClient.invalidateQueries({ queryKey: ['allLiteraryTerms'] })
      notifications.show({
        title: 'Deleted',
        message: `Deleted ${termName}`,
        color: 'blue',
      })
    } catch (error) {
      LogError(`Failed to delete term: ${error}`)
      notifications.show({
        title: 'Error',
        message: 'Failed to delete term',
        color: 'red',
      })
    }
  }

  const literaryTermsColumns: ColumnDef[] = [
    {
      field: 'term',
      header: 'Term',
      width: '20%',
      render: (row) => (
        <Group gap="xs">
          <Text fw={600}>{row.term}</Text>
          {row.existsInItems && (
            <Text size="xs" c="dimmed">(present)</Text>
          )}
        </Group>
      )
    },
    {
      field: 'type',
      header: 'Type',
      width: '10%',
      render: (row) => row.type ? (
        <Badge 
          size="sm" 
          style={row.type === 'Removed' ? { cursor: 'pointer' } : {}}
          color={row.type === 'Removed' ? 'red' : 'blue'}
          onClick={(e) => {
            e.stopPropagation()
            if (row.type === 'Removed') {
              handleDeleteTerm(row.termId, row.term)
            }
          }}
        >
          {row.type}
        </Badge>
      ) : <em style={{ color: '#999' }}>—</em>
    },
    {
      field: 'definition',
      header: 'Definition (Preview)',
      width: '55%',
      render: (row) => (
        <Text size="sm" lineClamp={2}>
          {row.definition || <em style={{ color: '#999' }}>No definition</em>}
        </Text>
      )
    },
    {
      field: 'actions',
      header: 'Actions',
      width: '15%',
      align: 'center',
      sortable: false,
      render: (row) => (
        row.existsInItems && row.type !== 'Removed' ? (
          <Badge 
            color="orange" 
            style={{ cursor: 'pointer' }}
            leftSection={<Merge size={12} />}
            onClick={(e) => {
              e.stopPropagation()
              handleMergeTerm(row.termId, row.term)
            }}
          >
            Merge
          </Badge>
        ) : null
      )
    }
  ]

  const sourcesColumns: ColumnDef[] = [
    {
      field: 'title',
      header: 'Title',
      width: '30%',
      render: (row) => <Text fw={600}>{row.title}</Text>
    },
    {
      field: 'author',
      header: 'Author',
      width: '20%',
      render: (row) => <Text size="sm">{row.author || <em style={{ color: '#999' }}>—</em>}</Text>
    },
    {
      field: 'notes',
      header: 'Notes',
      width: '50%',
      render: (row) => (
        <Text size="sm" lineClamp={2}>
          {row.notes || <em style={{ color: '#999' }}>—</em>}
        </Text>
      )
    }
  ]

  // Dynamic columns for ad-hoc query
  const adHocColumns: ColumnDef[] = useMemo(() => {
    if (!adHocResults || adHocResults.length === 0) return []
    
    // If the result looks like an item (has itemId, word, type), use items columns
    const firstRow = adHocResults[0]
    if ('itemId' in firstRow || 'item_id' in firstRow) {
      // Map snake_case to camelCase if needed for the itemsColumns renderer
      if ('item_id' in firstRow && !('itemId' in firstRow)) {
        adHocResults.forEach((row: any) => {
          row.itemId = row.item_id
          row.word = row.word
          row.type = row.type
          row.definition = row.definition
          // Add other fields as needed
        })
      }
      
      // Return items columns but remove nIncoming/nOutgoing and expand definition
      return itemsColumns
        .filter(col => col.field !== 'nIncoming' && col.field !== 'nOutgoing')
        .map(col => {
          if (col.field === 'definition') {
            return { ...col, width: 'auto' }
          }
          return col
        })
    }

    return Object.keys(adHocResults[0]).map(key => ({
      field: key,
      header: key,
      width: 'auto',
      render: (row: any) => {
        const val = row[key]
        if (val === null) return <em style={{ color: '#999' }}>NULL</em>
        return String(val)
      }
    }))
  }, [adHocResults, itemsColumns])

  const getColumnsForTable = () => {
    switch (selectedTable) {
      case 'items': return itemsColumns
      case 'links': return linksColumns
      case 'cliches': return clichesColumns
      case 'names': return namesColumns
      case 'literaryTerms': return literaryTermsColumns
      case 'sources': return sourcesColumns
      case 'adhoc': return adHocColumns
      default: return []
    }
  }

  const getKeyField = () => {
    switch (selectedTable) {
      case 'items': return 'itemId'
      case 'links': return 'linkId'
      case 'cliches': return 'clicheId'
      case 'names': return 'nameId'
      case 'literaryTerms': return 'termId'
      case 'sources': return 'sourceId'
      case 'adhoc': return adHocColumns.length > 0 ? adHocColumns[0].field : 'id'
      default: return 'itemId'
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim().length > 0) {
      AddRecentSearch(searchQuery.trim())
    }
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} mb="xs">Data Tables</Title>
          <Text c="dimmed">Browse and manage database tables</Text>
        </div>

        <Paper p="lg" withBorder>
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <Group align="flex-end">
                <TextInput
                  ref={searchInputRef}
                  placeholder="Search table..."
                  leftSection={<Search size={16} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  onKeyDown={handleSearchKeyDown}
                  style={{ width: 300 }}
                />
                <Select
                  label="Select Table"
                  value={selectedTable}
                  onChange={handleTableChange}
                  data={[
                    { value: 'items', label: 'Items' },
                    { value: 'links', label: 'Links' },
                    { value: 'cliches', label: 'Clichés' },
                    { value: 'names', label: 'Names' },
                    { value: 'literaryTerms', label: 'Literary Terms' },
                    { value: 'sources', label: 'Sources' },
                    { value: 'adhoc', label: 'Ad Hoc Query' }
                  ]}
                  style={{ width: 200 }}
                />
              </Group>

              {selectedTable === 'adhoc' && adHocError && (
                <Alert icon={<AlertTriangle size={16} />} title="Query Error" color="red" variant="light" mb="md" style={{ width: '100%' }}>
                  <Text size="sm">{String(adHocError)}</Text>
                </Alert>
              )}

              <Group align="center">
                {!isLoading && totalPages > 1 && (
                  <Pagination
                    total={totalPages}
                    value={currentPage}
                    onChange={setCurrentPage}
                    size="sm"
                  />
                )}
                {!isLoading && (
                  <Text size="sm" c="dimmed">
                    Showing {data.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}-
                    {Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total} records
                  </Text>
                )}
              </Group>
            </Group>

            {isLoading && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Loader />
              </div>
            )}

            {!isLoading && data.length > 0 && (
              <SortableTable
                tableName={selectedTable}
                columns={getColumnsForTable()}
                data={data}
                keyField={getKeyField()}
                sortState={sortState}
                onSort={handleColumnClick}
                getSortIcon={getSortIcon}
                getSortIndicator={getSortIndicator}
                extraData={{ linkCounts, itemImages, titleToWriter }}
                useIndexAsKey={selectedTable === 'adhoc'}
              />
            )}

            {!isLoading && data.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                No records found
              </Text>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  )
}
