// Security utilities
const SecurityUtils = {
    // Sanitize HTML to prevent XSS
    sanitizeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    // Escape HTML special characters
    escapeHTML(str) {
        if (!str) return '';
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        };
        return String(str).replace(/[&<>"'\/]/g, char => escapeMap[char]);
    },
    
    // Validate and sanitize input length
    validateLength(str, maxLength = 1000) {
        if (!str) return '';
        return String(str).substring(0, maxLength);
    },
    
    // Validate node data structure
    validateNodeData(data) {
        if (!data || typeof data !== 'object') return false;
        
        // Required fields
        if (!data.text || typeof data.text !== 'string') return false;
        if (typeof data.x !== 'number' || typeof data.y !== 'number') return false;
        
        // Validate text length
        data.text = this.validateLength(data.text, 500);
        
        // Sanitize optional fields
        if (data.notes) data.notes = this.validateLength(data.notes, 2000);
        if (data.id) data.id = this.escapeHTML(data.id);
        if (data.shape) data.shape = this.escapeHTML(data.shape);
        if (data.color) data.color = this.escapeHTML(data.color);
        if (data.icon) data.icon = this.escapeHTML(data.icon);
        
        // Validate metadata
        if (data.metadata && typeof data.metadata === 'object') {
            const sanitizedMetadata = {};
            for (const [key, value] of Object.entries(data.metadata)) {
                if (typeof key === 'string' && typeof value === 'string') {
                    sanitizedMetadata[this.escapeHTML(key)] = this.escapeHTML(value);
                }
            }
            data.metadata = sanitizedMetadata;
        }
        
        return true;
    },
    
    // Strip HTML tags but preserve text
    stripHTML(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }
};

// Enhanced Node class with more features
class Node {
    constructor(x, y, text = 'New Node', options = {}) {
        this.id = options.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.x = x;
        this.y = y;
        this.text = text;
        this.width = options.width || 150;
        this.height = options.height || 60;
        this.shape = options.shape || 'rounded';
        this.color = options.color || '#6366f1';
        this.textColor = options.textColor || '#ffffff';
        this.borderStyle = options.borderStyle || 'solid';
        this.borderColor = options.borderColor || 'rgba(0, 0, 0, 0.1)';
        this.borderWidth = options.borderWidth || 2;
        this.fontSize = options.fontSize || 14;
        this.fontWeight = options.fontWeight || '500';
        this.icon = options.icon || null;
        this.children = [];
        this.parent = null;
        this.collapsed = false;
        this.selected = false;
        this.zIndex = options.zIndex || 0;
        this.metadata = options.metadata || {};
        this.links = [];
        this.notes = options.notes || '';
        this.tags = options.tags || [];
        this.attachments = [];
    }

    addChild(childNode) {
        childNode.parent = this;
        this.children.push(childNode);
    }

    removeChild(childNode) {
        const index = this.children.indexOf(childNode);
        if (index > -1) {
            this.children.splice(index, 1);
            childNode.parent = null;
        }
    }

    getAllDescendants() {
        let descendants = [];
        this.children.forEach(child => {
            descendants.push(child);
            descendants = descendants.concat(child.getAllDescendants());
        });
        return descendants;
    }

    getBounds() {
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y - this.height / 2,
            bottom: this.y + this.height / 2
        };
    }

    containsPoint(x, y) {
        const bounds = this.getBounds();
        return x >= bounds.left && x <= bounds.right &&
               y >= bounds.top && y <= bounds.bottom;
    }

    clone() {
        const cloned = new Node(this.x + 20, this.y + 20, this.text, {
            shape: this.shape,
            color: this.color,
            textColor: this.textColor,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            icon: this.icon
        });
        return cloned;
    }

    toJSON() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            text: this.text,
            shape: this.shape,
            color: this.color,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            icon: this.icon,
            children: this.children.map(child => child.toJSON()),
            collapsed: this.collapsed,
            metadata: this.metadata
        };
    }
}

// History Manager for Undo/Redo
class HistoryManager {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistory = 50;
    }

    push(state) {
        // Remove any states after current index
        this.history = this.history.slice(0, this.currentIndex + 1);
        
        // Add new state
        this.history.push(JSON.parse(JSON.stringify(state)));
        
        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }
    }

    undo() {
        if (this.canUndo()) {
            this.currentIndex--;
            return this.history[this.currentIndex];
        }
        return null;
    }

    redo() {
        if (this.canRedo()) {
            this.currentIndex++;
            return this.history[this.currentIndex];
        }
        return null;
    }

    canUndo() {
        return this.currentIndex > 0;
    }

    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
}

// Layout Algorithms
class LayoutEngine {
    static applyTreeLayout(rootNode, horizontal = true) {
        const spacing = horizontal ? 200 : 150;
        const levelSpacing = horizontal ? 150 : 200;
        
        function layoutSubtree(node, x, y, level) {
            node.x = x;
            node.y = y;
            
            if (node.children.length === 0) return { width: spacing, height: levelSpacing };
            
            let totalWidth = 0;
            let maxHeight = levelSpacing;
            
            node.children.forEach((child, index) => {
                const childX = horizontal ? x + levelSpacing : x - (node.children.length - 1) * spacing / 2 + index * spacing;
                const childY = horizontal ? y - (node.children.length - 1) * spacing / 2 + index * spacing : y + levelSpacing;
                
                const subtreeSize = layoutSubtree(child, childX, childY, level + 1);
                totalWidth += subtreeSize.width;
                maxHeight = Math.max(maxHeight, levelSpacing + subtreeSize.height);
            });
            
            return { width: Math.max(spacing, totalWidth), height: maxHeight };
        }
        
        layoutSubtree(rootNode, rootNode.x, rootNode.y, 0);
    }

    static applyRadialLayout(centerNode) {
        const layers = [];
        const visited = new Set();
        
        // Build layers
        function buildLayers(node, layer) {
            if (visited.has(node)) return;
            visited.add(node);
            
            if (!layers[layer]) layers[layer] = [];
            layers[layer].push(node);
            
            node.children.forEach(child => buildLayers(child, layer + 1));
        }
        
        buildLayers(centerNode, 0);
        
        // Position nodes
        layers.forEach((layer, layerIndex) => {
            if (layerIndex === 0) return; // Center node stays in place
            
            const radius = layerIndex * 150;
            const angleStep = (2 * Math.PI) / layer.length;
            
            layer.forEach((node, nodeIndex) => {
                const angle = nodeIndex * angleStep;
                node.x = centerNode.x + Math.cos(angle) * radius;
                node.y = centerNode.y + Math.sin(angle) * radius;
            });
        });
    }

    static applyForceDirectedLayout(nodes, iterations = 50) {
        const repulsion = 5000;
        const attraction = 0.01;
        const damping = 0.9;
        
        for (let i = 0; i < iterations; i++) {
            // Calculate forces
            nodes.forEach(node => {
                node.fx = 0;
                node.fy = 0;
                
                // Repulsion between all nodes
                nodes.forEach(other => {
                    if (node === other) return;
                    
                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    
                    const force = repulsion / (distance * distance);
                    node.fx += (dx / distance) * force;
                    node.fy += (dy / distance) * force;
                });
                
                // Attraction between connected nodes
                node.children.forEach(child => {
                    const dx = child.x - node.x;
                    const dy = child.y - node.y;
                    
                    node.fx += dx * attraction;
                    node.fy += dy * attraction;
                    child.fx -= dx * attraction;
                    child.fy -= dy * attraction;
                });
            });
            
            // Apply forces
            nodes.forEach(node => {
                if (node.fx && node.fy) {
                    node.x += node.fx * damping;
                    node.y += node.fy * damping;
                }
            });
        }
    }
}

// Main MindMap Application
class MindMapApp {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        this.nodes = [];
        this.connections = [];
        this.selectedNodes = [];
        this.hoveredNode = null;
        this.draggedNode = null;
        this.currentTool = 'select';
        
        this.viewOffset = { x: 0, y: 0 };
        this.zoom = 1;
        this.gridEnabled = false;
        this.darkMode = false;
        
        this.history = new HistoryManager();
        this.clipboard = null;
        
        // Mind map title
        this.mapTitle = 'Untitled Mind Map';
        
        this.isPanning = false;
        this.isSelecting = false;
        this.isConnecting = false;
        this.connectStart = null;
        this.isDisconnecting = false;
        this.disconnectStart = null;
        
        this.mousePos = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.selectionBox = null;
        
        this.commands = this.initializeCommands();
        this.generationColors = new Map(); // Track colors by generation
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        this.setupEventListeners();
        this.setupTitleInput();
        this.createInitialNode();
        this.render();
        this.saveState();
    }
    
    setupTitleInput() {
        const titleInput = document.getElementById('mapTitle');
        if (titleInput) {
            // Use input event for real-time updates without interfering with typing
            titleInput.addEventListener('input', (e) => {
                const rawValue = e.target.value;
                // Only validate length, don't change the input value while typing
                if (rawValue.length > 100) {
                    e.target.value = rawValue.substring(0, 100);
                }
                this.mapTitle = e.target.value || 'Untitled Mind Map';
            });
            
            // Save state when user finishes editing
            titleInput.addEventListener('blur', () => {
                this.saveState();
            });
            
            // Handle special keys and prevent event bubbling
            titleInput.addEventListener('keydown', (e) => {
                // Stop event from bubbling up to global handlers
                e.stopPropagation();
                
                if (e.key === 'Enter') {
                    e.preventDefault();
                    titleInput.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    // Restore original value on escape
                    titleInput.value = this.mapTitle;
                    titleInput.blur();
                }
            });
            
            // Also prevent keyup from bubbling
            titleInput.addEventListener('keyup', (e) => {
                e.stopPropagation();
            });
        }
    }
    
    updateTitleDisplay() {
        const titleInput = document.getElementById('mapTitle');
        if (titleInput) {
            titleInput.value = this.mapTitle;
        }
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    createInitialNode() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        const rootNode = new Node(centerX, centerY, 'Main Topic', {
            shape: 'rounded',
            color: '#6366f1',
            fontSize: 18,
            fontWeight: '600',
            width: 180,
            height: 70
        });
        
        this.nodes.push(rootNode);
        
        // Initialize generation colors with root color
        this.generationColors.set(0, '#6366f1');
    }

    setupEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e));
        this.canvas.addEventListener('dblclick', e => this.handleDoubleClick(e));
        this.canvas.addEventListener('contextmenu', e => this.handleContextMenu(e));
        this.canvas.addEventListener('wheel', e => this.handleWheel(e));
        
        // Add specific right mouse button handlers
        this.canvas.addEventListener('mousedown', e => {
            if (e.button === 2) { // Right mouse button
                this.handleRightMouseDown(e);
            }
        });
        this.canvas.addEventListener('mouseup', e => {
            if (e.button === 2) { // Right mouse button
                this.handleRightMouseUp(e);
            }
        });
        
        // Keyboard events
        document.addEventListener('keydown', e => this.handleKeyDown(e));
        document.addEventListener('keyup', e => this.handleKeyUp(e));
        
        // Window events
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.render();
        });
        
        // Toolbar events
        this.setupToolbarEvents();
        
        // Sidebar events
        this.setupSidebarEvents();
        
        // Command palette
        this.setupCommandPalette();
    }

    setupToolbarEvents() {
        // Hamburger menu
        document.getElementById('btnMenu').addEventListener('click', () => {
            this.toggleSidebar();
        });
        
        // Tool selection
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTool(btn.dataset.tool);
                this.updateToolButtons();
            });
        });
        
        // Undo/Redo
        document.getElementById('btnUndo').addEventListener('click', () => this.undo());
        document.getElementById('btnRedo').addEventListener('click', () => this.redo());
        
        // Zoom controls
        document.getElementById('btnZoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('btnZoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('btnFitView').addEventListener('click', () => this.fitToScreen());
        
        // Layout
        document.getElementById('btnAutoLayout').addEventListener('click', () => this.autoLayout());
        
        // Grid
        document.getElementById('btnToggleGrid').addEventListener('click', () => {
            this.gridEnabled = !this.gridEnabled;
            this.render();
        });
        
        // Dark mode
        document.getElementById('btnDarkMode').addEventListener('click', () => {
            this.toggleDarkMode();
        });
        
        // Search
        document.getElementById('btnSearch').addEventListener('click', () => {
            this.toggleSearch();
        });
        
        // Import
        document.getElementById('btnImport').addEventListener('click', () => {
            this.showImportDialog();
        });
        
        // Export
        document.getElementById('btnExport').addEventListener('click', () => {
            this.showExportModal();
        });
        
        // Shortcuts
        document.getElementById('btnShortcuts').addEventListener('click', () => {
            this.showShortcutsModal();
        });
    }

    setupSidebarEvents() {
        // Tab switching
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const panel = tab.dataset.panel;
                
                document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(`panel${panel.charAt(0).toUpperCase() + panel.slice(1)}`).classList.add('active');
            });
        });
        
        // Node templates
        document.querySelectorAll('.node-template').forEach(template => {
            template.addEventListener('click', () => {
                const shape = template.dataset.shape;
                this.addNodeWithShape(shape);
            });
        });
        
        // Quick actions
        document.getElementById('btnAddNode').addEventListener('click', () => this.addNode());
        document.getElementById('btnAddChildNode').addEventListener('click', () => this.addChildNode());
        document.getElementById('btnAddSiblingNode').addEventListener('click', () => this.addSiblingNode());
        
        // Style controls
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const color = swatch.dataset.color;
                this.applyColor(color);
            });
        });
        
        document.getElementById('customColor').addEventListener('change', e => {
            this.applyColor(e.target.value);
        });
        
        document.getElementById('fontSize').addEventListener('input', e => {
            const value = e.target.value;
            document.getElementById('fontSizeValue').textContent = value + 'px';
            this.applyFontSize(parseInt(value));
        });
        
        document.getElementById('fontWeight').addEventListener('change', e => {
            this.applyFontWeight(e.target.value);
        });
        
        // Icon selection
        document.querySelectorAll('.icon-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const icon = btn.dataset.icon;
                this.applyIcon(icon);
            });
        });
    }

    setupCommandPalette() {
        const commandPalette = document.getElementById('commandPalette');
        const commandInput = document.getElementById('commandInput');
        const commandList = document.getElementById('commandList');
        
        // Toggle with Ctrl+K
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                this.toggleCommandPalette();
            }
        });
        
        // Filter commands
        commandInput.addEventListener('input', () => {
            const query = commandInput.value.toLowerCase();
            this.filterCommands(query);
        });
        
        // Execute command on Enter
        commandInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const selected = commandList.querySelector('.command-item.selected');
                if (selected) {
                    this.executeCommand(selected.dataset.command);
                    this.hideCommandPalette();
                }
            } else if (e.key === 'Escape') {
                this.hideCommandPalette();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateCommands(e.key === 'ArrowDown' ? 1 : -1);
            }
        });
    }

    initializeCommands() {
        return [
            { id: 'addNode', title: 'Add Node', description: 'Create a new node', shortcut: 'N', action: () => this.addNode() },
            { id: 'deleteNode', title: 'Delete Node', description: 'Remove selected nodes', shortcut: 'Del', action: () => this.deleteSelectedNodes() },
            { id: 'selectAll', title: 'Select All', description: 'Select all nodes', shortcut: 'Ctrl+A', action: () => this.selectAll() },
            { id: 'copy', title: 'Copy', description: 'Copy selected nodes', shortcut: 'Ctrl+C', action: () => this.copy() },
            { id: 'paste', title: 'Paste', description: 'Paste copied nodes', shortcut: 'Ctrl+V', action: () => this.paste() },
            { id: 'duplicate', title: 'Duplicate', description: 'Duplicate selected nodes', shortcut: 'Ctrl+D', action: () => this.duplicate() },
            { id: 'undo', title: 'Undo', description: 'Undo last action', shortcut: 'Ctrl+Z', action: () => this.undo() },
            { id: 'redo', title: 'Redo', description: 'Redo last action', shortcut: 'Ctrl+Y', action: () => this.redo() },
            { id: 'zoomIn', title: 'Zoom In', description: 'Increase zoom level', shortcut: 'Ctrl++', action: () => this.zoomIn() },
            { id: 'zoomOut', title: 'Zoom Out', description: 'Decrease zoom level', shortcut: 'Ctrl+-', action: () => this.zoomOut() },
            { id: 'fitView', title: 'Fit to Screen', description: 'Fit all nodes in view', shortcut: 'Ctrl+0', action: () => this.fitToScreen() },
            { id: 'autoLayout', title: 'Auto Layout', description: 'Arrange nodes automatically', shortcut: 'Ctrl+L', action: () => this.autoLayout() },
            { id: 'search', title: 'Search', description: 'Find nodes by text', shortcut: 'Ctrl+F', action: () => this.toggleSearch() },
            { id: 'import', title: 'Import', description: 'Import mind map from JSON', shortcut: 'Ctrl+I', action: () => this.showImportDialog() },
            { id: 'export', title: 'Export', description: 'Export mind map', shortcut: 'Ctrl+E', action: () => this.showExportModal() },
            { id: 'shortcuts', title: 'Show Shortcuts', description: 'View all keyboard shortcuts', shortcut: '?', action: () => this.showShortcutsModal() },
            { id: 'darkMode', title: 'Toggle Dark Mode', description: 'Switch theme', shortcut: 'Ctrl+Shift+D', action: () => this.toggleDarkMode() }
        ];
    }

    // Tool management
    setTool(tool) {
        this.currentTool = tool;
        this.canvas.style.cursor = tool === 'pan' ? 'grab' : 'default';
    }

    updateToolButtons() {
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tool === this.currentTool) {
                btn.classList.add('active');
            }
        });
    }


    // Mouse event handlers
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.viewOffset.x) / this.zoom;
        const y = (e.clientY - rect.top - this.viewOffset.y) / this.zoom;
        
        this.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        
        if (this.currentTool === 'select') {
            const clickedNode = this.getNodeAt(x, y);
            
            if (clickedNode) {
                if (!e.ctrlKey && !this.selectedNodes.includes(clickedNode)) {
                    this.clearSelection();
                }
                this.selectNode(clickedNode, e.ctrlKey);
                
                this.draggedNode = clickedNode;
                this.dragOffset = {
                    x: x - clickedNode.x,
                    y: y - clickedNode.y
                };
            } else {
                if (!e.ctrlKey) {
                    this.clearSelection();
                }
                this.isSelecting = true;
                this.selectionBox = {
                    start: { x, y },
                    end: { x, y }
                };
            }
        } else if (this.currentTool === 'pan') {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
        } else if (this.currentTool === 'connect') {
            const clickedNode = this.getNodeAt(x, y);
            if (clickedNode) {
                this.isConnecting = true;
                this.connectStart = clickedNode;
            }
        } else if (this.currentTool === 'disconnect') {
            const clickedNode = this.getNodeAt(x, y);
            if (clickedNode) {
                this.isDisconnecting = true;
                this.disconnectStart = clickedNode;
            }
        } else if (this.currentTool === 'text') {
            this.addNodeAt(x, y);
        }
        
        this.render();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.viewOffset.x) / this.zoom;
        const y = (e.clientY - rect.top - this.viewOffset.y) / this.zoom;
        
        const currentMousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        
        // Update hovered node
        this.hoveredNode = this.getNodeAt(x, y);
        
        if (this.draggedNode && this.currentTool === 'select') {
            // Drag nodes
            const dx = x - this.dragOffset.x - this.draggedNode.x;
            const dy = y - this.dragOffset.y - this.draggedNode.y;
            
            this.selectedNodes.forEach(node => {
                node.x += dx;
                node.y += dy;
            });
            
            this.dragOffset.x = x - this.draggedNode.x;
            this.dragOffset.y = y - this.draggedNode.y;
        } else if (this.isPanning) {
            // Pan view
            const panStart = this.panStart || this.mousePos;
            this.viewOffset.x += currentMousePos.x - panStart.x;
            this.viewOffset.y += currentMousePos.y - panStart.y;
            this.panStart = currentMousePos;
        } else if (this.isSelecting && this.selectionBox) {
            // Update selection box
            this.selectionBox.end = { x, y };
            this.selectNodesInBox();
        } else if (this.isConnecting) {
            // Update connection preview
            this.mousePos = { x, y };
        } else if (this.isDisconnecting) {
            // Update disconnect preview
            this.mousePos = { x, y };
        }
        
        this.render();
    }

    handleMouseUp(e) {
        if (this.draggedNode) {
            this.saveState();
        }
        
        if (this.isConnecting && this.connectStart) {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.viewOffset.x) / this.zoom;
            const y = (e.clientY - rect.top - this.viewOffset.y) / this.zoom;
            
            const targetNode = this.getNodeAt(x, y);
            if (targetNode && targetNode !== this.connectStart) {
                this.connectNodes(this.connectStart, targetNode);
                this.saveState();
            }
        }
        
        if (this.isDisconnecting && this.disconnectStart) {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.viewOffset.x) / this.zoom;
            const y = (e.clientY - rect.top - this.viewOffset.y) / this.zoom;
            
            const targetNode = this.getNodeAt(x, y);
            if (targetNode && targetNode !== this.disconnectStart) {
                this.disconnectNodes(this.disconnectStart, targetNode);
                this.saveState();
            }
        }
        
        this.draggedNode = null;
        this.isPanning = false;
        this.isSelecting = false;
        this.isConnecting = false;
        this.connectStart = null;
        this.isDisconnecting = false;
        this.disconnectStart = null;
        this.selectionBox = null;
        
        if (this.currentTool === 'pan') {
            this.canvas.style.cursor = 'grab';
        }
        
        this.render();
    }

    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.viewOffset.x) / this.zoom;
        const y = (e.clientY - rect.top - this.viewOffset.y) / this.zoom;
        
        const clickedNode = this.getNodeAt(x, y);
        if (clickedNode) {
            this.editNodeText(clickedNode);
        } else {
            this.addNodeAt(x, y);
        }
    }

    handleRightMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.viewOffset.x) / this.zoom;
        const y = (e.clientY - rect.top - this.viewOffset.y) / this.zoom;
        
        const clickedNode = this.getNodeAt(x, y);
        if (!clickedNode) {
            // Right-clicked on empty space - enable panning
            this.isPanning = true;
            this.panStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    handleRightMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'grab';
            e.preventDefault();
        }
    }

    handleContextMenu(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.viewOffset.x) / this.zoom;
        const y = (e.clientY - rect.top - this.viewOffset.y) / this.zoom;
        
        const clickedNode = this.getNodeAt(x, y);
        if (clickedNode) {
            // Right-clicked on a node - show context menu
            if (!this.selectedNodes.includes(clickedNode)) {
                this.clearSelection();
                this.selectNode(clickedNode);
            }
            this.showContextMenu(e.clientX, e.clientY);
        }
        // If clicked on empty space, context menu is prevented and panning is handled in handleRightMouseDown
    }

    handleWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Zoom towards mouse position
        const worldX = (mouseX - this.viewOffset.x) / this.zoom;
        const worldY = (mouseY - this.viewOffset.y) / this.zoom;
        
        this.zoom *= delta;
        this.zoom = Math.max(0.1, Math.min(3, this.zoom));
        
        this.viewOffset.x = mouseX - worldX * this.zoom;
        this.viewOffset.y = mouseY - worldY * this.zoom;
        
        this.updateZoomIndicator();
        this.render();
    }

    handleKeyDown(e) {
        // Don't handle shortcuts if specific input fields are focused (not canvas)
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.id === 'mapTitle' || 
            activeElement.id === 'searchInput' || 
            activeElement.id === 'commandInput' ||
            activeElement.id === 'propText' ||
            activeElement.id === 'propNotes' ||
            (activeElement.tagName === 'INPUT' && activeElement.type === 'text') ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        )) {
            return;
        }
        
        // Keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'z':
                    e.preventDefault();
                    this.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 'c':
                    e.preventDefault();
                    this.copy();
                    break;
                case 'v':
                    e.preventDefault();
                    this.paste();
                    break;
                case 'x':
                    e.preventDefault();
                    this.cut();
                    break;
                case 'a':
                    e.preventDefault();
                    this.selectAll();
                    break;
                case 'd':
                    e.preventDefault();
                    this.duplicate();
                    break;
                case 'f':
                    e.preventDefault();
                    this.toggleSearch();
                    break;
                case 'l':
                    e.preventDefault();
                    this.autoLayout();
                    break;
                case 'i':
                    e.preventDefault();
                    this.showImportDialog();
                    break;
            }
        } else {
            switch(e.key) {
                case 'Delete':
                case 'Backspace':
                    e.preventDefault();
                    this.deleteSelectedNodes();
                    break;
                case 'F2':
                    e.preventDefault();
                    if (this.selectedNodes.length === 1) {
                        this.editNodeText(this.selectedNodes[0]);
                    }
                    break;
                case 'Escape':
                    this.clearSelection();
                    this.render();
                    break;
                case '?':
                    e.preventDefault();
                    this.showShortcutsModal();
                    break;
                case 'v':
                case 'V':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.setTool('select');
                        this.updateToolButtons();
                    }
                    break;
                case 'h':
                case 'H':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.setTool('pan');
                        this.updateToolButtons();
                    }
                    break;
                case 't':
                case 'T':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.setTool('text');
                        this.updateToolButtons();
                    }
                    break;
                case 'c':
                case 'C':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.setTool('connect');
                        this.updateToolButtons();
                    }
                    break;
                case 'd':
                case 'D':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.setTool('disconnect');
                        this.updateToolButtons();
                    }
                    break;
            }
        }
    }

    handleKeyUp(e) {
        // Additional key handling if needed
    }

    // Node operations
    getNodeAt(x, y) {
        // Check nodes in reverse order (top to bottom)
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            if (this.nodes[i].containsPoint(x, y)) {
                return this.nodes[i];
            }
        }
        return null;
    }

    selectNode(node, multi = false) {
        if (!multi) {
            this.clearSelection();
        }
        
        if (!this.selectedNodes.includes(node)) {
            this.selectedNodes.push(node);
            node.selected = true;
        }
        
        this.updatePropertiesPanel();
    }

    clearSelection() {
        this.selectedNodes.forEach(node => node.selected = false);
        this.selectedNodes = [];
        this.updatePropertiesPanel();
    }

    selectAll() {
        this.clearSelection();
        this.nodes.forEach(node => {
            this.selectedNodes.push(node);
            node.selected = true;
        });
        this.render();
    }

    selectNodesInBox() {
        if (!this.selectionBox) return;
        
        const box = {
            left: Math.min(this.selectionBox.start.x, this.selectionBox.end.x),
            right: Math.max(this.selectionBox.start.x, this.selectionBox.end.x),
            top: Math.min(this.selectionBox.start.y, this.selectionBox.end.y),
            bottom: Math.max(this.selectionBox.start.y, this.selectionBox.end.y)
        };
        
        this.clearSelection();
        
        this.nodes.forEach(node => {
            const bounds = node.getBounds();
            if (bounds.left >= box.left && bounds.right <= box.right &&
                bounds.top >= box.top && bounds.bottom <= box.bottom) {
                this.selectNode(node, true);
            }
        });
    }

    addNode() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const worldX = (centerX - this.viewOffset.x) / this.zoom;
        const worldY = (centerY - this.viewOffset.y) / this.zoom;
        
        this.addNodeAt(worldX, worldY);
    }

    addNodeAt(x, y) {
        const node = new Node(x, y, 'New Node');
        this.nodes.push(node);
        
        this.clearSelection();
        this.selectNode(node);
        
        this.saveState();
        this.render();
        this.updateStats();
        
        setTimeout(() => this.editNodeText(node), 100);
    }

    addNodeWithShape(shape) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const worldX = (centerX - this.viewOffset.x) / this.zoom;
        const worldY = (centerY - this.viewOffset.y) / this.zoom;
        
        const node = new Node(worldX, worldY, 'New Node', { shape });
        this.nodes.push(node);
        
        this.clearSelection();
        this.selectNode(node);
        
        this.saveState();
        this.render();
        this.updateStats();
    }

    addChildNode() {
        if (this.selectedNodes.length !== 1) return;
        
        const parent = this.selectedNodes[0];
        const angle = Math.random() * Math.PI * 2;
        const distance = 150;
        
        const child = new Node(
            parent.x + Math.cos(angle) * distance,
            parent.y + Math.sin(angle) * distance,
            'Child Node',
            { color: this.generateChildColor(parent) }
        );
        
        parent.addChild(child);
        this.nodes.push(child);
        
        this.clearSelection();
        this.selectNode(child);
        
        this.saveState();
        this.render();
        this.updateStats();
    }

    addSiblingNode() {
        if (this.selectedNodes.length !== 1) return;
        
        const node = this.selectedNodes[0];
        if (!node.parent) return;
        
        const sibling = new Node(
            node.x + 150,
            node.y,
            'Sibling Node',
            { color: node.color }
        );
        
        node.parent.addChild(sibling);
        this.nodes.push(sibling);
        
        this.clearSelection();
        this.selectNode(sibling);
        
        this.saveState();
        this.render();
        this.updateStats();
    }

    deleteSelectedNodes() {
        if (this.selectedNodes.length === 0) return;
        
        this.selectedNodes.forEach(node => {
            // Remove from parent
            if (node.parent) {
                node.parent.removeChild(node);
            }
            
            // Remove all descendants
            const descendants = node.getAllDescendants();
            descendants.forEach(desc => {
                const index = this.nodes.indexOf(desc);
                if (index > -1) {
                    this.nodes.splice(index, 1);
                }
            });
            
            // Remove node itself
            const index = this.nodes.indexOf(node);
            if (index > -1) {
                this.nodes.splice(index, 1);
            }
        });
        
        this.clearSelection();
        this.saveState();
        this.render();
        this.updateStats();
    }

    connectNodes(from, to) {
        from.addChild(to);
        this.updateStats();
    }

    disconnectNodes(from, to) {
        // Check if 'from' is parent of 'to'
        if (from.children.includes(to)) {
            from.removeChild(to);
            this.updateStats();
            return;
        }
        
        // Check if 'to' is parent of 'from' 
        if (to.children.includes(from)) {
            to.removeChild(from);
            this.updateStats();
            return;
        }
        
        // If no direct connection found, do nothing
        console.log('No direct connection found between these nodes');
    }

    editNodeText(node) {
        const editor = document.getElementById('textEditor');
        const editorContent = document.getElementById('editorContent');
        
        const screenPos = this.worldToScreen(node.x, node.y);
        
        editor.style.left = (screenPos.x - 150) + 'px';
        editor.style.top = (screenPos.y - 30) + 'px';
        editor.style.display = 'block';
        
        // Use textContent instead of innerHTML to prevent XSS
        editorContent.textContent = SecurityUtils.stripHTML(node.text);
        editorContent.focus();
        
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(editorContent);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Save on button click
        document.getElementById('btnSaveText').onclick = () => {
            // Save as plain text to prevent XSS
            node.text = SecurityUtils.validateLength(editorContent.textContent, 500);
            editor.style.display = 'none';
            this.saveState();
            this.render();
        };
        
        document.getElementById('btnCancelText').onclick = () => {
            editor.style.display = 'none';
        };
    }

    // Clipboard operations
    copy() {
        if (this.selectedNodes.length === 0) return;
        
        this.clipboard = this.selectedNodes.map(node => node.clone());
    }

    cut() {
        this.copy();
        this.deleteSelectedNodes();
    }

    paste() {
        if (!this.clipboard || this.clipboard.length === 0) return;
        
        this.clearSelection();
        
        const offset = 20;
        this.clipboard.forEach(nodeData => {
            const node = new Node(
                nodeData.x + offset,
                nodeData.y + offset,
                nodeData.text,
                nodeData
            );
            
            this.nodes.push(node);
            this.selectNode(node, true);
        });
        
        this.saveState();
        this.render();
        this.updateStats();
    }

    duplicate() {
        if (this.selectedNodes.length === 0) return;
        
        const duplicated = [];
        this.selectedNodes.forEach(node => {
            const clone = node.clone();
            this.nodes.push(clone);
            duplicated.push(clone);
        });
        
        this.clearSelection();
        duplicated.forEach(node => this.selectNode(node, true));
        
        this.saveState();
        this.render();
        this.updateStats();
    }

    // History operations
    saveState() {
        const state = {
            nodes: this.nodes.map(node => node.toJSON()),
            viewOffset: { ...this.viewOffset },
            zoom: this.zoom,
            generationColors: Object.fromEntries(this.generationColors)
        };
        
        this.history.push(state);
        this.updateHistoryButtons();
    }

    undo() {
        const state = this.history.undo();
        if (state) {
            this.restoreState(state);
        }
    }

    redo() {
        const state = this.history.redo();
        if (state) {
            this.restoreState(state);
        }
    }

    restoreState(state) {
        // Clear current nodes
        this.nodes = [];
        this.clearSelection();
        
        // Recreate nodes from state
        const nodeMap = new Map();
        
        // First pass: create all nodes
        const createNodesFromJSON = (nodeDataArray, parent = null) => {
            nodeDataArray.forEach(nodeData => {
                const node = new Node(nodeData.x, nodeData.y, nodeData.text, nodeData);
                node.parent = parent;
                
                if (parent) {
                    parent.children.push(node);
                }
                
                this.nodes.push(node);
                nodeMap.set(nodeData.id, node);
                
                if (nodeData.children && nodeData.children.length > 0) {
                    createNodesFromJSON(nodeData.children, node);
                }
            });
        };
        
        // Find root nodes (nodes without parents)
        const rootNodes = state.nodes.filter(node => !state.nodes.some(n => 
            n.children && n.children.some(child => child.id === node.id)
        ));
        
        createNodesFromJSON(rootNodes);
        
        // Restore view
        this.viewOffset = { ...state.viewOffset };
        this.zoom = state.zoom;
        
        // Restore generation colors
        if (state.generationColors) {
            this.generationColors = new Map(Object.entries(state.generationColors).map(([k, v]) => [parseInt(k), v]));
        }
        
        this.render();
        this.updateStats();
        this.updateHistoryButtons();
        this.updateZoomIndicator();
    }

    updateHistoryButtons() {
        document.getElementById('btnUndo').disabled = !this.history.canUndo();
        document.getElementById('btnRedo').disabled = !this.history.canRedo();
    }

    // View operations
    zoomIn() {
        this.zoom = Math.min(3, this.zoom * 1.1);
        this.updateZoomIndicator();
        this.render();
    }

    zoomOut() {
        this.zoom = Math.max(0.1, this.zoom * 0.9);
        this.updateZoomIndicator();
        this.render();
    }

    fitToScreen() {
        if (this.nodes.length === 0) return;
        
        // Calculate bounding box of all nodes
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.nodes.forEach(node => {
            const bounds = node.getBounds();
            minX = Math.min(minX, bounds.left);
            minY = Math.min(minY, bounds.top);
            maxX = Math.max(maxX, bounds.right);
            maxY = Math.max(maxY, bounds.bottom);
        });
        
        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        const padding = 50;
        const scaleX = (this.canvas.width - padding * 2) / width;
        const scaleY = (this.canvas.height - padding * 2) / height;
        
        this.zoom = Math.min(Math.min(scaleX, scaleY), 1);
        this.viewOffset.x = this.canvas.width / 2 - centerX * this.zoom;
        this.viewOffset.y = this.canvas.height / 2 - centerY * this.zoom;
        
        this.updateZoomIndicator();
        this.render();
    }

    updateZoomIndicator() {
        document.querySelector('.zoom-indicator').textContent = Math.round(this.zoom * 100) + '%';
    }

    // Layout operations
    autoLayout() {
        if (this.nodes.length === 0) return;
        
        // Find root nodes
        const roots = this.nodes.filter(node => !node.parent);
        
        if (roots.length === 1) {
            // Single root - use tree layout
            LayoutEngine.applyTreeLayout(roots[0], true);
        } else {
            // Multiple roots or complex graph - use force-directed
            LayoutEngine.applyForceDirectedLayout(this.nodes);
        }
        
        this.saveState();
        this.fitToScreen();
    }

    // Style operations
    applyColor(color) {
        if (this.selectedNodes.length === 0) return;
        
        this.selectedNodes.forEach(node => {
            node.color = color;
        });
        
        this.saveState();
        this.render();
    }

    applyFontSize(size) {
        if (this.selectedNodes.length === 0) return;
        
        this.selectedNodes.forEach(node => {
            node.fontSize = size;
        });
        
        this.saveState();
        this.render();
    }

    applyFontWeight(weight) {
        if (this.selectedNodes.length === 0) return;
        
        this.selectedNodes.forEach(node => {
            node.fontWeight = weight;
        });
        
        this.saveState();
        this.render();
    }

    applyIcon(icon) {
        if (this.selectedNodes.length === 0) return;
        
        this.selectedNodes.forEach(node => {
            node.icon = icon;
        });
        
        this.saveState();
        this.render();
    }

    // UI operations
    toggleSidebar() {
        const sidebar = document.getElementById('sidebarLeft');
        const isHidden = sidebar.style.display === 'none' || sidebar.style.marginLeft === '-280px';
        
        if (isHidden) {
            sidebar.style.display = 'flex';
            sidebar.style.marginLeft = '0px';
        } else {
            sidebar.style.marginLeft = '-280px';
            setTimeout(() => {
                if (sidebar.style.marginLeft === '-280px') {
                    sidebar.style.display = 'none';
                }
            }, 200);
        }
    }
    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        document.body.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
        
        const icon = document.querySelector('#btnDarkMode i');
        icon.className = this.darkMode ? 'fas fa-sun' : 'fas fa-moon';
        
        this.render();
    }

    toggleSearch() {
        const searchPanel = document.getElementById('searchPanel');
        const searchInput = document.getElementById('searchInput');
        
        if (searchPanel.style.display === 'none') {
            searchPanel.style.display = 'flex';
            searchInput.focus();
            
            searchInput.addEventListener('input', () => {
                this.searchNodes(searchInput.value);
            });
            
            document.getElementById('btnCloseSearch').addEventListener('click', () => {
                searchPanel.style.display = 'none';
                this.clearSelection();
                this.render();
            });
        } else {
            searchPanel.style.display = 'none';
        }
    }

    searchNodes(query) {
        if (!query) {
            this.clearSelection();
            this.render();
            return;
        }
        
        this.clearSelection();
        
        const lowerQuery = query.toLowerCase();
        this.nodes.forEach(node => {
            if (node.text.toLowerCase().includes(lowerQuery)) {
                this.selectNode(node, true);
            }
        });
        
        this.render();
    }

    showContextMenu(x, y) {
        const menu = document.getElementById('contextMenu');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
        
        // Add event listeners to menu items
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.onclick = () => {
                this.handleContextMenuAction(item.dataset.action);
                menu.style.display = 'none';
            };
        });
        
        // Hide menu on outside click
        setTimeout(() => {
            document.addEventListener('click', () => {
                menu.style.display = 'none';
            }, { once: true });
        }, 0);
    }

    handleContextMenuAction(action) {
        switch(action) {
            case 'edit':
                if (this.selectedNodes.length === 1) {
                    this.editNodeText(this.selectedNodes[0]);
                }
                break;
            case 'copy':
                this.copy();
                break;
            case 'paste':
                this.paste();
                break;
            case 'duplicate':
                this.duplicate();
                break;
            case 'delete':
                this.deleteSelectedNodes();
                break;
            case 'bring-front':
                this.bringToFront();
                break;
            case 'send-back':
                this.sendToBack();
                break;
        }
    }

    bringToFront() {
        if (this.selectedNodes.length === 0) return;
        
        this.selectedNodes.forEach(node => {
            const index = this.nodes.indexOf(node);
            if (index > -1) {
                this.nodes.splice(index, 1);
                this.nodes.push(node);
            }
        });
        
        this.render();
    }

    sendToBack() {
        if (this.selectedNodes.length === 0) return;
        
        this.selectedNodes.forEach(node => {
            const index = this.nodes.indexOf(node);
            if (index > -1) {
                this.nodes.splice(index, 1);
                this.nodes.unshift(node);
            }
        });
        
        this.render();
    }

    toggleCommandPalette() {
        const palette = document.getElementById('commandPalette');
        const input = document.getElementById('commandInput');
        
        if (palette.style.display === 'none') {
            palette.style.display = 'block';
            input.value = '';
            input.focus();
            this.renderCommands();
        } else {
            this.hideCommandPalette();
        }
    }

    hideCommandPalette() {
        document.getElementById('commandPalette').style.display = 'none';
    }

    filterCommands(query) {
        const filtered = this.commands.filter(cmd => 
            cmd.title.toLowerCase().includes(query) ||
            cmd.description.toLowerCase().includes(query)
        );
        
        this.renderCommands(filtered);
    }

    renderCommands(commands = this.commands) {
        const list = document.getElementById('commandList');
        list.innerHTML = '';
        
        commands.forEach((cmd, index) => {
            const item = document.createElement('div');
            item.className = 'command-item';
            if (index === 0) item.classList.add('selected');
            item.dataset.command = cmd.id;
            
            // Create elements safely to prevent XSS
            const content = document.createElement('div');
            content.className = 'command-item-content';
            
            const icon = document.createElement('i');
            icon.className = 'fas fa-chevron-right';
            content.appendChild(icon);
            
            const textDiv = document.createElement('div');
            textDiv.className = 'command-item-text';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'command-item-title';
            titleDiv.textContent = cmd.title;
            textDiv.appendChild(titleDiv);
            
            const descDiv = document.createElement('div');
            descDiv.className = 'command-item-description';
            descDiv.textContent = cmd.description;
            textDiv.appendChild(descDiv);
            
            content.appendChild(textDiv);
            item.appendChild(content);
            
            const shortcutDiv = document.createElement('div');
            shortcutDiv.className = 'command-item-shortcut';
            shortcutDiv.textContent = cmd.shortcut;
            item.appendChild(shortcutDiv);
            
            item.addEventListener('click', () => {
                this.executeCommand(cmd.id);
                this.hideCommandPalette();
            });
            
            list.appendChild(item);
        });
    }

    navigateCommands(direction) {
        const items = document.querySelectorAll('.command-item');
        const current = document.querySelector('.command-item.selected');
        
        if (!current) return;
        
        const currentIndex = Array.from(items).indexOf(current);
        const newIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
        
        current.classList.remove('selected');
        items[newIndex].classList.add('selected');
        items[newIndex].scrollIntoView({ block: 'nearest' });
    }

    executeCommand(commandId) {
        const command = this.commands.find(cmd => cmd.id === commandId);
        if (command && command.action) {
            command.action();
        }
    }

    showExportModal() {
        const modal = document.getElementById('exportModal');
        modal.style.display = 'flex';
        
        document.getElementById('btnCloseExport').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        document.querySelectorAll('.export-option').forEach(option => {
            option.addEventListener('click', () => {
                this.export(option.dataset.format);
                modal.style.display = 'none';
            });
        });
    }

    export(format) {
        switch(format) {
            case 'json':
                this.exportJSON();
                break;
            case 'png':
                this.exportPNG();
                break;
            case 'svg':
                this.exportSVG();
                break;
            case 'pdf':
                this.exportPDF();
                break;
        }
    }

    exportJSON() {
        const data = {
            version: '1.0',
            created: new Date().toISOString(),
            title: this.mapTitle,
            nodes: this.nodes.map(node => node.toJSON()),
            viewOffset: this.viewOffset,
            zoom: this.zoom
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.mapTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportPNG() {
        // Store current view
        const tempOffset = { ...this.viewOffset };
        const tempZoom = this.zoom;
        
        // Fit all nodes
        this.fitToScreen();
        
        // Create temporary canvas
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Calculate bounds
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.nodes.forEach(node => {
            const bounds = node.getBounds();
            minX = Math.min(minX, bounds.left);
            minY = Math.min(minY, bounds.top);
            maxX = Math.max(maxX, bounds.right);
            maxY = Math.max(maxY, bounds.bottom);
        });
        
        const padding = 50;
        tempCanvas.width = (maxX - minX) + padding * 2;
        tempCanvas.height = (maxY - minY) + padding * 2;
        
        // Draw on temporary canvas
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        tempCtx.save();
        tempCtx.translate(padding - minX, padding - minY);
        
        // Draw connections
        this.nodes.forEach(node => {
            node.children.forEach(child => {
                this.drawConnection(tempCtx, node, child, 1);
            });
        });
        
        // Draw nodes
        this.nodes.forEach(node => {
            this.drawNode(tempCtx, node, 1);
        });
        
        tempCtx.restore();
        
        // Export
        tempCanvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.mapTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
            a.click();
            URL.revokeObjectURL(url);
        });
        
        // Restore view
        this.viewOffset = tempOffset;
        this.zoom = tempZoom;
        this.render();
    }

    exportSVG() {
        // SVG export would require converting canvas drawings to SVG elements
        alert('SVG export coming soon!');
    }

    exportPDF() {
        // PDF export would require a library like jsPDF
        alert('PDF export coming soon!');
    }

    showImportDialog() {
        const fileInput = document.getElementById('jsonFileInput');
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'application/json') {
                this.importJSON(file);
            } else {
                alert('Please select a valid JSON file.');
            }
            // Reset the input
            fileInput.value = '';
        };
        fileInput.click();
    }

    importJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.loadMindMapData(data);
            } catch (error) {
                alert('Error reading JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    loadMindMapData(data) {
        // Clear current mind map
        this.nodes = [];
        this.clearSelection();
        this.generationColors = new Map();
        
        // Validate data structure
        if (!data.nodes || !Array.isArray(data.nodes)) {
            alert('Invalid mind map format: missing nodes array');
            return;
        }
        
        // Limit number of nodes to prevent DoS
        if (data.nodes.length > 1000) {
            alert('Mind map too large: maximum 1000 nodes allowed');
            return;
        }
        
        // Load title if available
        if (data.title) {
            this.mapTitle = SecurityUtils.validateLength(data.title, 100);
            this.updateTitleDisplay();
        }
        
        // Restore generation colors if available
        if (data.generationColors) {
            this.generationColors = new Map(Object.entries(data.generationColors).map(([k, v]) => [parseInt(k), v]));
        }
        
        // Recreate nodes from JSON with validation
        const createNodesFromJSON = (nodeDataArray, parent = null) => {
            nodeDataArray.forEach(nodeData => {
                // Validate node data
                if (!SecurityUtils.validateNodeData(nodeData)) {
                    console.warn('Skipping invalid node data:', nodeData);
                    return;
                }
                const node = new Node(nodeData.x, nodeData.y, nodeData.text, {
                    id: nodeData.id,
                    shape: nodeData.shape || 'rounded',
                    color: nodeData.color || '#6366f1',
                    textColor: nodeData.textColor || '#ffffff',
                    fontSize: nodeData.fontSize || 14,
                    fontWeight: nodeData.fontWeight || '500',
                    width: nodeData.width || 150,
                    height: nodeData.height || 60,
                    icon: nodeData.icon,
                    notes: nodeData.notes || '',
                    metadata: nodeData.metadata || {}
                });
                
                node.parent = parent;
                node.collapsed = nodeData.collapsed || false;
                
                if (parent) {
                    parent.children.push(node);
                }
                
                this.nodes.push(node);
                
                if (nodeData.children && nodeData.children.length > 0) {
                    createNodesFromJSON(nodeData.children, node);
                }
            });
        };
        
        // Find root nodes (nodes without parents in the hierarchy)
        const rootNodes = data.nodes.filter(node => 
            !data.nodes.some(n => 
                n.children && n.children.some(child => child.id === node.id)
            )
        );
        
        createNodesFromJSON(rootNodes);
        
        // Restore view settings if available
        if (data.viewOffset) {
            this.viewOffset = { ...data.viewOffset };
        } else {
            this.viewOffset = { x: 0, y: 0 };
        }
        
        if (data.zoom) {
            this.zoom = data.zoom;
        } else {
            this.zoom = 1;
        }
        
        // Update UI
        this.updateZoomIndicator();
        this.render();
        this.updateStats();
        this.saveState();
        
        // Fit to screen if no view settings were saved
        if (!data.viewOffset && !data.zoom) {
            setTimeout(() => this.fitToScreen(), 100);
        }
        
        alert(`Successfully imported mind map with ${this.nodes.length} nodes!`);
    }

    showShortcutsModal() {
        const modal = document.getElementById('shortcutsModal');
        modal.style.display = 'flex';
        
        // Close button
        document.getElementById('btnCloseShortcuts').onclick = () => {
            modal.style.display = 'none';
        };
        
        // Close on backdrop click
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    updatePropertiesPanel() {
        const panel = document.getElementById('propertiesPanel');
        
        if (this.selectedNodes.length === 0) {
            // Create empty state safely
            panel.innerHTML = '';
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            
            const icon = document.createElement('i');
            icon.className = 'fas fa-mouse-pointer';
            emptyState.appendChild(icon);
            
            const p = document.createElement('p');
            p.textContent = 'Select a node to view properties';
            emptyState.appendChild(p);
            
            panel.appendChild(emptyState);
        } else if (this.selectedNodes.length === 1) {
            const node = this.selectedNodes[0];
            panel.innerHTML = '';
            
            // Create Priority Section: Text
            const prioritySection = document.createElement('div');
            prioritySection.className = 'priority-section';
            
            const propGroup1 = document.createElement('div');
            propGroup1.className = 'property-group';
            
            const label1 = document.createElement('label');
            label1.className = 'property-label';
            label1.textContent = 'Node Text';
            propGroup1.appendChild(label1);
            
            const input1 = document.createElement('input');
            input1.type = 'text';
            input1.value = SecurityUtils.escapeHTML(node.text);
            input1.id = 'propText';
            input1.className = 'property-input';
            input1.placeholder = 'Enter node text...';
            propGroup1.appendChild(input1);
            
            prioritySection.appendChild(propGroup1);
            panel.appendChild(prioritySection);
            
            // Create Notes Section
            const notesSection = document.createElement('div');
            notesSection.className = 'notes-section';
            
            const propGroup2 = document.createElement('div');
            propGroup2.className = 'property-group';
            
            const label2 = document.createElement('label');
            label2.className = 'property-label';
            label2.textContent = 'Notes';
            propGroup2.appendChild(label2);
            
            const textarea = document.createElement('textarea');
            textarea.id = 'propNotes';
            textarea.className = 'property-textarea';
            textarea.placeholder = 'Add notes, descriptions, links, or additional details about this node...';
            textarea.textContent = node.notes || '';
            propGroup2.appendChild(textarea);
            
            notesSection.appendChild(propGroup2);
            panel.appendChild(notesSection);
            
            // Create the rest of the panel structure
            const restHTML = `
                <!-- Collapsible Technical Details -->
                <div class="collapsible-section">
                    <div class="collapsible-header" id="technicalDetailsHeader">
                        <div class="collapsible-title">
                            <i class="fas fa-cog"></i>
                            Technical Details
                        </div>
                        <i class="fas fa-chevron-right collapsible-icon"></i>
                    </div>
                    <div class="collapsible-content" id="technicalDetailsContent">
                        <div class="collapsible-inner">
                            <div class="property-group">
                                <label class="property-label">Node ID</label>
                                <input type="text" value="${SecurityUtils.escapeHTML(node.id)}" readonly class="property-input">
                            </div>
                            
                            <div class="property-group">
                                <label class="property-label">Position</label>
                                <div class="property-grid">
                                    <input type="number" value="${Math.round(node.x)}" id="propX" class="property-input" placeholder="X">
                                    <input type="number" value="${Math.round(node.y)}" id="propY" class="property-input" placeholder="Y">
                                </div>
                            </div>
                            
                            <div class="property-group">
                                <label class="property-label">Size</label>
                                <div class="property-grid">
                                    <input type="number" value="${node.width}" id="propWidth" class="property-input" placeholder="Width">
                                    <input type="number" value="${node.height}" id="propHeight" class="property-input" placeholder="Height">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add collapsible functionality
            const header = document.getElementById('technicalDetailsHeader');
            const content = document.getElementById('technicalDetailsContent');
            
            if (header && content) {
                header.addEventListener('click', () => {
                    const isExpanded = header.classList.contains('expanded');
                    
                    if (isExpanded) {
                        header.classList.remove('expanded');
                        content.classList.remove('expanded');
                    } else {
                        header.classList.add('expanded');
                        content.classList.add('expanded');
                    }
                });
            }
            
            // Add event listeners for form fields with validation
            const propText = document.getElementById('propText');
            if (propText) {
                propText.addEventListener('change', e => {
                    node.text = SecurityUtils.validateLength(e.target.value, 500);
                    e.target.value = node.text; // Update input to show truncated value
                    this.saveState();
                    this.render();
                });
            }
            
            const propNotes = document.getElementById('propNotes');
            if (propNotes) {
                propNotes.addEventListener('change', e => {
                    node.notes = SecurityUtils.validateLength(e.target.value, 2000);
                    e.target.value = node.notes; // Update textarea to show truncated value
                    this.saveState();
                });
            }
            
            // Technical detail event listeners (only add if elements exist)
            const propX = document.getElementById('propX');
            const propY = document.getElementById('propY');
            const propWidth = document.getElementById('propWidth');
            const propHeight = document.getElementById('propHeight');
            
            if (propX) {
                propX.addEventListener('change', e => {
                    node.x = parseFloat(e.target.value);
                    this.saveState();
                    this.render();
                });
            }
            
            if (propY) {
                propY.addEventListener('change', e => {
                    node.y = parseFloat(e.target.value);
                    this.saveState();
                    this.render();
                });
            }
            
            if (propWidth) {
                propWidth.addEventListener('change', e => {
                    node.width = parseFloat(e.target.value);
                    this.saveState();
                    this.render();
                });
            }
            
            if (propHeight) {
                propHeight.addEventListener('change', e => {
                    node.height = parseFloat(e.target.value);
                    this.saveState();
                    this.render();
                });
            }
        } else {
            panel.innerHTML = `
                <div class="multi-select-info">
                    <i class="fas fa-layer-group"></i>
                    <p>${this.selectedNodes.length} nodes selected</p>
                    <small>Select a single node to edit properties</small>
                </div>
            `;
        }
    }

    updateStats() {
        document.getElementById('nodeCount').textContent = this.nodes.length;
        
        let connectionCount = 0;
        this.nodes.forEach(node => {
            connectionCount += node.children.length;
        });
        
        document.getElementById('connectionCount').textContent = connectionCount;
    }

    updateTreeView() {
        const treeView = document.getElementById('treeView');
        treeView.innerHTML = '';
        
        const roots = this.nodes.filter(node => !node.parent);
        
        const createTreeNode = (node, level = 0) => {
            const div = document.createElement('div');
            div.className = 'tree-node';
            div.style.marginLeft = (level * 20) + 'px';
            
            if (this.selectedNodes.includes(node)) {
                div.classList.add('selected');
            }
            
            // Create tree node elements safely
            const icon = document.createElement('i');
            icon.className = 'tree-node-icon fas fa-circle';
            div.appendChild(icon);
            
            const span = document.createElement('span');
            span.className = 'tree-node-text';
            span.textContent = node.text;
            div.appendChild(span);
            
            div.addEventListener('click', () => {
                this.clearSelection();
                this.selectNode(node);
                this.render();
            });
            
            treeView.appendChild(div);
            
            if (node.children && !node.collapsed) {
                node.children.forEach(child => createTreeNode(child, level + 1));
            }
        };
        
        roots.forEach(root => createTreeNode(root));
    }

    // Coordinate conversion
    worldToScreen(x, y) {
        return {
            x: x * this.zoom + this.viewOffset.x,
            y: y * this.zoom + this.viewOffset.y
        };
    }

    screenToWorld(x, y) {
        return {
            x: (x - this.viewOffset.x) / this.zoom,
            y: (y - this.viewOffset.y) / this.zoom
        };
    }

    // Rendering
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.ctx.fillStyle = this.darkMode ? '#0a0f1c' : '#fafbfc';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid if enabled
        if (this.gridEnabled) {
            this.drawGrid();
        }
        
        // Save context state
        this.ctx.save();
        
        // Apply view transformation
        this.ctx.translate(this.viewOffset.x, this.viewOffset.y);
        this.ctx.scale(this.zoom, this.zoom);
        
        // Draw connections
        this.nodes.forEach(node => {
            node.children.forEach(child => {
                this.drawConnection(this.ctx, node, child, this.zoom);
            });
        });
        
        // Draw connection preview
        if (this.isConnecting && this.connectStart) {
            this.drawConnectionPreview();
        }
        
        // Draw disconnect preview
        if (this.isDisconnecting && this.disconnectStart) {
            this.drawDisconnectPreview();
        }
        
        // Draw nodes
        this.nodes.forEach(node => {
            this.drawNode(this.ctx, node, this.zoom);
        });
        
        // Draw selection box
        if (this.isSelecting && this.selectionBox) {
            this.drawSelectionBox();
        }
        
        // Restore context state
        this.ctx.restore();
        
        // Update minimap
        this.renderMinimap();
        
        // Update tree view
        this.updateTreeView();
    }

    drawGrid() {
        const gridSize = 20 * this.zoom;
        const offsetX = this.viewOffset.x % gridSize;
        const offsetY = this.viewOffset.y % gridSize;
        
        this.ctx.strokeStyle = this.darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = offsetX; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = offsetY; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawConnection(ctx, from, to, zoom) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        
        const cp1x = from.x + (to.x - from.x) * 0.5;
        const cp1y = from.y;
        const cp2x = from.x + (to.x - from.x) * 0.5;
        const cp2y = to.y;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.x, to.y);
        
        ctx.strokeStyle = this.darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawConnectionPreview() {
        if (!this.connectStart || !this.mousePos) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.connectStart.x, this.connectStart.y);
        this.ctx.lineTo(this.mousePos.x, this.mousePos.y);
        
        this.ctx.strokeStyle = '#6366f1';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawDisconnectPreview() {
        if (!this.disconnectStart || !this.mousePos) return;
        
        // Find if there's a connection to highlight for disconnection
        const hoveredNode = this.getNodeAt(this.mousePos.x, this.mousePos.y);
        
        if (hoveredNode && hoveredNode !== this.disconnectStart) {
            // Check if there's a connection between these nodes
            const isConnected = this.disconnectStart.children.includes(hoveredNode) || 
                              hoveredNode.children.includes(this.disconnectStart);
            
            if (isConnected) {
                // Draw red dashed line to indicate disconnection
                this.ctx.beginPath();
                this.ctx.moveTo(this.disconnectStart.x, this.disconnectStart.y);
                this.ctx.lineTo(hoveredNode.x, hoveredNode.y);
                
                this.ctx.strokeStyle = '#ef4444'; // Red color for disconnect
                this.ctx.lineWidth = 3;
                this.ctx.setLineDash([10, 5]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                
                // Add "X" symbols at both ends
                this.drawDisconnectSymbol(this.disconnectStart.x, this.disconnectStart.y);
                this.drawDisconnectSymbol(hoveredNode.x, hoveredNode.y);
            }
        }
    }

    drawDisconnectSymbol(x, y) {
        this.ctx.save();
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        // Draw X symbol
        this.ctx.moveTo(x - 8, y - 8);
        this.ctx.lineTo(x + 8, y + 8);
        this.ctx.moveTo(x + 8, y - 8);
        this.ctx.lineTo(x - 8, y + 8);
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawNode(ctx, node, zoom) {
        const isSelected = this.selectedNodes.includes(node);
        const isHovered = node === this.hoveredNode;
        
        // Draw shadow
        if (isSelected || isHovered) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
        }
        
        // Draw shape based on node type
        ctx.fillStyle = node.color;
        
        switch(node.shape) {
            case 'rectangle':
                ctx.fillRect(
                    node.x - node.width / 2,
                    node.y - node.height / 2,
                    node.width,
                    node.height
                );
                break;
            
            case 'rounded':
                this.drawRoundedRect(
                    ctx,
                    node.x - node.width / 2,
                    node.y - node.height / 2,
                    node.width,
                    node.height,
                    10
                );
                break;
            
            case 'circle':
                ctx.beginPath();
                ctx.arc(node.x, node.y, Math.min(node.width, node.height) / 2, 0, Math.PI * 2);
                ctx.fill();
                break;
            
            case 'diamond':
                this.drawDiamond(ctx, node.x, node.y, node.width, node.height);
                break;
            
            case 'hexagon':
                this.drawHexagon(ctx, node.x, node.y, node.width, node.height);
                break;
            
            case 'cloud':
                this.drawCloud(ctx, node.x, node.y, node.width, node.height);
                break;
            
            default:
                this.drawRoundedRect(
                    ctx,
                    node.x - node.width / 2,
                    node.y - node.height / 2,
                    node.width,
                    node.height,
                    10
                );
        }
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw border
        if (isSelected) {
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 3;
            
            switch(node.shape) {
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, Math.min(node.width, node.height) / 2, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case 'diamond':
                    ctx.beginPath();
                    ctx.moveTo(node.x, node.y - node.height / 2);
                    ctx.lineTo(node.x + node.width / 2, node.y);
                    ctx.lineTo(node.x, node.y + node.height / 2);
                    ctx.lineTo(node.x - node.width / 2, node.y);
                    ctx.closePath();
                    ctx.stroke();
                    break;
                case 'hexagon':
                    const w = node.width / 2;
                    const h = node.height / 2;
                    ctx.beginPath();
                    ctx.moveTo(node.x - w * 0.5, node.y - h);
                    ctx.lineTo(node.x + w * 0.5, node.y - h);
                    ctx.lineTo(node.x + w, node.y);
                    ctx.lineTo(node.x + w * 0.5, node.y + h);
                    ctx.lineTo(node.x - w * 0.5, node.y + h);
                    ctx.lineTo(node.x - w, node.y);
                    ctx.closePath();
                    ctx.stroke();
                    break;
                default:
                    ctx.strokeRect(
                        node.x - node.width / 2,
                        node.y - node.height / 2,
                        node.width,
                        node.height
                    );
            }
        }
        
        // Draw text
        ctx.fillStyle = node.textColor;
        ctx.font = `${node.fontWeight} ${node.fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const lines = this.wrapText(ctx, node.text, node.width - 20);
        const lineHeight = node.fontSize * 1.2;
        const startY = node.y - (lines.length - 1) * lineHeight / 2;
        
        lines.forEach((line, index) => {
            ctx.fillText(line, node.x, startY + index * lineHeight);
        });
        
        // Draw icon if present
        if (node.icon) {
            // Icons would require font icons or images
        }
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }

    drawHexagon(ctx, x, y, width, height) {
        const w = width / 2;
        const h = height / 2;
        
        ctx.beginPath();
        ctx.moveTo(x - w * 0.5, y - h);
        ctx.lineTo(x + w * 0.5, y - h);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w * 0.5, y + h);
        ctx.lineTo(x - w * 0.5, y + h);
        ctx.lineTo(x - w, y);
        ctx.closePath();
        ctx.fill();
    }

    drawCloud(ctx, x, y, width, height) {
        // Create a proper cloud shape with a single continuous path
        const w = width / 2;
        const h = height / 2;
        
        // Draw each circle separately and fill them to create the cloud
        ctx.save();
        
        // Main body circles (larger ones at the base)
        ctx.beginPath();
        ctx.arc(x - w * 0.4, y + h * 0.1, h * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x + w * 0.4, y + h * 0.1, h * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y + h * 0.2, h * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Top puff circles (smaller ones on top)
        ctx.beginPath();
        ctx.arc(x - w * 0.2, y - h * 0.2, h * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x + w * 0.2, y - h * 0.2, h * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y - h * 0.4, h * 0.35, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    drawDiamond(ctx, x, y, width, height) {
        ctx.beginPath();
        ctx.moveTo(x, y - height / 2);
        ctx.lineTo(x + width / 2, y);
        ctx.lineTo(x, y + height / 2);
        ctx.lineTo(x - width / 2, y);
        ctx.closePath();
        ctx.fill();
    }

    generateChildColor(parent) {
        // Calculate the depth of the new child (parent's depth + 1)
        let parentDepth = 0;
        let currentNode = parent;
        while (currentNode.parent) {
            parentDepth++;
            currentNode = currentNode.parent;
        }
        const childDepth = parentDepth + 1;
        
        // If we already have a color for this generation, return it
        if (this.generationColors.has(childDepth)) {
            return this.generationColors.get(childDepth);
        }
        
        // Extended color pool for deep hierarchies
        const colorPool = [
            '#6366f1', // Purple
            '#dc2626', // Red  
            '#059669', // Green
            '#d97706', // Orange
            '#7c3aed', // Violet
            '#0891b2', // Sky Blue
            '#be185d', // Pink
            '#166534', // Dark Green
            '#ea580c', // Dark Orange
            '#4338ca', // Indigo
            '#be123c', // Rose
            '#047857', // Emerald
            '#c2410c', // Red-Orange
            '#5b21b6', // Purple-Violet
            '#0369a1', // Light Blue
            '#a21caf'  // Magenta
        ];
        
        // Generate new color for this generation
        const colorPalettes = [
            ['#6366f1', '#dc2626', '#059669', '#d97706', '#7c3aed'], // Purple → Red → Green → Orange → Violet (default)
            ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'], // Red → Blue → Green → Amber → Purple
            ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4'], // Green → Amber → Red → Purple → Cyan  
            ['#3b82f6', '#dc2626', '#059669', '#7c3aed', '#ea580c'], // Blue → Red → Green → Violet → Orange
            ['#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#8b5cf6'], // Amber → Green → Red → Cyan → Purple
            ['#06b6d4', '#dc2626', '#059669', '#f59e0b', '#6366f1'], // Cyan → Red → Green → Amber → Purple
            ['#8b5cf6', '#10b981', '#dc2626', '#f59e0b', '#3b82f6'], // Violet → Green → Red → Amber → Blue
            ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#dc2626']  // Orange → Blue → Green → Violet → Red
        ];
        
        // Find the root node and its color palette
        const rootNode = currentNode;
        let rootPalette = null;
        
        for (let i = 0; i < colorPalettes.length; i++) {
            if (colorPalettes[i].includes(rootNode.color)) {
                rootPalette = colorPalettes[i];
                break;
            }
        }
        
        let generationColor;
        if (rootPalette && childDepth < rootPalette.length) {
            // Use the color based on child's depth from the same palette
            generationColor = rootPalette[childDepth];
        } else if (rootPalette) {
            // If we've exceeded the palette length, cycle through the extended color pool
            // Skip colors already used in the root palette to ensure distinctness
            const usedColors = new Set(rootPalette);
            const availableColors = colorPool.filter(color => !usedColors.has(color));
            
            // Calculate which color to use from available colors
            const excessDepth = childDepth - rootPalette.length;
            const colorIndex = excessDepth % availableColors.length;
            generationColor = availableColors[colorIndex];
        } else {
            // If root color not found, cycle through the extended color pool
            const colorIndex = childDepth % colorPool.length;
            generationColor = colorPool[colorIndex];
        }
        
        // Store this color for this generation
        this.generationColors.set(childDepth, generationColor);
        return generationColor;
    }

    drawSelectionBox() {
        if (!this.selectionBox) return;
        
        const x = Math.min(this.selectionBox.start.x, this.selectionBox.end.x);
        const y = Math.min(this.selectionBox.start.y, this.selectionBox.end.y);
        const width = Math.abs(this.selectionBox.end.x - this.selectionBox.start.x);
        const height = Math.abs(this.selectionBox.end.y - this.selectionBox.start.y);
        
        this.ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        this.ctx.fillRect(x, y, width, height);
        
        this.ctx.strokeStyle = '#6366f1';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);
    }

    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (let word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    renderMinimap() {
        const scale = 0.1;
        const width = this.minimapCanvas.width;
        const height = this.minimapCanvas.height;
        
        // Clear minimap
        this.minimapCtx.clearRect(0, 0, width, height);
        
        // Draw background
        this.minimapCtx.fillStyle = this.darkMode ? '#1e293b' : '#ffffff';
        this.minimapCtx.fillRect(0, 0, width, height);
        
        // Calculate bounds
        if (this.nodes.length === 0) return;
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y);
        });
        
        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        const minimapScale = Math.min(
            (width - 20) / boundsWidth,
            (height - 20) / boundsHeight
        ) * 0.8;
        
        // Draw nodes
        this.minimapCtx.save();
        this.minimapCtx.translate(width / 2, height / 2);
        this.minimapCtx.scale(minimapScale, minimapScale);
        this.minimapCtx.translate(-centerX, -centerY);
        
        // Draw connections
        this.nodes.forEach(node => {
            node.children.forEach(child => {
                this.minimapCtx.beginPath();
                this.minimapCtx.moveTo(node.x, node.y);
                this.minimapCtx.lineTo(child.x, child.y);
                this.minimapCtx.strokeStyle = this.darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
                this.minimapCtx.lineWidth = 1 / minimapScale;
                this.minimapCtx.stroke();
            });
        });
        
        // Draw nodes
        this.nodes.forEach(node => {
            this.minimapCtx.fillStyle = node.color;
            this.minimapCtx.fillRect(
                node.x - 2 / minimapScale,
                node.y - 2 / minimapScale,
                4 / minimapScale,
                4 / minimapScale
            );
        });
        
        this.minimapCtx.restore();
        
        // Draw viewport indicator
        const viewportX = (-this.viewOffset.x / this.zoom - minX) * minimapScale + 10;
        const viewportY = (-this.viewOffset.y / this.zoom - minY) * minimapScale + 10;
        const viewportWidth = (this.canvas.width / this.zoom) * minimapScale;
        const viewportHeight = (this.canvas.height / this.zoom) * minimapScale;
        
        this.minimapCtx.strokeStyle = '#6366f1';
        this.minimapCtx.lineWidth = 2;
        this.minimapCtx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);
    }
}

// Initialize the application
const app = new MindMapApp();