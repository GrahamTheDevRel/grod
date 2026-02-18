import React, { useState, useCallback, useRef } from "react"
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  applyEdgeChanges,
  applyNodeChanges,
  ReactFlowProvider,
} from "react-flow-renderer"
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Paper,
  TextField,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from "@mui/material"
import {
  SmartToy as AgentIcon,
  SettingsSuggest as LogicIcon,
  Save as SaveIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
} from "@mui/icons-material"

const initialNodes = [
  {
    id: "1",
    type: "input",
    data: { label: "Start" },
    position: { x: 250, y: 5 },
  },
]

const initialEdges = []

const toolboxItems = [
  {
    type: "agent",
    label: "Summarizer",
    icon: <AgentIcon />,
    config: {
      model: "gpt-3.5-turbo",
      prompt: "Summarize the following text...",
    },
  },
  {
    type: "agent",
    label: "Coder",
    icon: <AgentIcon />,
    config: { model: "gpt-4", prompt: "Write code for..." },
  },
  {
    type: "logic",
    label: "If/Else",
    icon: <LogicIcon />,
    config: { condition: "true" },
  },
  {
    type: "logic",
    label: "Map",
    icon: <LogicIcon />,
    config: { iterator: "items" },
  },
]

const DesignerContent = ({ onBack }) => {
  const reactFlowWrapper = useRef(null)
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)
  const [reactFlowInstance, setReactFlowInstance] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [validationErrors, setValidationErrors] = useState([])

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  )
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  )
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [],
  )

  const onInit = (instance) => setReactFlowInstance(instance)

  const onNodeClick = (_, node) => {
    setSelectedNode(node)
  }

  const onPaneClick = () => {
    setSelectedNode(null)
  }

  const onDoubleClick = (event) => {
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    })

    const newNode = {
      id: `${Date.now()}`,
      type: "default",
      position,
      data: {
        label: "New Agent",
        type: "agent",
        config: { model: "gpt-3.5-turbo", prompt: "" },
      },
    }

    setNodes((nds) => nds.concat(newNode))
  }

  const updateNodeData = (key, value) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          if (key === "label") {
            return { ...node, data: { ...node.data, label: value } }
          }
          return {
            ...node,
            data: {
              ...node.data,
              config: { ...node.data.config, [key]: value },
            },
          }
        }
        return node
      }),
    )

    setSelectedNode((prev) => {
      if (key === "label") {
        return { ...prev, data: { ...prev.data, label: value } }
      }
      return {
        ...prev,
        data: {
          ...prev.data,
          config: { ...prev.data.config, [key]: value },
        },
      }
    })
  }

  const onDragStart = (event, item) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(item))
    event.dataTransfer.effectAllowed = "move"
  }

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const dataStr = event.dataTransfer.getData("application/reactflow")

      if (!dataStr) return

      const item = JSON.parse(dataStr)

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      })

      const newNode = {
        id: `${Date.now()}`,
        type: item.type === "logic" ? "default" : "default", // Can specialize types later
        position,
        data: {
          label: item.label,
          type: item.type,
          config: { ...item.config },
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance],
  )

  const validateWorkflow = () => {
    const errors = []
    nodes.forEach((node) => {
      const hasInbound = edges.some((e) => e.target === node.id)
      const hasOutbound = edges.some((e) => e.source === node.id)

      if (node.type !== "input" && !hasInbound) {
        errors.push(
          `Node "${node.data.label}" (${node.id}) has no inbound connections.`,
        )
      }
    })
    setValidationErrors(errors)
    return errors.length === 0
  }

  const exportWorkflow = () => {
    if (!validateWorkflow()) {
      alert("Workflow has validation errors. See the panel.")
    }
    const workflow = {
      nodes,
      edges,
    }
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(workflow, null, 2))
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", "workflow.json")
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", flexDirection: "column" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <IconButton
            edge="start"
            color="inherit"
            onClick={onBack}
            sx={{ mr: 2 }}
          >
            <DashboardIcon />
          </IconButton>
          <Typography
            variant="h6"
            color="inherit"
            component="div"
            sx={{ flexGrow: 1 }}
          >
            Visual Designer
          </Typography>
          <Button
            variant="outlined"
            color="secondary"
            onClick={validateWorkflow}
            sx={{ mr: 2 }}
          >
            Validate
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={exportWorkflow}
          >
            Export JSON
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
        <Drawer
          variant="permanent"
          sx={{
            width: 240,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: 240,
              boxSizing: "border-box",
              position: "relative",
            },
          }}
        >
          <Box sx={{ overflow: "auto", p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Toolbox
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: 2 }}
            >
              Drag to canvas or double-click canvas for new agent
            </Typography>
            <List dense>
              {toolboxItems.map((item) => (
                <ListItem
                  button
                  key={item.label}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                  sx={{
                    mb: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    cursor: "grab",
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} secondary={item.type} />
                </ListItem>
              ))}
            </List>

            {validationErrors.length > 0 && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Validation Errors
                </Typography>
                {validationErrors.map((err, i) => (
                  <Alert severity="error" key={i} sx={{ mb: 1, py: 0 }}>
                    {err}
                  </Alert>
                ))}
              </Box>
            )}
          </Box>
        </Drawer>

        <Box
          ref={reactFlowWrapper}
          sx={{ flexGrow: 1, position: "relative" }}
          onDoubleClick={onDoubleClick}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </Box>

        {selectedNode && (
          <Paper
            elevation={3}
            sx={{
              width: 350,
              p: 2,
              borderLeft: "1px solid",
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >
            <Typography variant="h6" gutterBottom>
              Node Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <TextField
              label="Name"
              fullWidth
              variant="outlined"
              size="small"
              value={selectedNode.data.label}
              onChange={(e) => updateNodeData("label", e.target.value)}
              sx={{ mb: 3 }}
            />

            {selectedNode.data.type === "agent" && (
              <>
                <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                  <InputLabel>Model</InputLabel>
                  <Select
                    value={selectedNode.data.config?.model || "gpt-3.5-turbo"}
                    label="Model"
                    onChange={(e) => updateNodeData("model", e.target.value)}
                  >
                    <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo</MenuItem>
                    <MenuItem value="gpt-4">GPT-4</MenuItem>
                    <MenuItem value="claude-3-opus">Claude 3 Opus</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="System Prompt"
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  size="small"
                  value={selectedNode.data.config?.prompt || ""}
                  onChange={(e) => updateNodeData("prompt", e.target.value)}
                  sx={{ mb: 3 }}
                />
              </>
            )}

            {selectedNode.data.type === "logic" && (
              <>
                <TextField
                  label="Condition / Iterator"
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={
                    selectedNode.data.config?.condition ||
                    selectedNode.data.config?.iterator ||
                    ""
                  }
                  onChange={(e) =>
                    updateNodeData(
                      selectedNode.data.label === "Map"
                        ? "iterator"
                        : "condition",
                      e.target.value,
                    )
                  }
                  sx={{ mb: 3 }}
                />
              </>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary">
              ID: {selectedNode.id}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Type: {selectedNode.data.type || "unknown"}
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  )
}

const Designer = (props) => (
  <ReactFlowProvider>
    <DesignerContent {...props} />
  </ReactFlowProvider>
)

export default Designer
