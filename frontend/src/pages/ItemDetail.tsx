import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Container, Title, Text, Button, Group, Stack, Paper, Loader, Badge, ActionIcon, Divider, Alert, useMantineColorScheme, Modal, Grid, Box } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { GetItem, GetItemLinks, DeleteItem, SearchItems, GetSettings, SaveRevealMarkdown, UpdateItem, SpeakWord, GetItemByWord, SaveOutgoingCollapsed, SaveIncomingCollapsed, DeleteLinkByItems, CreateLinkOrRemoveTags, GetItemImage } from '../../wailsjs/go/main/App.js'
import { LogInfo, LogError, BrowserOpenURL } from '../../wailsjs/runtime/runtime.js'
import { ArrowLeft, Edit, Trash2, Network, Sparkles, AlertTriangle, PilcrowIcon, Check, Volume2, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { useState, useEffect, useMemo, useRef } from 'react'
import { getItemColor } from '../utils/colors'
import { parseReferences } from '../utils/references'
import { DefinitionRenderer } from '../components/ItemDetail/DefinitionRenderer'

// Alias for backward compatibility
const parseDefinitionReferences = parseReferences

export default function ItemDetail({ onEnterEditMode }: { onEnterEditMode?: () => void }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { colorScheme } = useMantineColorScheme()
  const [revealMarkdown, setRevealMarkdown] = useState(false)
  const [creatingLinkFor, setCreatingLinkFor] = useState<string | null>(null)
  const [deletingLinkFor, setDeletingLinkFor] = useState<string | null>(null)
  const [outgoingCollapsed, setOutgoingCollapsed] = useState(true) // default collapsed
  const [incomingCollapsed, setIncomingCollapsed] = useState(false) // default expanded
  const [missingDefinitionModalOpen, setMissingDefinitionModalOpen] = useState(false)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [itemImage, setItemImage] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // Helper function to stop any currently playing audio
  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }
  }

  // Stop audio when component unmounts or id changes
  useEffect(() => {
    return () => stopAudio()
  }, [id])

  // Stop audio on any click anywhere in the document
  useEffect(() => {
    const handleClick = () => stopAudio()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Load settings from backend
  useEffect(() => {
    GetSettings().then((settings) => {
      setRevealMarkdown(settings.revealMarkdown || false)
      setOutgoingCollapsed(settings.collapsed?.outgoing !== undefined ? settings.collapsed.outgoing : true)
      setIncomingCollapsed(settings.collapsed?.incoming !== undefined ? settings.collapsed.incoming : false)
    })
  }, [])

  // Toggle reveal markdown and save to settings
  const toggleRevealMarkdown = async () => {
    const newValue = !revealMarkdown
    setRevealMarkdown(newValue)
    await SaveRevealMarkdown(newValue)
  }

  // Toggle outgoing collapsed and save to settings
  const toggleOutgoingCollapsed = async () => {
    const newValue = !outgoingCollapsed
    setOutgoingCollapsed(newValue)
    await SaveOutgoingCollapsed(newValue)
  }

  // Toggle incoming collapsed and save to settings
  const toggleIncomingCollapsed = async () => {
    const newValue = !incomingCollapsed
    setIncomingCollapsed(newValue)
    await SaveIncomingCollapsed(newValue)
  }

  // Note: SaveLastWord is now handled by ItemPage parent component

  const { data: item, isLoading } = useQuery({
    queryKey: ['item', id],
    queryFn: () => GetItem(Number(id)),
  })


  // Auto-save items modified before this hardcoded date (December 13, 2025, 2:15 PM EST)
  useEffect(() => {
    if (!item) return
    
    const cutoffDate = new Date('2025-12-13T14:15:00-05:00')
    const itemModified = new Date(item.modifiedAt)
    
    if (itemModified < cutoffDate) {
      LogInfo(`[ItemDetail] Auto-saving item ${item.word} - last modified: ${itemModified.toISOString()}`)
      
      // Perform auto-save
      UpdateItem({
        itemId: item.itemId,
        word: item.word,
        type: item.type,
        definition: item.definition || '',
        derivation: item.derivation || '',
        appendicies: item.appendicies || '',
        source: item.source || '',
        sourcePg: item.sourcePg || '',
        mark: item.mark || '',
        createdAt: undefined,
        modifiedAt: undefined,
        convertValues: function (_a: any, _classs: any, _asMap?: boolean) {
          throw new Error('Function not implemented.')
        }
      })
        .then(() => {
          // Invalidate and refetch to show updated timestamp
          queryClient.invalidateQueries({ queryKey: ['item', id] })
          notifications.show({
            title: 'Auto-saved',
            message: 'Item updated automatically',
            color: 'blue',
            icon: <Check size={18} />,
          })
        })
        .catch((error) => {
          LogError(`[ItemDetail] Auto-save failed: ${error}`)
        })
    }
  }, [item, id, queryClient])
  // Keyboard shortcuts: cmd+s to save/normalize, cmd+e to edit, cmd+r to reload
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Stop audio on any keyboard action
      stopAudio()
      
      // cmd+r or ctrl+r to reload
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault()
        queryClient.invalidateQueries({ queryKey: ['item', id] })
        queryClient.invalidateQueries({ queryKey: ['links', id] })
        notifications.show({
          title: 'Reloaded',
          message: 'Item data refreshed',
          color: 'blue',
        })
      }
      
      // cmd+e or ctrl+e to open editor
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        if (onEnterEditMode) {
          onEnterEditMode()
        }
      }
      
      // cmd+s or ctrl+s to save/normalize item
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (item) {
          try {
            await UpdateItem({
              itemId: item.itemId,
              word: item.word,
              type: item.type,
              definition: item.definition || '',
              derivation: item.derivation || '',
              appendicies: item.appendicies || '',
              source: item.source || '',
              sourcePg: item.sourcePg || '',
              mark: item.mark || '',
              createdAt: undefined,
              modifiedAt: undefined,
              convertValues: function (_a: any, _classs: any, _asMap?: boolean) {
                throw new Error('Function not implemented.')
              }
            })
            // Invalidate and refetch to show normalized definition
            queryClient.invalidateQueries({ queryKey: ['item', id] })
            notifications.show({
              title: 'Item Normalized',
              message: 'References have been normalized',
              color: 'green',
              icon: <Check size={18} />,
            })
          } catch (error) {
            notifications.show({
              title: 'Error',
              message: 'Failed to save item',
              color: 'red',
            })
            LogError(`Failed to save item: ${error}`)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [item, id, queryClient, navigate])

  const { data: links } = useQuery({
    queryKey: ['links', id],
    queryFn: () => GetItemLinks(Number(id)),
    enabled: !!id,
  })

  // Log delete button state for debugging
  useEffect(() => {
    if (links && item) {
      const incomingLinks = links.filter((l: any) => l.destinationItemId === Number(id))
      LogInfo(`[ItemDetail] Delete button state - Item: ${item.word}, Incoming links: ${incomingLinks.length}, Disabled: ${incomingLinks.length > 0}`)
    }
  }, [links, item, id])

  const deleteMutation = useMutation({
    mutationFn: () => DeleteItem(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentItems'] })
      notifications.show({
        title: 'Item deleted',
        message: 'The item has been deleted successfully',
        color: 'green',
      })
      navigate('/reports')
    },
    onError: (error) => {
      LogError(`Failed to delete item: ${error}`)
      notifications.show({
        title: 'Error',
        message: `Failed to delete item: ${error}`,
        color: 'red',
      })
    },
  })

  // Fetch all items for reference matching
  const { data: allItems } = useQuery({
    queryKey: ['allItemsForRefs'],
    queryFn: async () => {
      // Search with empty string to get all items (backend will handle this)
      return await SearchItems('')
    },
  })

  // Fetch details for linked items
  const linkedItemIds = links
    ?.map((link: any) =>
      link.sourceItemId === Number(id) ? link.destinationItemId : link.sourceItemId
    )
    .filter((itemId: number) => itemId !== Number(id)) || []

  const linkedItemsQueries = useQuery({
    queryKey: ['linkedItems', linkedItemIds],
    queryFn: async () => {
      const items = await Promise.all(
        linkedItemIds.map((itemId: number) => GetItem(itemId))
      )
      return items.reduce((acc: any, item: any) => {
        if (item) acc[item.itemId] = item
        return acc
      }, {})
    },
    enabled: linkedItemIds.length > 0,
  })

  // Load item image when item changes (with fallback to Writer image for Titles)
  useEffect(() => {
    if (!item?.itemId) {
      setItemImage(null)
      return
    }

    let isMounted = true

    const fetchImage = async () => {
      try {
        // 1. Try to get the item's own image
        const ownImage = await GetItemImage(item.itemId)
        if (ownImage) {
          if (isMounted) setItemImage(ownImage)
          return
        }

        // 2. If no own image, and it's a Title, try to get Writer's image
        if (item.type === 'Title' && linkedItemsQueries.data) {
           const linkedItems = Object.values(linkedItemsQueries.data as any)
           const writer: any = linkedItems.find((i: any) => i.type === 'Writer')
           if (writer) {
              const writerImage = await GetItemImage(writer.itemId)
              if (isMounted && writerImage) {
                 setItemImage(writerImage)
                 return
              }
           }
        }
        
        if (isMounted) setItemImage(null)

      } catch (error) {
        console.error('Failed to load item image:', error)
        if (isMounted) setItemImage(null)
      }
    }

    fetchImage()

    return () => {
      isMounted = false
    }
  }, [item?.itemId, item?.type, linkedItemsQueries.data])

  // Data quality checks
  const dataQuality = useMemo(() => {
    if (!item || !links || !allItems) return null

    // Parse references from all text fields (definition, derivation, notes)
    const defRefs = parseDefinitionReferences(item.definition)
    const derivRefs = parseDefinitionReferences(item.derivation)
    const notesRefs = parseDefinitionReferences(item.appendicies)
    
    // Combine all references and remove duplicates
    const allRefs = [...new Set([...defRefs, ...derivRefs, ...notesRefs])]
    
    // Get outgoing "to" links (where this item is the source)
    const outgoingLinks = links.filter((link: any) => link.sourceItemId === Number(id))
    const linkedWords = outgoingLinks
      .map((link: any) => {
        const linkedId = link.destinationItemId
        const linkedItem = linkedItemsQueries.data?.[linkedId]
        return linkedItem?.word
      })
      .filter(Boolean)

    // Find references in all fields that are NOT linked
    const unlinkedRefs = allRefs.filter(
      (ref) => !linkedWords.some((w: string) => w.toLowerCase() === ref.toLowerCase())
    )

    // Find linked items that are NOT in any text field
    const extraLinks = linkedWords.filter(
      (word: string) => !allRefs.some((ref) => ref.toLowerCase() === word.toLowerCase())
    )

    // Check for missing definition with single incoming link
    const incomingLinks = links.filter((link: any) => link.destinationItemId === Number(id))
    const hasMissingDefinition = (
      (!item.definition || item.definition.trim() === '' || item.definition.trim().toUpperCase() === 'MISSING DATA') &&
      incomingLinks.length === 1
    )

    return {
      unlinkedRefs,
      extraLinks,
      hasMissingDefinition,
      hasIssues: unlinkedRefs.length > 0 || extraLinks.length > 0 || hasMissingDefinition,
    }
  }, [item, links, allItems, linkedItemsQueries.data, id])

  const handleDelete = () => {
    LogInfo(`[ItemDetail] handleDelete called for item ID: ${id}, word: ${item?.word}`)
    LogInfo(`[ItemDetail] Deleting item immediately (no incoming links), calling deleteMutation.mutate()`)
    deleteMutation.mutate()
  }

  const handleDeleteIncomingLink = async () => {
    if (!item || !links) return
    
    const incomingLinks = links.filter((link: any) => link.destinationItemId === Number(id))
    if (incomingLinks.length !== 1) return
    
    const incomingLink = incomingLinks[0]
    LogInfo(`[ItemDetail] Deleting incoming link from ${incomingLink.sourceItemId} to ${id}`)
    
    try {
      await DeleteLinkByItems(incomingLink.sourceItemId, Number(id))
      LogInfo('[ItemDetail] Incoming link deleted successfully')
      // Refetch both item and links to reload the entire view
      queryClient.invalidateQueries({ queryKey: ['item', id] })
      queryClient.invalidateQueries({ queryKey: ['itemLinks', id] })
      notifications.show({
        title: 'Link deleted',
        message: 'The incoming link has been deleted',
        color: 'green',
      })
    } catch (error) {
      LogInfo(`[ItemDetail] Failed to delete incoming link: ${error}`)
      notifications.show({
        title: 'Error',
        message: 'Failed to delete link',
        color: 'red',
      })
    }
  }

  const handleCreateLinkFromQuality = async (refWord: string) => {
    setCreatingLinkFor(refWord)
    
    try {
      LogInfo(`[handleCreateLinkFromQuality] Calling with id: ${id}, refWord: ${refWord}`)
      const result = await CreateLinkOrRemoveTags(Number(id), refWord)
      
      if (!result) {
        LogInfo('[handleCreateLinkFromQuality] Result is null or undefined')
        return
      }
      
      LogInfo('[handleCreateLinkFromQuality] Got result from backend')
      const { linkCreated, message } = result
      LogInfo(`[handleCreateLinkFromQuality] linkCreated: ${linkCreated}, message: ${message}`)
      
      // Only show notification if something actually changed
      if (message !== "No changes needed") {
        notifications.show({
          title: linkCreated ? 'Link created' : 'Reference tag removed',
          message: message,
          color: linkCreated ? 'green' : 'blue',
        })
      }
      
      // Refresh the data
      await queryClient.invalidateQueries({ queryKey: ['item', id] })
      await queryClient.invalidateQueries({ queryKey: ['links', id] })
      await queryClient.invalidateQueries({ queryKey: ['linkedItems'] })
      LogInfo('[handleCreateLinkFromQuality] Completed successfully')
    } catch (error) {
      LogError(`[handleCreateLinkFromQuality] Caught error`)
      notifications.show({
        title: 'Error',
        message: `Failed: ${error}`,
        color: 'red',
      })
    } finally {
      setCreatingLinkFor(null)
    }
  }

  // Keyboard shortcut for Cmd+G to go to graph
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        navigate(`/graph?itemId=${id}`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [id, navigate])

  // Keyboard shortcut for Cmd+G to go to graph
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        navigate(`/graph?itemId=${id}`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [id, navigate])

  const handleDeleteLinkFromQuality = async (refWord: string) => {
    setDeletingLinkFor(refWord)
    try {
      // Strip possessive 's or s' from the ref word
      let matchWord = refWord
      if (refWord.endsWith("'s") || refWord.endsWith("'s")) {
        matchWord = refWord.slice(0, -2)
      } else if (refWord.endsWith("s'") || refWord.endsWith("s'")) {
        matchWord = refWord.slice(0, -1)
      }
      
      // Look up the destination item by word
      const destItem = await GetItemByWord(matchWord)
      if (!destItem) {
        notifications.show({
          title: 'Item not found',
          message: `Could not find item: ${matchWord}`,
          color: 'red',
        })
        return
      }
      
      // Delete the link
      await DeleteLinkByItems(Number(id), destItem.itemId)
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['item', id] })
      queryClient.invalidateQueries({ queryKey: ['links', id] })
      
      notifications.show({
        title: 'Link deleted',
        message: `Removed link to ${destItem.word}`,
        color: 'green',
      })
    } catch (error) {
      console.error('Failed to delete link:', error)
      notifications.show({
        title: 'Error',
        message: 'Failed to delete link',
        color: 'red',
      })
    } finally {
      setDeletingLinkFor(null)
    }
  }

  if (isLoading) {
    return (
      <Container size="lg">
        <Stack align="center" justify="center" style={{ height: '100vh' }}>
          <Loader />
        </Stack>
      </Container>
    )
  }

  if (!item) {
    return (
      <Container size="lg">
        <Stack align="center" justify="center" style={{ height: '100vh' }}>
          <Text>Item not found</Text>
          <Button component={Link} to="/">Return to Dashboard</Button>
        </Stack>
      </Container>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Fixed Header */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 100, 
        backgroundColor: colorScheme === 'dark' ? '#1a1b1e' : 'white', 
        borderBottom: `1px solid ${colorScheme === 'dark' ? '#373A40' : '#e9ecef'}`,
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
                
                if (type === 'Title') {
                  // Check if definition contains "Written by:" followed by {writer:} tag
                  const writtenByMatch = item?.definition?.match(/Written by:\s*\{writer:\s*([^}]+)\}/i)
                  if (writtenByMatch) {
                    const writer = writtenByMatch[1].trim()
                    query = `"${item?.word || ''}" written by ${writer}`
                  } else {
                    query = `"${item?.word || ''}"`
                  }
                } else if (type === 'Writer') {
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
              onClick={toggleRevealMarkdown}
              title="Show/hide markdown formatting"
            >
              ¶
            </Button>
          </Group>
          <Group gap="sm">
            <Button
              onClick={onEnterEditMode}
              leftSection={<Edit size={16} />}
            >
              Edit
            </Button>
            <Button
              color="red"
              leftSection={<Trash2 size={16} />}
              onClick={handleDelete}
              loading={deleteMutation.isPending}
              disabled={links && links.filter((l: any) => l.destinationItemId === Number(id)).length > 0}
              title={links && links.filter((l: any) => l.destinationItemId === Number(id)).length > 0 ? "Cannot delete: item has incoming connections" : "Delete this item"}
            >
              Delete
            </Button>
          </Group>
        </Group>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', gap: 0 }}>

        {/* Main content area - 7/8 width */}
        <div style={{ flex: '7', padding: '2rem', borderRight: `1px solid ${colorScheme === 'dark' ? '#373A40' : '#e9ecef'}` }}>
          <Grid gutter="xl">
            <Grid.Col span={itemImage ? 8 : 12}>
          <Stack gap="xl">
            <div>
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
                  to={`/item/${id}?tab=graph`}
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
                    onClick={async () => {
                      // Stop any currently playing audio
                      stopAudio()
                      
                      notifications.show({
                        id: 'tts-loading',
                        title: 'Generating pronunciation...',
                        message: 'Querying OpenAI',
                        color: 'blue',
                        loading: true,
                        autoClose: false,
                      })
                      try {
                        const result = await SpeakWord(item.word, item.type, item.word, item.itemId)
                        LogInfo(`Received TTS result, cached: ${result.cached}, error: ${result.error || 'none'}`)
                        
                        // Check for errors
                        if (result.error) {
                          notifications.update({
                            id: 'tts-loading',
                            title: 'TTS Error',
                            message: result.error,
                            color: 'red',
                            loading: false,
                            autoClose: result.errorType === 'missing_key' ? false : 5000,
                            withCloseButton: true,
                          })
                          return
                        }
                        
                        // Show cache indicator
                        if (result.cached) {
                          notifications.update({
                            id: 'tts-loading',
                            title: 'Using cached audio',
                            message: 'Playing from cache',
                            color: 'green',
                            loading: false,
                            autoClose: 1500,
                          })
                        } else {
                          notifications.hide('tts-loading')
                        }
                        
                        const audioData = result.audioData
                        
                        // Wails returns byte arrays as base64 strings, need to decode
                        let uint8Array: Uint8Array
                        if (typeof audioData === 'string') {
                          // Decode base64 string to binary
                          const binaryString = atob(audioData)
                          uint8Array = new Uint8Array(binaryString.length)
                          for (let i = 0; i < binaryString.length; i++) {
                            uint8Array[i] = binaryString.charCodeAt(i)
                          }
                        } else if (audioData instanceof Uint8Array) {
                          uint8Array = audioData
                        } else if (Array.isArray(audioData)) {
                          uint8Array = new Uint8Array(audioData)
                        } else {
                          throw new Error('Unexpected audio data format')
                        }
                        
                        LogInfo(`Converted to Uint8Array, length: ${uint8Array.length}`)
                        const blob = new Blob([uint8Array as BlobPart], { type: 'audio/mpeg' })
                        LogInfo(`Created blob, size: ${blob.size}`)
                        const url = URL.createObjectURL(blob)
                        const audio = new Audio(url)
                        
                        // Store reference to current audio
                        currentAudioRef.current = audio
                        
                        audio.onerror = (e) => {
                          LogError(`Audio playback error: ${JSON.stringify(e)}`)
                          notifications.show({
                            title: 'Playback Error',
                            message: 'Failed to play audio',
                            color: 'red',
                          })
                          currentAudioRef.current = null
                        }
                        
                        await audio.play()
                        LogInfo('Audio playing...')
                        audio.onended = () => {
                          LogInfo('Audio playback completed')
                          URL.revokeObjectURL(url)
                          currentAudioRef.current = null
                        }
                      } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error)
                        notifications.update({
                          id: 'tts-loading',
                          title: 'Error',
                          message: errorMessage,
                          color: 'red',
                          loading: false,
                          autoClose: 3000,
                        })
                        LogError(`Failed to generate pronunciation: ${error}`)
                      }
                    }}
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
                    onClick={async () => {
                      // Stop any currently playing audio
                      stopAudio()
                      
                      // Extract quoted text from definition
                      const quoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/
                      const match = item?.definition?.match(quoteRegex)
                      if (!match || !match[1]) {
                        notifications.show({
                          title: 'No Quote Found',
                          message: 'Could not find quoted text',
                          color: 'orange',
                        })
                        return
                      }
                      
                      // Strip trailing \ or / from each line
                      let quotedText = match[1].replace(/[\\\/]$/gm, '').trim()
                      
                      // Count words in entire poem
                      const wordCount = quotedText.split(/\s+/).length
                      
                      // If entire poem is less than 500 words, read it all
                      if (wordCount < 500) {
                        // Keep full text, just limit to 4000 chars if needed
                        if (quotedText.length > 4000) {
                          quotedText = quotedText.substring(0, 4000)
                        }
                      } else {
                        // Split into stanzas (separated by empty lines)
                        const stanzas = quotedText.split(/\n\s*\n/)
                        
                        // Start with first stanza
                        let selectedText = stanzas[0] || ''
                        let lineCount = selectedText.split('\n').length
                        
                        // If first stanza has less than 5 lines, add more stanzas
                        let stanzaIndex = 1
                        while (lineCount < 5 && stanzaIndex < stanzas.length) {
                          const nextStanza = stanzas[stanzaIndex]
                          const combined = selectedText + '\n\n' + nextStanza
                          
                          // Make sure we don't exceed 4000 chars
                          if (combined.length > 4000) break
                          
                          selectedText = combined
                          lineCount = selectedText.split('\n').length
                          stanzaIndex++
                        }
                        
                        quotedText = selectedText.trim()
                      }
                      
                      // Prepend the title
                      const textToSpeak = `${item.word}. ${quotedText}`
                      
                      // Final safety check: ensure we don't exceed 4000 chars
                      const finalText = textToSpeak.length > 4000 
                        ? textToSpeak.substring(0, 4000) 
                        : textToSpeak
                      
                      notifications.show({
                        id: 'tts-quote-loading',
                        title: 'Generating speech...',
                        message: 'Querying OpenAI',
                        color: 'blue',
                        loading: true,
                        autoClose: false,
                      })
                      
                      try {
                        const result = await SpeakWord(finalText, item?.type || '', item?.word || '', item.itemId)
                        LogInfo(`Received quote TTS result, cached: ${result.cached}, error: ${result.error || 'none'}`)
                        
                        // Check for errors
                        if (result.error) {
                          notifications.update({
                            id: 'tts-quote-loading',
                            title: 'TTS Error',
                            message: result.error,
                            color: 'red',
                            loading: false,
                            autoClose: result.errorType === 'missing_key' ? false : 5000,
                            withCloseButton: true,
                          })
                          return
                        }
                        
                        // Show cache indicator
                        if (result.cached) {
                          notifications.update({
                            id: 'tts-quote-loading',
                            title: 'Using cached audio',
                            message: 'Playing from cache',
                            color: 'green',
                            loading: false,
                            autoClose: 1500,
                          })
                        } else {
                          notifications.hide('tts-quote-loading')
                        }
                        
                        const audioData = result.audioData
                        
                        // Decode base64 string to binary
                        let uint8Array: Uint8Array
                        if (typeof audioData === 'string') {
                          const binaryString = atob(audioData)
                          uint8Array = new Uint8Array(binaryString.length)
                          for (let i = 0; i < binaryString.length; i++) {
                            uint8Array[i] = binaryString.charCodeAt(i)
                          }
                        } else if (audioData instanceof Uint8Array) {
                          uint8Array = audioData
                        } else if (Array.isArray(audioData)) {
                          uint8Array = new Uint8Array(audioData)
                        } else {
                          throw new Error('Unexpected audio data format')
                        }
                        
                        LogInfo(`Converted quote to Uint8Array, length: ${uint8Array.length}`)
                        const blob = new Blob([uint8Array as BlobPart], { type: 'audio/mpeg' })
                        LogInfo(`Created quote blob, size: ${blob.size}`)
                        const url = URL.createObjectURL(blob)
                        const audio = new Audio(url)
                        
                        // Store reference to current audio
                        currentAudioRef.current = audio
                        
                        audio.onerror = (e) => {
                          LogError(`Quote audio playback error: ${JSON.stringify(e)}`)
                          notifications.show({
                            title: 'Playback Error',
                            message: 'Failed to play audio',
                            color: 'red',
                          })
                          currentAudioRef.current = null
                        }
                        
                        await audio.play()
                        LogInfo('Quote audio playing...')
                        audio.onended = () => {
                          LogInfo('Quote audio playback completed')
                          URL.revokeObjectURL(url)
                          currentAudioRef.current = null
                        }
                      } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error)
                        LogError(`Failed to generate quote speech: ${errorMessage}`)
                        LogError(`Full error: ${JSON.stringify(error)}`)
                        notifications.update({
                          id: 'tts-quote-loading',
                          title: 'Error',
                          message: errorMessage || 'Failed to generate speech',
                          color: 'red',
                          loading: false,
                          autoClose: 5000,
                        })
                      }
                    }}
                  >
                    <Volume2 size={22} />
                  </ActionIcon>
                )}
              </Group>
            </div>

              {item.definition && (
                <div>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>
                    {revealMarkdown ? (
                      item.definition
                    ) : (allItems && item.definition) ? (
                      <DefinitionRenderer text={item.definition} allItems={allItems} stopAudio={stopAudio} currentAudioRef={currentAudioRef} item={item} />
                    ) : (
                      item.definition
                    )}
                  </Text>
                </div>
              )}

              {item.derivation && (
                <div>
                  <Title order={2} size="lg" mb="sm">Etymology</Title>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>
                    {revealMarkdown ? (
                      item.derivation
                    ) : (allItems && item.derivation) ? (
                      <DefinitionRenderer text={item.derivation} allItems={allItems} stopAudio={stopAudio} currentAudioRef={currentAudioRef} item={item} />
                    ) : (
                      item.derivation
                    )}
                  </Text>
                </div>
              )}

              {item.appendicies && (
                <div>
                  <Title order={2} size="lg" mb="sm">Notes</Title>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>
                    {revealMarkdown ? (
                      item.appendicies
                    ) : (allItems && item.appendicies) ? (
                      <DefinitionRenderer text={item.appendicies} allItems={allItems} stopAudio={stopAudio} currentAudioRef={currentAudioRef} item={item} />
                    ) : (
                      item.appendicies
                    )}
                  </Text>
                </div>
              )}

              {(item.source || item.sourcePg) && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={600} mb="xs">Source</Text>
                  <Text size="sm">
                    {item.source}
                    {item.sourcePg && `, p. ${item.sourcePg}`}
                  </Text>
                </Paper>
              )}

            <Divider />
            <Text size="sm" c="dimmed">
              Last modified: {new Date(item.modifiedAt).toLocaleString()}
            </Text>

            {/* Data Quality Section */}
            {dataQuality && dataQuality.hasIssues && (
              <Alert color="yellow" icon={<AlertTriangle size={20} />} mt="md">
              <Title order={3} size="md" mb="sm">Data Quality Issues</Title>
              {dataQuality.hasMissingDefinition && (
                <div>
                  <Text size="sm" fw={600} mb="xs">Missing definition (click to define):</Text>
                  <Group gap="xs" mb="md">
                    <Badge 
                      color="red" 
                      variant="light"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setMissingDefinitionModalOpen(true)}
                    >
                      Missing definition
                    </Badge>
                    <Badge 
                      color="red" 
                      variant="filled"
                      style={{ cursor: 'pointer' }}
                      onClick={handleDeleteIncomingLink}
                    >
                      Delete link
                    </Badge>
                  </Group>
                </div>
              )}
              {dataQuality.unlinkedRefs.length > 0 && (
                <div>
                  <Text size="sm" fw={600} mb="xs">References in definition not linked (click to create link):</Text>
                  <Group gap="xs" mb="md">
                    {dataQuality.unlinkedRefs.map((ref: string, idx: number) => {
                      const isCreating = creatingLinkFor === ref
                      return (
                        <Badge 
                          key={idx} 
                          color="red" 
                          variant="light"
                          style={{ cursor: 'pointer' }}
                          onClick={() => !isCreating && handleCreateLinkFromQuality(ref)}
                        >
                          {isCreating ? 'Creating...' : ref}
                        </Badge>
                      )
                    })}
                  </Group>
                </div>
              )}
              {dataQuality.extraLinks.length > 0 && (
                <div>
                  <Text size="sm" fw={600} mb="xs">Linked items not in definition (click to remove link):</Text>
                  <Group gap="xs">
                    {dataQuality.extraLinks.map((word: string, idx: number) => {
                      const isDeleting = deletingLinkFor === word
                      return (
                        <Badge 
                          key={idx} 
                          color="orange" 
                          variant="light"
                          style={{ cursor: 'pointer' }}
                          onClick={() => !isDeleting && handleDeleteLinkFromQuality(word)}
                        >
                          {isDeleting ? 'Deleting...' : word}
                        </Badge>
                      )
                    })}
                  </Group>
                  </div>
                )}
              </Alert>
            )}
          </Stack>
            </Grid.Col>
            
            {/* Image column - only shown if image exists */}
            {itemImage && (
              <Grid.Col span={4}>
                <Box
                  style={{
                    display: 'inline-block',
                    padding: '1px',
                    backgroundColor: 'white',
                    borderRadius: '10px',
                    border: '1px solid #00008B',
                    cursor: 'pointer',
                  }}
                  onClick={() => setImageModalOpen(true)}
                >
                  <img
                    src={itemImage}
                    alt={item.word}
                    style={{
                      display: 'block',
                      maxHeight: '300px',
                      maxWidth: '100%',
                      height: 'auto',
                      width: 'auto',
                      objectFit: 'contain',
                      borderRadius: '6px',
                    }}
                  />
                </Box>
              </Grid.Col>
            )}
          </Grid>
        </div>

        {/* Image Modal */}
        <Modal
          opened={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          size="auto"
          centered
          withCloseButton={false}
          padding={0}
          styles={{
            body: {
              backgroundColor: 'transparent',
            },
            content: {
              backgroundColor: 'transparent',
              boxShadow: 'none',
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setImageModalOpen(false)
            }
          }}
        >
          <img
            src={itemImage || ''}
            alt={item.word}
            style={{
              display: 'block',
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
            onClick={() => setImageModalOpen(false)}
          />
        </Modal>

        {/* Missing Definition Modal */}
        <Modal
          opened={missingDefinitionModalOpen}
          onClose={() => setMissingDefinitionModalOpen(false)}
          title="Missing Definition"
          centered
        >
          <Stack gap="md">
            <Text>Hello World</Text>
            <Group justify="flex-end" gap="sm">
              <Button
                variant="default"
                onClick={() => setMissingDefinitionModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => setMissingDefinitionModalOpen(false)}
              >
                Define
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Connections sidebar - 1/8 width */}
        <div style={{ flex: '1', padding: '1rem', overflowY: 'auto', backgroundColor: colorScheme === 'dark' ? '#25262b' : '#f8f9fa' }}>
          <Stack gap="md">
            {/* Outgoing Section */}
            <div>
              <Group
                gap="xs"
                mb="xs"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={toggleOutgoingCollapsed}
              >
                {outgoingCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <Text size="sm" fw={500}>
                  Outgoing ({links?.filter((l: any) => l.sourceItemId === Number(id)).length || 0})
                </Text>
              </Group>
              {!outgoingCollapsed && (
                <Stack gap="xs">
                  {links && links.filter((l: any) => l.sourceItemId === Number(id)).length > 0 ? (
                    links
                      .filter((link: any) => link.sourceItemId === Number(id))
                      .map((link: any) => {
                        const linkedItemId = link.destinationItemId
                        const linkedItem = linkedItemsQueries.data?.[linkedItemId]

                        return (
                          <Paper
                            key={link.linkId}
                            p="xs"
                            withBorder
                            style={{ backgroundColor: linkedItem?.type ? getItemColor(linkedItem.type) : undefined }}
                          >
                            {linkedItem ? (
                              <Group gap="xs" align="center">
                                <Text
                                  component={Link}
                                  to={`/item/${linkedItemId}?tab=detail`}
                                  size="xs"
                                  fw={600}
                                  c="dark"
                                  style={{ textDecoration: 'none', lineHeight: 1.2, flex: 1 }}
                                  onClick={(e: React.MouseEvent) => {
                                    if (e.metaKey || e.ctrlKey) {
                                      e.preventDefault()
                                    }
                                  }}
                                >
                                  {linkedItem.word}
                                </Text>
                                <ActionIcon
                                  component={Link}
                                  to={`/item/${linkedItemId}?tab=graph`}
                                  size="xs"
                                  variant="subtle"
                                  color="dark"
                                  title="Show in graph"
                                >
                                  <Network size={12} />
                                </ActionIcon>
                              </Group>
                            ) : (
                              <Text size="xs" c="dark">Loading...</Text>
                            )}
                          </Paper>
                        )
                      })
                  ) : (
                    <Text size="xs" c="dimmed" ta="center">
                      No outgoing connections
                    </Text>
                  )}
                </Stack>
              )}
            </div>

            {/* Incoming Section */}
            <div>
              <Group
                gap="xs"
                mb="xs"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={toggleIncomingCollapsed}
              >
                {incomingCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <Text size="sm" fw={500}>
                  Incoming ({links?.filter((l: any) => l.destinationItemId === Number(id)).length || 0})
                </Text>
              </Group>
              {!incomingCollapsed && (
                <Stack gap="xs">
                  {links && links.filter((l: any) => l.destinationItemId === Number(id)).length > 0 ? (
                    links
                      .filter((link: any) => link.destinationItemId === Number(id))
                      .map((link: any) => {
                        const linkedItemId = link.sourceItemId
                        const linkedItem = linkedItemsQueries.data?.[linkedItemId]

                        return (
                          <Paper
                            key={link.linkId}
                            p="xs"
                            withBorder
                            style={{ backgroundColor: linkedItem?.type ? getItemColor(linkedItem.type) : undefined }}
                          >
                            {linkedItem ? (
                              <Group gap="xs" align="center">
                                <Text
                                  component={Link}
                                  to={`/item/${linkedItemId}?tab=detail`}
                                  size="xs"
                                  fw={600}
                                  c="dark"
                                  style={{ textDecoration: 'none', lineHeight: 1.2, flex: 1 }}
                                  onClick={(e: React.MouseEvent) => {
                                    if (e.metaKey || e.ctrlKey) {
                                      e.preventDefault()
                                    }
                                  }}
                                >
                                  {linkedItem.word}
                                </Text>
                                <ActionIcon
                                  component={Link}
                                  to={`/item/${linkedItemId}?tab=graph`}
                                  size="xs"
                                  variant="subtle"
                                  color="dark"
                                  title="Show in graph"
                                >
                                  <Network size={12} />
                                </ActionIcon>
                              </Group>
                            ) : (
                              <Text size="xs" c="dark">Loading...</Text>
                            )}
                          </Paper>
                        )
                      })
                  ) : (
                    <Text size="xs" c="dimmed" ta="center">
                      No incoming connections
                    </Text>
                  )}
                </Stack>
              )}
            </div>
          </Stack>
        </div>
      </div>
    </div>
  )
}
