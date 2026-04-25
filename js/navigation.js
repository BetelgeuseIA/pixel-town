// navigation.js - Sistema de navegación inteligente

const NAV = {
    // Dimensiones del mapa real
    MAP_WIDTH: 2816,
    MAP_HEIGHT: 1536,
    
    // Grid size para pathfinding
    GRID_SIZE: 32,
    
    // Zonas del mundo definidas manualmente
    ZONES: {
        // Río principal
        water: [
            { x: 1200, y: 0, w: 200, h: 700 },
            { x: 1100, y: 700, w: 300, h: 400 },
            { x: 1200, y: 1100, w: 200, h: 436 }
        ],
        
        // Lago pequeño
        lake: [
            { x: 400, y: 200, w: 250, h: 180 }
        ],
        
        // Estanque/isla
        pond: [
            { x: 2000, y: 800, w: 150, h: 100 }
        ],
        
        // Casas del pueblo
        houses: [
            { id: "house_1", x: 600, y: 400, w: 80, h: 70, door: { x: 640, y: 470 } },
            { id: "house_2", x: 750, y: 380, w: 80, h: 70, door: { x: 790, y: 450 } },
            { id: "house_3", x: 500, y: 550, w: 80, h: 70, door: { x: 540, y: 620 } },
            { id: "house_4", x: 680, y: 600, w: 80, h: 70, door: { x: 720, y: 670 } },
            { id: "house_5", x: 850, y: 500, w: 80, h: 70, door: { x: 890, y: 570 } },
            { id: "house_6", x: 450, y: 700, w: 80, h: 70, door: { x: 490, y: 770 } },
            { id: "house_7", x: 620, y: 750, w: 80, h: 70, door: { x: 660, y: 820 } },
            { id: "house_8", x: 800, y: 700, w: 80, h: 70, door: { x: 840, y: 770 } }
        ],
        
        // Caminos principales
        roads: [
            { x: 300, y: 850, w: 1000, h: 60 },
            { x: 1450, y: 200, w: 60, h: 1100 },
            { x: 1450, y: 850, w: 400, h: 60 },
            { x: 300, y: 850, w: 60, h: 400 },
            { x: 550, y: 350, w: 60, h: 550 },
            { x: 500, y: 500, w: 400, h: 50 },
            { x: 500, y: 650, w: 400, h: 50 }
        ],
        
        // Bosque (zona caminable pero lenta)
        forest: [
            { x: 1600, y: 100, w: 500, h: 400 },
            { x: 2200, y: 200, w: 400, h: 300 }
        ],
        
        // Montañas/rocas (bloqueadas)
        mountains: [
            { x: 2400, y: 600, w: 300, h: 400 },
            { x: 2000, y: 1100, w: 400, h: 300 }
        ],
        
        // Puente sobre el río
        bridge: [
            { x: 1150, y: 600, w: 300, h: 80 }
        ],
        
        // Zona de trabajo
        work_zone: [
            { x: 1800, y: 900, w: 300, h: 200 }
        ],
        
        // Granja
        farm: [
            { x: 200, y: 1100, w: 300, h: 200 }
        ]
    }
};

// Clase NavGrid para pathfinding
class NavGrid {
    constructor() {
        this.cols = Math.ceil(NAV.MAP_WIDTH / NAV.GRID_SIZE);
        this.rows = Math.ceil(NAV.MAP_HEIGHT / NAV.GRID_SIZE);
        this.grid = [];
        this.initGrid();
    }
    
    initGrid() {
        for (let y = 0; y < this.rows; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.grid[y][x] = {
                    walkable: true,
                    type: 'grass',
                    cost: 2,
                    x: x * NAV.GRID_SIZE,
                    y: y * NAV.GRID_SIZE
                };
            }
        }
        this.applyZones();
    }
    
    applyZones() {
        // Agua (bloqueada)
        for (const zone of NAV.ZONES.water) this.markZone(zone, 'water', false, 0);
        for (const zone of NAV.ZONES.lake) this.markZone(zone, 'water', false, 0);
        for (const zone of NAV.ZONES.pond) this.markZone(zone, 'water', false, 0);
        
        // Casas (bloqueadas)
        for (const zone of NAV.ZONES.houses) this.markZone(zone, 'house', false, 0);
        
        // Montañas (bloqueadas)
        for (const zone of NAV.ZONES.mountains) this.markZone(zone, 'mountain', false, 0);
        
        // Caminos (caminable, costo bajo)
        for (const zone of NAV.ZONES.roads) this.markZone(zone, 'road', true, 1);
        
        // Puente (caminable)
        for (const zone of NAV.ZONES.bridge) this.markZone(zone, 'bridge', true, 1);
        
        // Bosque (caminable, costo alto)
        for (const zone of NAV.ZONES.forest) this.markZone(zone, 'forest', true, 3);
    }
    
    markZone(zone, type, walkable, cost) {
        const startCol = Math.floor(zone.x / NAV.GRID_SIZE);
        const startRow = Math.floor(zone.y / NAV.GRID_SIZE);
        const endCol = Math.ceil((zone.x + zone.w) / NAV.GRID_SIZE);
        const endRow = Math.ceil((zone.y + zone.h) / NAV.GRID_SIZE);
        
        for (let row = Math.max(0, startRow); row < Math.min(this.rows, endRow); row++) {
            for (let col = Math.max(0, startCol); col < Math.min(this.cols, endCol); col++) {
                this.grid[row][col] = {
                    walkable,
                    type,
                    cost,
                    x: col * NAV.GRID_SIZE,
                    y: row * NAV.GRID_SIZE
                };
            }
        }
    }
    
    worldToGrid(x, y) {
        return {
            col: Math.floor(x / NAV.GRID_SIZE),
            row: Math.floor(y / NAV.GRID_SIZE)
        };
    }
    
    gridToWorld(col, row) {
        return {
            x: col * NAV.GRID_SIZE + NAV.GRID_SIZE / 2,
            y: row * NAV.GRID_SIZE + NAV.GRID_SIZE / 2
        };
    }
    
    isWalkable(x, y) {
        const grid = this.worldToGrid(x, y);
        if (grid.row < 0 || grid.row >= this.rows || grid.col < 0 || grid.col >= this.cols) {
            return false;
        }
        return this.grid[grid.row][grid.col].walkable;
    }
    
    getMovementCost(x, y) {
        const grid = this.worldToGrid(x, y);
        if (grid.row < 0 || grid.row >= this.rows || grid.col < 0 || grid.col >= this.cols) {
            return Infinity;
        }
        return this.grid[grid.row][grid.col].cost;
    }
    
    findPath(startX, startY, endX, endY) {
        const start = this.worldToGrid(startX, startY);
        const end = this.worldToGrid(endX, endY);
        
        if (end.row < 0 || end.row >= this.rows || end.col < 0 || end.col >= this.cols) {
            return null;
        }
        
        if (!this.grid[end.row][end.col].walkable) {
            const nearest = this.findNearestWalkable(end.col, end.row);
            if (!nearest) return null;
            end.col = nearest.col;
            end.row = nearest.row;
        }
        
        const openSet = [start];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        const startKey = `${start.col},${start.row}`;
        const endKey = `${end.col},${end.row}`;
        
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(start, end));
        
        while (openSet.length > 0) {
            let current = openSet[0];
            let currentIdx = 0;
            let lowestF = fScore.get(`${current.col},${current.row}`) || Infinity;
            
            for (let i = 1; i < openSet.length; i++) {
                const node = openSet[i];
                const f = fScore.get(`${node.col},${node.row}`) || Infinity;
                if (f < lowestF) {
                    lowestF = f;
                    current = node;
                    currentIdx = i;
                }
            }
            
            const currentKey = `${current.col},${current.row}`;
            
            if (current.col === end.col && current.row === end.row) {
                return this.reconstructPath(cameFrom, current);
            }
            
            openSet.splice(currentIdx, 1);
            closedSet.add(currentKey);
            
            const neighbors = [
                { col: current.col + 1, row: current.row },
                { col: current.col - 1, row: current.row },
                { col: current.col, row: current.row + 1 },
                { col: current.col, row: current.row - 1 }
            ];
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.col},${neighbor.row}`;
                
                if (neighbor.row < 0 || neighbor.row >= this.rows || 
                    neighbor.col < 0 || neighbor.col >= this.cols) {
                    continue;
                }
                
                if (!this.grid[neighbor.row][neighbor.col].walkable) continue;
                if (closedSet.has(neighborKey)) continue;
                
                const tentativeG = (gScore.get(currentKey) || 0) + 
                    this.grid[neighbor.row][neighbor.col].cost;
                
                if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, end));
                    
                    if (!openSet.some(n => n.col === neighbor.col && n.row === neighbor.row)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        
        return null;
    }
    
    // NUEVO: Actualizar walkability basado en zonas del mapa
    updateZones(zones) {
        if (!zones) return;
        
        // Marcar agua como no caminable
        for (const zone of zones.water || []) {
            this.markZone(zone.x, zone.y, zone.w, zone.h, false);
        }
        for (const zone of zones.lake || []) {
            this.markZone(zone.x, zone.y, zone.w, zone.h, false);
        }
        for (const zone of zones.pond || []) {
            this.markZone(zone.x, zone.y, zone.w, zone.h, false);
        }
        
        // Marcar casas como no caminable (excepto puertas)
        for (const house of zones.houses || []) {
            this.markZone(house.x, house.y, house.w, house.h, false);
            // La puerta sí es caminable
            const doorNode = this.worldToGrid(house.door.x, house.door.y);
            if (this.inBounds(doorNode.col, doorNode.row)) {
                this.grid[doorNode.row][doorNode.col].walkable = true;
                this.grid[doorNode.row][doorNode.col].cost = 1;
            }
        }
        
        // Los caminos ya son caminables por defecto
        console.log('🚧 Zonas de obstáculos aplicadas al pathfinding');
    }
    
    markZone(x, y, w, h, walkable) {
        const start = this.worldToGrid(x, y);
        const end = this.worldToGrid(x + w, y + h);
        
        for (let row = start.row; row <= end.row; row++) {
            for (let col = start.col; col <= end.col; col++) {
                if (this.inBounds(col, row)) {
                    this.grid[row][col].walkable = walkable;
                    this.grid[row][col].cost = walkable ? 1 : Infinity;
                }
            }
        }
    }
    
    inBounds(col, row) {
        return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
    }
    
    reconstructPath(cameFrom, current) {
        const path = [];
        let curr = current;
        
        while (curr) {
            path.unshift(this.gridToWorld(curr.col, curr.row));
            const key = `${curr.col},${curr.row}`;
            curr = cameFrom.get(key);
        }
        
        return path;
    }
    
    findNearestWalkable(col, row) {
        let radius = 1;
        const maxRadius = 10;
        
        while (radius <= maxRadius) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
                    
                    const newCol = col + dx;
                    const newRow = row + dy;
                    
                    if (newRow >= 0 && newRow < this.rows && 
                        newCol >= 0 && newCol < this.cols &&
                        this.grid[newRow][newCol].walkable) {
                        return { col: newCol, row: newRow };
                    }
                }
            }
            radius++;
        }
        
        return null;
    }
    
    renderDebug(ctx, camera) {
        ctx.save();
        ctx.translate(camera.x, camera.y);
        ctx.scale(camera.zoom, camera.zoom);
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = this.grid[row][col];
                const x = col * NAV.GRID_SIZE;
                const y = row * NAV.GRID_SIZE;
                
                if (!cell.walkable) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    ctx.fillRect(x, y, NAV.GRID_SIZE, NAV.GRID_SIZE);
                } else if (cell.type === 'road') {
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
                    ctx.fillRect(x, y, NAV.GRID_SIZE, NAV.GRID_SIZE);
                } else if (cell.type === 'forest') {
                    ctx.fillStyle = 'rgba(0, 100, 0, 0.2)';
                    ctx.fillRect(x, y, NAV.GRID_SIZE, NAV.GRID_SIZE);
                }
                
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, NAV.GRID_SIZE, NAV.GRID_SIZE);
            }
        }
        
        ctx.restore();
    }
}
