import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Button, Group, Text, Stack, useMantineColorScheme, Loader, Paper, ActionIcon, Checkbox, NumberInput, Collapse } from '@mantine/core'
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Position,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import { GetAllItems, GetAllLinks, GetItem, GetItemLinks, GetSettings, SaveOutgoingCollapsed, SaveIncomingCollapsed, SaveLastWord } from '../../wailsjs/go/main/App.js'
import { LogInfo } from '../../wailsjs/runtime/runtime.js'
import { ArrowLeft, RotateCcw, Network, ChevronDown, ChevronRight, Filter } from 'lucide-react'
import { getItemColor, getItemTextColor } from '../utils/colors'

// Custom node component
function CustomNode({ data }: any) {
  const getBackgroundColor = () => {
    // Selected node is always light yellow
    if (data.isSelected) {
      return '#FFFFE0' // light yellow
    }
    return getItemColor(data.type)
  }

  return (
    <div
      style={{ 
        backgroundColor: getBackgroundColor(), 
        color: getItemTextColor(data.type),
        padding: '0.25rem 0.5rem',
        borderRadius: '0.5rem',
        border: '2px solid #9CA3AF',
        fontSize: '0.7rem',
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
      title={data.definition || data.label}
    >
      {data.label} ({data.connections})
    </div>
  )
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
}

function GraphInner({ selectedItemId }: { selectedItemId?: number }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { fitView } = useReactFlow()
  const { colorScheme } = useMantineColorScheme()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNode, setSelectedNode] = useState<number | null>(null)
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(['Reference', 'Writer', 'Title']))
  const [minConnections, setMinConnections] = useState<number>(2)
  
  // DEBUG: Log edges state after it changes
  useEffect(() => {
    LogInfo(`[Graph DEBUG] Edges state changed. Count: ${edges.length}`)
    if (edges.length > 0) {
      LogInfo(`[Graph DEBUG] Sample edge from state: ${JSON.stringify(edges[0])}`)
    }
  }, [edges])
  const [filtersVisible, setFiltersVisible] = useState(false)
  const [hasAutoSelected, setHasAutoSelected] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<number | null>(null)
  const [outgoingCollapsed, setOutgoingCollapsed] = useState(true) // default collapsed
  const [incomingCollapsed, setIncomingCollapsed] = useState(false) // default expanded
  
  // Check for selected parameter from prop or URL (re-runs when selectedItemId or location changes)
  useEffect(() => {
    // Prioritize prop over URL parameter
    if (selectedItemId) {
      setPendingSelection(selectedItemId)
      setHasAutoSelected(true)
    } else {
      const params = new URLSearchParams(location.search)
      const selectedParam = params.get('selected')
      if (selectedParam) {
        const newSelection = Number(selectedParam)
        setPendingSelection(newSelection)
        setHasAutoSelected(true)
      } else {
        setPendingSelection(null)
        setHasAutoSelected(false)
      }
    }
  }, [selectedItemId, location.search])

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['allItems'],
    queryFn: async () => {
      const data = await GetAllItems()
      LogInfo(`[Graph] Fetched ${data?.length || 0} items from backend`)
      if (data && data.length > 0) {
        const sampleItem = data[0]
        LogInfo(`[Graph] Sample item: ${sampleItem.word}, has definition: ${!!sampleItem.definition}`)
      }
      return data
    },
  })

  const { data: links, isLoading: linksLoading } = useQuery({
    queryKey: ['allLinks'],
    queryFn: GetAllLinks,
  })

  // Query for selected item's links (for the connections sidebar)
  const { data: selectedItemLinks } = useQuery({
    queryKey: ['itemLinks', selectedNode],
    queryFn: () => selectedNode ? GetItemLinks(selectedNode) : Promise.resolve([]),
    enabled: selectedNode !== null,
  })

  // Get unique item IDs from links for the selected item
  const linkedItemIds = selectedItemLinks ? [
    ...new Set([
      ...selectedItemLinks.map((l: any) => l.sourceItemId),
      ...selectedItemLinks.map((l: any) => l.destinationItemId)
    ])
  ].filter(id => id !== selectedNode) : []

  // Query for linked items details
  const linkedItemsQueries = useQueries({
    queries: linkedItemIds.map((itemId: number) => ({
      queryKey: ['item', itemId],
      queryFn: () => GetItem(itemId),
      staleTime: 60000,
    })),
  })

  const isLoading = itemsLoading || linksLoading

  // Load settings from backend
  useEffect(() => {
    GetSettings().then((settings) => {
      setOutgoingCollapsed(settings.collapsed?.outgoing !== undefined ? settings.collapsed.outgoing : true)
      setIncomingCollapsed(settings.collapsed?.incoming !== undefined ? settings.collapsed.incoming : false)
    })
  }, [])

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

  useEffect(() => {
    if (!items || !links) return

    // Determine the actual selected node for this render
    let actualSelectedNode = selectedNode
    
    // Apply pending selection from URL if present
    if (pendingSelection !== null && pendingSelection !== selectedNode) {
      actualSelectedNode = pendingSelection
      setSelectedNode(pendingSelection)
      setPendingSelection(null)
    }

    // Auto-select "poetry" item if no node is selected and haven't auto-selected yet
    if (actualSelectedNode === null && !hasAutoSelected && items.length > 0) {
      const poetryItem = items.find((item: any) => item.word.toLowerCase() === 'poetry')
      if (poetryItem) {
        actualSelectedNode = poetryItem.itemId
        setSelectedNode(poetryItem.itemId)
        setHasAutoSelected(true)
      }
    }

    // Build connection counts
    const connectionCounts = new Map<number, number>()
    links.forEach((link: any) => {
      connectionCounts.set(link.sourceItemId, (connectionCounts.get(link.sourceItemId) || 0) + 1)
      connectionCounts.set(link.destinationItemId, (connectionCounts.get(link.destinationItemId) || 0) + 1)
    })

    // Filter items based on selection
    let filteredItems = items
    
    if (actualSelectedNode !== null) {
      // Show only selected node and its direct connections
      const connectedIds = new Set<number>([actualSelectedNode])
      links.forEach((link: any) => {
        if (link.sourceItemId === actualSelectedNode) {
          connectedIds.add(link.destinationItemId)
        }
        if (link.destinationItemId === actualSelectedNode) {
          connectedIds.add(link.sourceItemId)
        }
      })
      filteredItems = items.filter((item: any) => connectedIds.has(item.itemId))
    } else {
      // Normal filtering when no node is selected
      filteredItems = items.filter((item: any) => {
        const connections = connectionCounts.get(item.itemId) || 0
        if (connections < minConnections) return false
        if (visibleTypes.size > 0 && !visibleTypes.has(item.type)) return false
        return true
      })

      // Limit to reasonable number for performance
      if (filteredItems.length > 500) {
        filteredItems = filteredItems
          .sort((a: any, b: any) => (connectionCounts.get(b.itemId) || 0) - (connectionCounts.get(a.itemId) || 0))
          .slice(0, 500)
      }
    }

    // Create nodes with temporary positions
    const simulationNodes = filteredItems.map((item: any) => ({
      id: String(item.itemId),
      itemId: item.itemId,
      word: item.word,
      type: item.type,
      connections: connectionCounts.get(item.itemId) || 0,
      definition: item.definition,
      x: Math.random() * 1000,
      y: Math.random() * 1000,
    }))

    // Create simulation links
    const simulationLinks: any[] = []
    links.forEach((link: any) => {
      const sourceId = String(link.sourceItemId)
      const targetId = String(link.destinationItemId)
      const sourceNode = simulationNodes.find(n => n.id === sourceId)
      const targetNode = simulationNodes.find(n => n.id === targetId)
      
      if (sourceNode && targetNode) {
        // If a node is selected, only include edges connected to it
        if (actualSelectedNode !== null) {
          if (link.sourceItemId === actualSelectedNode || link.destinationItemId === actualSelectedNode) {
            simulationLinks.push({ source: sourceId, target: targetId })
          }
        } else {
          simulationLinks.push({ source: sourceId, target: targetId })
        }
      }
    })

    // Use radial layout when a node is selected, force-directed otherwise
    if (actualSelectedNode !== null) {
      // Radial layout: center node in middle, incoming/outgoing in semicircles
      const centerNode = simulationNodes.find(n => n.itemId === actualSelectedNode)
      const otherNodes = simulationNodes.filter(n => n.itemId !== actualSelectedNode)
      
      if (centerNode) {
        // Place center node at origin
        centerNode.x = 0
        centerNode.y = 0
        centerNode.fx = 0
        centerNode.fy = 0
        
        // Separate incoming and outgoing nodes
        const incomingNodes: any[] = []
        const outgoingNodes: any[] = []
        
        otherNodes.forEach(node => {
          const isOutgoing = links.some((l: any) => 
            l.sourceItemId === actualSelectedNode && l.destinationItemId === node.itemId
          )
          const isIncoming = links.some((l: any) => 
            l.destinationItemId === actualSelectedNode && l.sourceItemId === node.itemId
          )
          
          if (isOutgoing) {
            outgoingNodes.push(node)
          }
          if (isIncoming) {
            incomingNodes.push(node)
          }
        })
        
        // Position outgoing nodes (what center references) - RIGHT hemisphere
        const baseRadius = 180
        const maxExtraRadius = 80
        outgoingNodes.forEach((node, i) => {
          const angle = (Math.PI / 2) - (Math.PI * (i / Math.max(outgoingNodes.length - 1, 1)))
          const connectionFactor = Math.min(node.connections / 20, 1) // Cap the effect
          const radius = baseRadius + (connectionFactor * maxExtraRadius)
          node.x = Math.cos(angle) * radius
          node.y = Math.sin(angle) * radius
        })
        
        // Position incoming nodes (what references center) - LEFT hemisphere  
        incomingNodes.forEach((node, i) => {
          const angle = (Math.PI / 2) + (Math.PI * (i / Math.max(incomingNodes.length - 1, 1)))
          const connectionFactor = Math.min(node.connections / 20, 1) // Cap the effect
          const radius = baseRadius + (connectionFactor * maxExtraRadius)
          node.x = Math.cos(angle) * radius
          node.y = Math.sin(angle) * radius
        })
      }
    } else {
      // No selection: use force-directed layout with enhanced clustering
      const simulation = forceSimulation(simulationNodes)
        .force('link', forceLink(simulationLinks).id((d: any) => d.id).distance(80).strength(0.7))
        .force('charge', forceManyBody().strength((d: any) => -300 - (Math.min(d.connections, 10) * 20)).distanceMax(300))
        .force('center', forceCenter(0, 0))
        .force('collide', forceCollide().radius((d: any) => 35 + (Math.min(d.connections, 10) * 2)))
        .alphaDecay(0.015)
        .stop()

      // Run simulation synchronously
      const iterations = simulationNodes.length < 100 ? 300 : 200
      for (let i = 0; i < iterations; i++) {
        simulation.tick()
      }
    }

    // Convert to React Flow nodes
    const flowNodes: Node[] = simulationNodes.map((node: any) => ({
      id: node.id,
      type: 'custom',
      position: { x: node.x, y: node.y },
      data: {
        id: node.itemId,
        label: node.word,
        type: node.type,
        connections: node.connections,
        definition: node.definition,
        isSelected: node.itemId === actualSelectedNode,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }))

    // Build edges - only between visible nodes
    const nodeIds = new Set(flowNodes.map(n => n.id))
    const flowEdges: Edge[] = []
    
    links.forEach((link: any) => {
      const sourceId = String(link.sourceItemId)
      const targetId = String(link.destinationItemId)
      
      if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
        // If a node is selected, only show edges connected to it
        if (actualSelectedNode !== null) {
          if (link.sourceItemId === actualSelectedNode || link.destinationItemId === actualSelectedNode) {
            flowEdges.push({
              id: `${sourceId}-${targetId}`,
              source: sourceId,
              target: targetId,
              animated: false,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: 'rgba(100, 100, 100, 0.6)',
              },
              style: { stroke: 'rgba(100, 100, 100, 0.6)', strokeWidth: 2 },
            })
          }
        } else {
          flowEdges.push({
            id: `${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            animated: false,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 15,
              height: 15,
              color: 'rgba(150, 150, 150, 0.4)',
            },
            style: { stroke: 'rgba(150, 150, 150, 0.3)', strokeWidth: 1.5 },
          })
        }
      }
    })

    LogInfo(`[Graph] Created ${flowNodes.length} nodes and ${flowEdges.length} edges`)
    if (flowEdges.length > 0) {
      LogInfo(`[Graph] Sample edge: ${JSON.stringify(flowEdges[0])}`)
    }
    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [items, links, visibleTypes, minConnections, selectedNode, hasAutoSelected, pendingSelection, setNodes, setEdges])
  
  const toggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }
  
  const allTypes = ['Reference', 'Writer', 'Title']

  // Keyboard shortcut for Cmd+D to go to detail view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        if (selectedNode !== null) {
          navigate(`/item/${selectedNode}?tab=detail`)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNode, navigate])

  const handleNodeClick = useCallback((event: any, node: any) => {
    LogInfo(`[Graph] Node clicked: ${node.data.label}`)
    
    // Update current item tracking
    SaveLastWord(node.data.id).catch(err => LogInfo(`[Graph] Error saving last word: ${err}`))
    
    // If clicking on the already-selected node, go to detail view
    if (node.data.id === selectedNode) {
      navigate(`/item/${node.data.id}?tab=detail`)
      return
    }
    
    // For other nodes: Cmd+Click (Mac) or Ctrl+Click (Windows/Linux) or double-click to view detail
    if (event.metaKey || event.ctrlKey || event.detail === 2) {
      navigate(`/item/${node.data.id}?tab=detail`)
    } else {
      setSelectedNode(node.data.id)
    }
  }, [navigate, selectedNode])

  // Fit entire graph when node selection changes
  useEffect(() => {
    if (selectedNode !== null && nodes.length > 0) {
      setTimeout(() => {
        fitView({ duration: 400, padding: 0.2 })
      }, 100)
    }
  }, [selectedNode, nodes, fitView])

  const handleReset = () => {
    setSelectedNode(null)
    setTimeout(() => {
      fitView({ duration: 400, padding: 0.2 })
    }, 100)
  }

  if (isLoading) {
    return (
      <Stack align="center" justify="center" style={{ height: '100vh' }}>
        <Loader size="xl" />
        <Text>Loading graph data...</Text>
      </Stack>
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
            {selectedNode && (
              <Button
                variant="light"
                leftSection={<RotateCcw size={18} />}
                onClick={handleReset}
              >
                Reset View
              </Button>
            )}
            {!selectedNode && (
              <Button
                variant="light"
                leftSection={<Filter size={18} />}
                onClick={() => setFiltersVisible(!filtersVisible)}
              >
                Filters
              </Button>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            {nodes.length} nodes • {edges.length} connections
          </Text>
        </Group>
        
        {!selectedNode && (
          <Collapse in={filtersVisible}>
            <Group gap="xl" mt="md" align="flex-start">
              <Stack gap="xs">
                <Text size="sm" fw={500}>Item Types</Text>
                {allTypes.map((type) => (
                  <Checkbox
                    key={type}
                    label={type}
                    checked={visibleTypes.has(type)}
                    onChange={() => toggleType(type)}
                    size="xs"
                  />
                ))}
              </Stack>
              
              <Stack gap="xs">
                <Text size="sm" fw={500}>Connection Threshold</Text>
                <NumberInput
                  value={minConnections}
                  onChange={(val) => setMinConnections(Number(val) || 1)}
                  min={1}
                  max={50}
                  size="xs"
                  style={{ width: 120 }}
                  description={`Show nodes with ${minConnections}+ connections`}
                />
              </Stack>
            </Group>
          </Collapse>
        )}
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, display: 'flex', gap: 0, minHeight: 0 }}>
        {/* Graph area - 7/8 width */}
        <div style={{ flex: '7', position: 'relative', borderRight: `1px solid ${colorScheme === 'dark' ? '#373A40' : '#e9ecef'}` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Controls />
            <Background color="#aaa" gap={16} />
          </ReactFlow>
          </div>
        </div>

        {/* Connections sidebar - 1/8 width */}
        <div style={{ flex: '1', padding: '1rem', overflowY: 'auto', backgroundColor: colorScheme === 'dark' ? '#25262b' : '#f8f9fa' }}>
          {selectedNode ? (
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
                    Outgoing ({selectedItemLinks?.filter((l: any) => l.sourceItemId === selectedNode).length || 0})
                  </Text>
                </Group>
                {!outgoingCollapsed && (
                  <Stack gap="xs">
                    {selectedItemLinks && selectedItemLinks.filter((l: any) => l.sourceItemId === selectedNode).length > 0 ? (
                      selectedItemLinks
                        .filter((link: any) => link.sourceItemId === selectedNode)
                        .map((link: any) => {
                          const linkedItemId = link.destinationItemId
                          const linkedItemQuery = linkedItemsQueries.find((q: any) => q.data?.itemId === linkedItemId)
                          const linkedItem = linkedItemQuery?.data

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
                                    size="xs"
                                    variant="subtle"
                                    color="dark"
                                    title="Show in graph"
                                    onClick={() => setSelectedNode(linkedItemId)}
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
                    Incoming ({selectedItemLinks?.filter((l: any) => l.destinationItemId === selectedNode).length || 0})
                  </Text>
                </Group>
                {!incomingCollapsed && (
                  <Stack gap="xs">
                    {selectedItemLinks && selectedItemLinks.filter((l: any) => l.destinationItemId === selectedNode).length > 0 ? (
                      selectedItemLinks
                        .filter((link: any) => link.destinationItemId === selectedNode)
                        .map((link: any) => {
                          const linkedItemId = link.sourceItemId
                          const linkedItemQuery = linkedItemsQueries.find((q: any) => q.data?.itemId === linkedItemId)
                          const linkedItem = linkedItemQuery?.data

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
                                    size="xs"
                                    variant="subtle"
                                    color="dark"
                                    title="Show in graph"
                                    onClick={() => setSelectedNode(linkedItemId)}
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
          ) : (
            <Text size="xs" c="dimmed" ta="center" mt="lg">
              Select a node to view connections
            </Text>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Graph({ selectedItemId }: { selectedItemId?: number }) {
  return (
    <ReactFlowProvider>
      <GraphInner selectedItemId={selectedItemId} />
    </ReactFlowProvider>
  )
}

