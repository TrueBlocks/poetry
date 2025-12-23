import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";
import {
  Button,
  Group,
  Text,
  Stack,
  useMantineColorScheme,
  Checkbox,
  NumberInput,
  Collapse,
  Paper,
  ActionIcon,
} from "@mantine/core";
import {
  Filter,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Network,
} from "lucide-react";
import { useNavigate, Link, useParams } from "react-router-dom";
import {
  GetItem,
  GetItemLinks,
  GetSettings,
  GetItemImage,
  GetEgoGraph,
} from "@wailsjs/go/main/App.js";
import { LogInfo } from "@wailsjs/runtime/runtime.js";
import { getItemColor, getItemTextColor } from "@utils/colors";
import { useUIStore } from "@stores/useUIStore";
import { database } from "@models";

// D3 simulation node type
interface GraphNode extends database.Item {
  id: string;
  connections: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  isIncomingNode?: boolean;
  isOutgoingNode?: boolean;
}

// D3 simulation link type
interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type?: string;
}

// Custom node component
function CustomNode({ data }: any) {
  const getBackgroundColor = () => {
    // Selected node is always light yellow
    if (data.isSelected) {
      return "#FFFFE0"; // light yellow
    }
    return getItemColor(data.type);
  };

  return (
    <div
      style={{
        backgroundColor: getBackgroundColor(),
        color: getItemTextColor(data.type),
        padding: data.isSelected ? "0.17rem 0.35rem" : "0.12rem 0.25rem",
        borderRadius: "0.5rem",
        border: "2px solid #9CA3AF",
        fontSize: data.isSelected ? "0.77rem" : "0.55rem",
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
        position: "relative", // Ensure handles are positioned relative to this
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}
      title={data.definition || data.label}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      {data.image && (
        <img
          src={data.image}
          style={{
            width: data.isSelected ? 20 : 14,
            height: data.isSelected ? 20 : 14,
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
      <span>
        {data.label} ({data.connections})
      </span>
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export default function Graph({ selectedItemId }: { selectedItemId?: number }) {
  useEffect(() => {
    if (selectedItemId) {
      console.log("Graph selected item:", selectedItemId);
    }
  }, [selectedItemId]);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { colorScheme } = useMantineColorScheme();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const selectedNode = id ? Number(id) : null;
  const setSelectedNode = (id: number) => navigate(`/item/${id}?tab=graph`);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [rfInstance, setRfInstance] = useState<any>(null);
  const [nodeImages, setNodeImages] = useState<Record<number, string | null>>(
    {},
  );
  const { setLastWordId } = useUIStore();

  // Zoom shortcuts
  useEffect(() => {
    if (!rfInstance) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          rfInstance.zoomIn();
        } else if (e.key === "-") {
          e.preventDefault();
          rfInstance.zoomOut();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rfInstance]);

  // Filter states
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(["Reference", "Writer", "Title"]),
  );
  const [minConnections, setMinConnections] = useState<number>(2);

  // Sidebar states
  const {
    outgoingCollapsed,
    setOutgoingCollapsed,
    incomingCollapsed,
    setIncomingCollapsed,
  } = useUIStore();

  const [navigationHistory, setNavigationHistory] = useState<number[]>([]);

  const { data: graphData } = useQuery({
    queryKey: ["graphData", selectedNode],
    queryFn: async () => {
      if (selectedNode) {
        return GetEgoGraph(selectedNode, 1);
      }
      return null;
    },
  });

  const items = useMemo(() => graphData?.items || [], [graphData]);
  const links = useMemo(() => graphData?.links || [], [graphData]);

  // Query for selected item's links (for the connections sidebar)
  const { data: selectedItemLinks } = useQuery({
    queryKey: ["itemLinks", selectedNode],
    queryFn: () =>
      selectedNode ? GetItemLinks(selectedNode) : Promise.resolve([]),
    enabled: selectedNode !== null,
  });

  // Get unique item IDs from links for the selected item
  const linkedItemIds = selectedItemLinks
    ? [
        ...new Set([
          ...selectedItemLinks.map((l: any) => l.sourceItemId),
          ...selectedItemLinks.map((l: any) => l.destinationItemId),
        ]),
      ].filter((id) => id !== selectedNode)
    : [];

  // Query for linked items details
  const linkedItemsQueries = useQueries({
    queries: linkedItemIds.map((itemId: number) => ({
      queryKey: ["item", itemId],
      queryFn: () => GetItem(itemId),
      staleTime: 60000,
    })),
  });

  // Load settings from backend
  useEffect(() => {
    GetSettings().then((settings: any) => {
      if (settings.navigationHistory) {
        setNavigationHistory(settings.navigationHistory);
      }
    });
  }, [selectedNode]);

  // Toggle outgoing collapsed
  const toggleOutgoingCollapsed = () => {
    setOutgoingCollapsed(!outgoingCollapsed);
  };

  // Toggle incoming collapsed
  const toggleIncomingCollapsed = () => {
    setIncomingCollapsed(!incomingCollapsed);
  };

  // Keyboard shortcut for Cmd+D to go to detail view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        if (selectedNode !== null) {
          navigate(`/item/${selectedNode}?tab=detail`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, navigate]);

  const handleNodeClick = useCallback(
    (event: any, node: any) => {
      LogInfo(`[Graph] Node clicked: ${node.data.label} (${node.data.id})`);

      // Update current item tracking
      setLastWordId(node.data.id);

      // If clicking on the already-selected node, go to detail view
      if (Number(node.data.id) === selectedNode) {
        navigate(`/item/${node.data.id}?tab=detail`);
        return;
      }

      // For other nodes: Cmd+Click (Mac) or Ctrl+Click (Windows/Linux) or double-click to view detail
      if (event.metaKey || event.ctrlKey || event.detail === 2) {
        navigate(`/item/${node.data.id}?tab=detail`);
      } else {
        navigate(`/item/${node.data.id}?tab=graph`);
      }
    },
    [navigate, selectedNode, setLastWordId],
  );

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const allTypes = ["Reference", "Writer", "Title"];

  useEffect(() => {
    if (!items || !links) return;

    LogInfo(`[Graph] Loaded ${items.length} items and ${links.length} links`);

    // Pre-process links to handle bidirectional rule:
    // If an item has both an incoming and an outgoing link to the same other item, remove one of them.
    // This only applies when a node is selected, to simplify the Radial Layout.
    let visibleLinks = links;
    if (selectedNode !== null) {
      const selectedNodeId = Number(selectedNode);
      const selectedItem = items.find((i: any) => i.itemId === selectedNodeId);
      const itemType = selectedItem ? selectedItem.type : "Reference";

      const incomingMap = new Set<number>();
      const outgoingMap = new Set<number>();

      // Map connections
      links.forEach((l: any) => {
        const sourceId = Number(l.sourceItemId);
        const destId = Number(l.destinationItemId);
        if (destId === selectedNodeId) incomingMap.add(sourceId);
        if (sourceId === selectedNodeId) outgoingMap.add(destId);
      });

      if (selectedNodeId === 55950) {
        LogInfo(`[Graph Debug] Miltonic Sonnet (55950)`);
        LogInfo(
          `[Graph Debug] Incoming Map has 77600 (sonnet)? ${incomingMap.has(77600)}`,
        );
        LogInfo(
          `[Graph Debug] Outgoing Map has 77600 (sonnet)? ${outgoingMap.has(77600)}`,
        );
      }

      visibleLinks = links.filter((l: any) => {
        const sourceId = Number(l.sourceItemId);
        const destId = Number(l.destinationItemId);

        // Remove self-loops in Radial Layout as they look messy
        if (sourceId === destId) return false;

        // Special Rule for Writers:
        // If the selected node is a Writer, and we have an incoming link from a Title,
        // AND that Title is ALSO in the outgoing map (bidirectional),
        // then HIDE the incoming link.
        // Writers "write" Titles (outgoing), so the incoming "written by" link is redundant in the graph.
        if (itemType === "Writer") {
          if (destId === selectedNodeId) {
            // This is an incoming link (Source -> Writer)
            const sourceItem = items.find((i: any) => i.itemId === sourceId);
            if (sourceItem?.type === "Title") {
              // It's a Title -> Writer link.
              // Check if we also have Writer -> Title (outgoing)
              if (outgoingMap.has(sourceId)) {
                return false; // Hide this incoming link
              }
            }
          }
        }

        return true;
      });
    }

    // Build connection counts (using original links for accurate sizing)
    const connectionCounts = new Map<number, number>();
    links.forEach((link: any) => {
      connectionCounts.set(
        link.sourceItemId,
        (connectionCounts.get(link.sourceItemId) || 0) + 1,
      );
      connectionCounts.set(
        link.destinationItemId,
        (connectionCounts.get(link.destinationItemId) || 0) + 1,
      );
    });

    // Filter items based on selection OR filters
    let filteredItems = items;

    if (selectedNode !== null) {
      // Show only selected node and its direct connections
      const connectedIds = new Set<number>([selectedNode]);
      visibleLinks.forEach((link: any) => {
        if (link.sourceItemId === selectedNode)
          connectedIds.add(link.destinationItemId);
        if (link.destinationItemId === selectedNode)
          connectedIds.add(link.sourceItemId);
      });
      filteredItems = items.filter((item: any) =>
        connectedIds.has(item.itemId),
      );
    } else {
      // Normal filtering when no node is selected
      filteredItems = items.filter((item: any) => {
        const connections = connectionCounts.get(item.itemId) || 0;
        if (connections < minConnections) return false;
        if (visibleTypes.size > 0 && !visibleTypes.has(item.type)) return false;
        return true;
      });

      // Limit to reasonable number for performance
      if (filteredItems.length > 500) {
        filteredItems = filteredItems
          .sort(
            (a: any, b: any) =>
              (connectionCounts.get(b.itemId) || 0) -
              (connectionCounts.get(a.itemId) || 0),
          )
          .slice(0, 500);
      }
    }

    // Create simulation nodes
    let simulationNodes: GraphNode[] = [];

    if (selectedNode !== null) {
      // RADIAL LAYOUT: Duplicate nodes for bidirectional links
      const centerItem = filteredItems.find((i) => i.itemId === selectedNode);
      if (centerItem) {
        simulationNodes.push({
          id: String(centerItem.itemId),
          itemId: centerItem.itemId,
          word: centerItem.word,
          type: centerItem.type,
          connections: connectionCounts.get(centerItem.itemId) || 0,
          definition: centerItem.definition,
          createdAt: centerItem.createdAt,
          modifiedAt: centerItem.modifiedAt,
          convertValues: centerItem.convertValues,
          x: 0,
          y: 0,
          fx: 0,
          fy: 0,
        });
      }

      filteredItems.forEach((item) => {
        if (item.itemId === selectedNode) return;

        const isIncoming = visibleLinks.some(
          (l) =>
            l.destinationItemId === selectedNode &&
            l.sourceItemId === item.itemId,
        );
        const isOutgoing = visibleLinks.some(
          (l) =>
            l.sourceItemId === selectedNode &&
            l.destinationItemId === item.itemId,
        );

        if (isIncoming) {
          simulationNodes.push({
            id: `${item.itemId}-in`,
            itemId: item.itemId,
            word: item.word,
            type: item.type,
            connections: connectionCounts.get(item.itemId) || 0,
            definition: item.definition,
            createdAt: item.createdAt,
            modifiedAt: item.modifiedAt,
            convertValues: item.convertValues,
            x: Math.random() * 500,
            y: Math.random() * 500,
            isIncomingNode: true,
          });
        }

        if (isOutgoing) {
          simulationNodes.push({
            id: `${item.itemId}-out`,
            itemId: item.itemId,
            word: item.word,
            type: item.type,
            connections: connectionCounts.get(item.itemId) || 0,
            definition: item.definition,
            createdAt: item.createdAt,
            modifiedAt: item.modifiedAt,
            convertValues: item.convertValues,
            x: Math.random() * 500,
            y: Math.random() * 500,
            isOutgoingNode: true,
          });
        }
      });
    } else {
      // STANDARD LAYOUT
      simulationNodes = filteredItems.map((item) => ({
        id: String(item.itemId),
        itemId: item.itemId,
        word: item.word,
        type: item.type,
        connections: connectionCounts.get(item.itemId) || 0,
        definition: item.definition,
        createdAt: item.createdAt,
        modifiedAt: item.modifiedAt,
        convertValues: item.convertValues,
        x: Math.random() * 500,
        y: Math.random() * 500,
        fx: undefined,
        fy: undefined,
      }));
    }

    // Create simulation links
    const nodeIds = new Set(simulationNodes.map((n) => n.id));
    const simulationLinks: GraphLink[] = [];

    visibleLinks.forEach((link) => {
      const sourceId = String(link.sourceItemId);
      const targetId = String(link.destinationItemId);

      if (selectedNode !== null) {
        // Radial Logic: Connect to specific -in/-out nodes
        if (Number(targetId) === selectedNode) {
          // Incoming: Source-in -> Center
          const sourceNodeId = `${sourceId}-in`;
          if (nodeIds.has(sourceNodeId)) {
            simulationLinks.push({ source: sourceNodeId, target: targetId });
          }
        } else if (Number(sourceId) === selectedNode) {
          // Outgoing: Center -> Target-out
          const targetNodeId = `${targetId}-out`;
          if (nodeIds.has(targetNodeId)) {
            simulationLinks.push({ source: sourceId, target: targetNodeId });
          }
        }
      } else {
        // Standard Logic
        if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
          simulationLinks.push({ source: sourceId, target: targetId });
        }
      }
    });

    // LAYOUT LOGIC
    if (selectedNode !== null) {
      // RADIAL LAYOUT
      const centerNode = simulationNodes.find((n) => n.itemId === selectedNode);

      if (centerNode) {
        // Place center node at origin
        centerNode.x = 0;
        centerNode.y = 0;
        centerNode.fx = 0;
        centerNode.fy = 0;

        // Separate incoming and outgoing nodes based on our flags
        const incomingNodes = simulationNodes.filter((n) => n.isIncomingNode);
        const outgoingNodes = simulationNodes.filter((n) => n.isOutgoingNode);

        // Position outgoing nodes (what center references) - RIGHT hemisphere (0.5 to 5.5)
        const baseRadius = 200;

        // Helper to position nodes in an arc with dynamic staggering
        const layoutArc = (
          nodes: GraphNode[],
          startAngle: number,
          endAngle: number,
        ) => {
          if (nodes.length === 0) return;

          // 1. Calculate Arc Properties
          const angleSpan = Math.abs(endAngle - startAngle);
          const arcLength = angleSpan * baseRadius; // Approx arc length at base radius

          // Determine density based on vertical spacing requirements
          const nodeHeight = 24; // Height of node + vertical padding
          const pixelsPerNode = arcLength / nodes.length;

          // Calculate layers needed to prevent vertical overlap
          let layers = 1;
          if (pixelsPerNode < nodeHeight) {
            layers = Math.ceil(nodeHeight / pixelsPerNode);
          }

          // Cap layers to keep it reasonable
          layers = Math.min(layers, 12);

          const layerStep = 120; // Horizontal step per layer

          nodes.forEach((node, i) => {
            // Distribute evenly within the arc
            const ratio = (i + 1) / (nodes.length + 1);
            const angle = startAngle + ratio * (endAngle - startAngle);

            // Stagger: 0, 1, 2...
            const layer = i % layers;

            // Calculate radius
            const radius = baseRadius + layer * layerStep;

            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
          });
        };

        // Outgoing: -5PI/12 (-75deg) to 5PI/12 (75deg)
        layoutArc(outgoingNodes, (-5 * Math.PI) / 12, (5 * Math.PI) / 12);

        // Incoming: 17PI/12 (255deg) to 7PI/12 (105deg)
        layoutArc(incomingNodes, (17 * Math.PI) / 12, (7 * Math.PI) / 12);
      }
    } else {
      // FORCE LAYOUT (Default)
      const simulation = forceSimulation(simulationNodes)
        .force(
          "link",
          forceLink(simulationLinks)
            .id((d: any) => d.id)
            .distance(80)
            .strength(0.7),
        )
        .force(
          "charge",
          forceManyBody()
            .strength((d: any) => -300 - Math.min(d.connections, 10) * 20)
            .distanceMax(300),
        )
        .force("center", forceCenter(0, 0))
        .force(
          "collide",
          forceCollide().radius(
            (d: any) => 35 + Math.min(d.connections, 10) * 2,
          ),
        )
        .alphaDecay(0.015)
        .stop();

      // Run simulation synchronously
      const iterations = simulationNodes.length < 100 ? 300 : 200;
      for (let i = 0; i < iterations; i++) {
        simulation.tick();
      }
    }

    // Map titles to writers for image inheritance
    const titleToWriter = new Map<number, number>();
    if (visibleLinks) {
      visibleLinks.forEach((l: any) => {
        const source = items.find((i: any) => i.itemId === l.sourceItemId);
        const dest = items.find((i: any) => i.itemId === l.destinationItemId);

        if (source?.type === "Title" && dest?.type === "Writer") {
          titleToWriter.set(source.itemId, dest.itemId);
        }
        if (dest?.type === "Title" && source?.type === "Writer") {
          titleToWriter.set(dest.itemId, source.itemId);
        }
      });
    }

    const newNodes: Node[] = simulationNodes.map((node: any) => ({
      id: node.id,
      type: "custom",
      // Center the node by offsetting half its estimated size
      // Approx width: char count * 8px + 20px padding
      // Approx height: 36px
      position: {
        x: node.x - (node.word.length * 4 + 10),
        y: node.y - 30,
      },
      data: {
        id: node.itemId,
        label: node.word,
        type: node.type,
        connections: node.connections,
        definition: node.definition,
        isSelected: node.itemId === selectedNode,
        image:
          nodeImages[node.itemId] ||
          (node.type === "Title"
            ? nodeImages[titleToWriter.get(node.itemId) || 0]
            : null),
      },
    }));

    const newEdges: Edge[] = [];

    // Build a set of highlighted transitions "fromId-toId"
    const highlightedTransitions = new Set<string>();
    if (navigationHistory.length > 1) {
      for (let i = 0; i < navigationHistory.length - 1; i++) {
        const current = navigationHistory[i];
        const prev = navigationHistory[i + 1];
        // Navigation was from prev -> current
        highlightedTransitions.add(`${prev}-${current}`);
      }
    }

    visibleLinks.forEach((link: any) => {
      const sourceId = String(link.sourceItemId);
      const targetId = String(link.destinationItemId);
      const sourceNum = Number(link.sourceItemId);
      const targetNum = Number(link.destinationItemId);

      // Check if this link corresponds to a navigation step
      // We check strictly: source -> target must match a transition prev -> current
      const isHighlighted = highlightedTransitions.has(
        `${sourceNum}-${targetNum}`,
      );

      const edgeStyle = isHighlighted
        ? { stroke: "orange", strokeWidth: 3 }
        : { stroke: "rgba(150, 150, 150, 0.3)", strokeWidth: 2 };

      const markerColor = isHighlighted ? "orange" : "rgba(150, 150, 150, 0.4)";

      if (selectedNode !== null) {
        // Radial Logic: Use suffixed IDs
        let actualSourceId = sourceId;
        let actualTargetId = targetId;

        if (Number(targetId) === selectedNode) {
          // Incoming: Source-in -> Center
          actualSourceId = `${sourceId}-in`;
        } else if (Number(sourceId) === selectedNode) {
          // Outgoing: Center -> Target-out
          actualTargetId = `${targetId}-out`;
        }

        if (nodeIds.has(actualSourceId) && nodeIds.has(actualTargetId)) {
          newEdges.push({
            id: `${actualSourceId}-${actualTargetId}`,
            source: actualSourceId,
            target: actualTargetId,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 5,
              height: 5,
              color: markerColor,
            },
            style: edgeStyle,
          });
        }
      } else {
        // Standard Logic
        if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
          newEdges.push({
            id: `${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 5,
              height: 5,
              color: markerColor,
            },
            style: edgeStyle,
          });
        }
      }
    });

    LogInfo(
      `[Graph] Setting ${newNodes.length} nodes and ${newEdges.length} edges`,
    );
    setNodes(newNodes);
    setEdges(newEdges);

    // Identify needed images
    const neededImageIds = new Set<number>();
    simulationNodes.forEach((node: any) => {
      if (node.type === "Writer") {
        neededImageIds.add(node.itemId);
      } else if (node.type === "Title") {
        const writerId = titleToWriter.get(node.itemId);
        if (writerId) neededImageIds.add(writerId);
      }
    });

    // Fetch missing images
    const missingIds = Array.from(neededImageIds).filter(
      (id) => nodeImages[id] === undefined,
    );

    if (missingIds.length > 0) {
      // Fetch asynchronously
      Promise.all(
        missingIds.map((id) => GetItemImage(id).then((img) => ({ id, img }))),
      ).then((results) => {
        setNodeImages((prev) => {
          const next = { ...prev };
          results.forEach(({ id, img }) => {
            next[id] = img || null; // Store null if no image to avoid refetching
          });
          return next;
        });
      });
    }

    // Fit view after layout update
    if (rfInstance && newNodes.length > 0) {
      // Simple fit view after a short delay to allow state updates to propagate
      setTimeout(() => {
        rfInstance.fitView({ padding: 0.2, duration: 800 });
      }, 100);
    }
  }, [
    items,
    links,
    selectedNode,
    forceRefresh,
    visibleTypes,
    minConnections,
    navigationHistory,
    setNodes,
    setEdges,
    rfInstance,
    nodeImages,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!rfInstance) return;

      const isCmdOrCtrl = event.metaKey || event.ctrlKey;

      if (isCmdOrCtrl) {
        if (event.key === "-" || event.key === "_") {
          // Cmd + - -> Zoom Out
          event.preventDefault();
          rfInstance.zoomOut();
        } else if (event.key === "+" || (event.shiftKey && event.key === "=")) {
          // Cmd + + (or Cmd + Shift + =) -> Zoom In
          event.preventDefault();
          rfInstance.zoomIn();
        } else if (event.key === "r") {
          // Cmd + r -> Fit View (Reload)
          event.preventDefault();
          rfInstance.fitView({ padding: 0.2, duration: 800 });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [rfInstance]);

  return (
    <div
      style={{
        height: "calc(100vh - 120px)", // Adjust for AppShell padding and footer
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Fixed Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          backgroundColor: colorScheme === "dark" ? "#1a1b1e" : "white",
          borderBottom: `1px solid ${colorScheme === "dark" ? "#373A40" : "#e9ecef"}`,
          padding: "1rem 2rem",
        }}
      >
        <Group justify="space-between">
          <Group gap="md">
            <Button
              variant="subtle"
              leftSection={<ArrowLeft size={18} />}
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
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
          <Group>
            <Text size="sm" c="dimmed">
              {nodes.length} nodes • {edges.length} connections
            </Text>
            <Button
              size="xs"
              variant="default"
              onClick={() => setForceRefresh((prev) => prev + 1)}
            >
              Reload
            </Button>
          </Group>
        </Group>

        {!selectedNode && (
          <Collapse in={filtersVisible}>
            <Group gap="xl" mt="md" align="flex-start">
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Item Types
                </Text>
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
                <Text size="sm" fw={500}>
                  Connection Threshold
                </Text>
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

      <div style={{ flex: 1, display: "flex", gap: 0, minHeight: 0 }}>
        {/* Graph area */}
        <div
          style={{
            flex: 1,
            position: "relative",
            borderRight: `1px solid ${colorScheme === "dark" ? "#373A40" : "#e9ecef"}`,
          }}
        >
          {!selectedNode && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 10,
                textAlign: "center",
              }}
            >
              <Text c="dimmed">Select an item to view its graph</Text>
            </div>
          )}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onInit={setRfInstance}
              nodeTypes={nodeTypes}
              fitView
              nodesDraggable={true}
              nodesConnectable={false}
              elementsSelectable={true}
              proOptions={{ hideAttribution: true }}
              minZoom={0.1}
              maxZoom={20}
            >
              <Background />
              <Controls style={{ zIndex: 1000 }} />
            </ReactFlow>
          </div>
        </div>

        {/* Connections sidebar - Fixed width */}
        <div
          style={{
            width: "200px",
            padding: "1rem",
            overflowY: "auto",
            backgroundColor: colorScheme === "dark" ? "#25262b" : "#f8f9fa",
          }}
        >
          {selectedNode ? (
            <Stack gap="md">
              {/* Outgoing Section */}
              <div>
                <Group
                  gap="xs"
                  mb="xs"
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onClick={toggleOutgoingCollapsed}
                >
                  {outgoingCollapsed ? (
                    <ChevronRight size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  <Text size="sm" fw={500}>
                    Outgoing (
                    {selectedItemLinks?.filter(
                      (l: any) => l.sourceItemId === selectedNode,
                    ).length || 0}
                    )
                  </Text>
                </Group>
                {!outgoingCollapsed && (
                  <Stack gap="xs">
                    {selectedItemLinks &&
                    selectedItemLinks.filter(
                      (l: any) => l.sourceItemId === selectedNode,
                    ).length > 0 ? (
                      selectedItemLinks
                        .filter(
                          (link: any) => link.sourceItemId === selectedNode,
                        )
                        .map((link: any) => {
                          const linkedItemId = link.destinationItemId;
                          const linkedItemQuery = linkedItemsQueries.find(
                            (q: any) => q.data?.itemId === linkedItemId,
                          );
                          const linkedItem = linkedItemQuery?.data;

                          return (
                            <Paper
                              key={link.linkId}
                              p="xs"
                              withBorder
                              style={{
                                backgroundColor: linkedItem?.type
                                  ? getItemColor(linkedItem.type)
                                  : undefined,
                              }}
                            >
                              {linkedItem ? (
                                <Group gap="xs" align="center">
                                  <Text
                                    component={Link}
                                    to={`/item/${linkedItemId}?tab=detail`}
                                    size="xs"
                                    fw={600}
                                    c="dark"
                                    style={{
                                      textDecoration: "none",
                                      lineHeight: 1.2,
                                      flex: 1,
                                    }}
                                    onClick={(e: React.MouseEvent) => {
                                      if (e.metaKey || e.ctrlKey) {
                                        e.preventDefault();
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
                                    onClick={() =>
                                      setSelectedNode(linkedItemId)
                                    }
                                  >
                                    <Network size={12} />
                                  </ActionIcon>
                                </Group>
                              ) : (
                                <Text size="xs" c="dark">
                                  Loading...
                                </Text>
                              )}
                            </Paper>
                          );
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
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onClick={toggleIncomingCollapsed}
                >
                  {incomingCollapsed ? (
                    <ChevronRight size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  <Text size="sm" fw={500}>
                    Incoming (
                    {selectedItemLinks?.filter(
                      (l: any) => l.destinationItemId === selectedNode,
                    ).length || 0}
                    )
                  </Text>
                </Group>
                {!incomingCollapsed && (
                  <Stack gap="xs">
                    {selectedItemLinks &&
                    selectedItemLinks.filter(
                      (l: any) => l.destinationItemId === selectedNode,
                    ).length > 0 ? (
                      selectedItemLinks
                        .filter(
                          (link: any) =>
                            link.destinationItemId === selectedNode,
                        )
                        .map((link: any) => {
                          const linkedItemId = link.sourceItemId;
                          const linkedItemQuery = linkedItemsQueries.find(
                            (q: any) => q.data?.itemId === linkedItemId,
                          );
                          const linkedItem = linkedItemQuery?.data;

                          return (
                            <Paper
                              key={link.linkId}
                              p="xs"
                              withBorder
                              style={{
                                backgroundColor: linkedItem?.type
                                  ? getItemColor(linkedItem.type)
                                  : undefined,
                              }}
                            >
                              {linkedItem ? (
                                <Group gap="xs" align="center">
                                  <Text
                                    component={Link}
                                    to={`/item/${linkedItemId}?tab=detail`}
                                    size="xs"
                                    fw={600}
                                    c="dark"
                                    style={{
                                      textDecoration: "none",
                                      lineHeight: 1.2,
                                      flex: 1,
                                    }}
                                    onClick={(e: React.MouseEvent) => {
                                      if (e.metaKey || e.ctrlKey) {
                                        e.preventDefault();
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
                                    onClick={() =>
                                      setSelectedNode(linkedItemId)
                                    }
                                  >
                                    <Network size={12} />
                                  </ActionIcon>
                                </Group>
                              ) : (
                                <Text size="xs" c="dark">
                                  Loading...
                                </Text>
                              )}
                            </Paper>
                          );
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
  );
}
