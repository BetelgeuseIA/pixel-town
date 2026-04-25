// world.js - Sistema de mundo y generación de mapas

class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = [];
        this.zones = [];
        this.time = 0;
        this.day = 1;
        this.hour = 6;
        this.timeSpeed = 1;
        
        // Eventos
        this.activeEvent = null;
        this.eventTimer = 0;
        
        this.generate();
    }
    
    generate() {
        // Pre-calcular centro (solo una vez, fuera del loop)
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
        
        // Inicializar tiles con ruido simple
        for (let y = 0; y < this.height; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                const noise = Math.random();
                let type = 'grass';
                
                // Distribución de zonas
                const dist = Utils.distance(x, y, centerX, centerY);
                const normalized = dist / maxDist;
                
                if (normalized < 0.3) {
                    type = Math.random() < 0.7 ? 'city' : 'road';
                } else if (normalized < 0.6) {
                    type = Math.random() < 0.3 ? 'forest' : 'grass';
                } else {
                    type = Math.random() < 0.2 ? 'water' : 'sand';
                }
                
                this.tiles[y][x] = {
                    type,
                    walkable: type !== 'water',
                    resource: this.getResource(type),
                    x,
                    y
                };
            }
        }
        
        // Crear caminos entre zonas
        this.createRoads();
        
        // Definir zonas lógicas
        this.zones = [
            { name: 'Centro', x: centerX - 3, y: centerY - 3, w: 6, h: 6, type: 'city' },
            { name: 'Bosque Norte', x: 2, y: 2, w: 8, h: 6, type: 'forest' },
            { name: 'Lago Sur', x: this.width - 8, y: this.height - 6, w: 6, h: 4, type: 'water' },
            { name: 'Pradera Este', x: this.width - 6, y: 4, w: 4, h: 8, type: 'grass' }
        ];
    }
    
    getResource(type) {
        switch(type) {
            case 'forest': return { type: 'wood', amount: Utils.randomInt(10, 50) };
            case 'water': return { type: 'water', amount: 100 };
            case 'city': return { type: 'food', amount: Utils.randomInt(20, 100) };
            default: return null;
        }
    }
    
    createRoads() {
        // Camino horizontal central
        const midY = Math.floor(this.height / 2);
        for (let x = 0; x < this.width; x++) {
            if (this.tiles[midY][x].walkable) {
                this.tiles[midY][x].type = 'road';
            }
        }
        
        // Camino vertical central
        const midX = Math.floor(this.width / 2);
        for (let y = 0; y < this.height; y++) {
            if (this.tiles[y][midX].walkable) {
                this.tiles[y][midX].type = 'road';
            }
        }
    }
    
    update(deltaTime) {
        this.time += deltaTime * this.timeSpeed;
        
        // Calcular tiempo total del ciclo
        const totalCycle = CONFIG.DAY_LENGTH + CONFIG.NIGHT_LENGTH;
        const cycleProgress = (this.time % totalCycle) / totalCycle;
        
        // Calcular hora virtual (0-24)
        // Día: 0% - (DAY_LENGTH/totalCycle)% → horas 6-20
        // Noche: resto → horas 20-6
        const dayRatio = CONFIG.DAY_LENGTH / totalCycle;
        
        if (cycleProgress <= dayRatio) {
            // Es de día (progreso 0 a dayRatio) → horas 6 a 20
            const dayProgress = cycleProgress / dayRatio;
            this.hour = 6 + (dayProgress * 14);
            this.isNight = false;
            this.isReturnPhase = (1 - dayProgress) * CONFIG.DAY_DURATION_MS <= CONFIG.RETURN_HOME_BUFFER_MS;
        } else {
            // Es de noche → horas 20 a 6
            const nightProgress = (cycleProgress - dayRatio) / (1 - dayRatio);
            this.hour = 20 + (nightProgress * 10); // 20-30 (que es 20-6)
            if (this.hour >= 24) this.hour -= 24;
            this.isNight = true;
            this.isReturnPhase = true;
        }
        
        // Calcular tiempo restante del día
        if (!this.isNight) {
            const dayElapsed = (this.time % totalCycle);
            this.dayRemainingMs = (CONFIG.DAY_LENGTH - dayElapsed) * (1000 / 60); // Convertir frames a ms
        } else {
            this.dayRemainingMs = 0;
        }
        
        // Nuevo ciclo (día)
        const currentCycle = Math.floor(this.time / totalCycle);
        if (currentCycle > (this.lastCycle || 0)) {
            this.day++;
            this.lastCycle = currentCycle;
            console.log(`🌅 NUEVO DÍA ${this.day} - Ciclo ${currentCycle}`);
            
            // Iniciar evento del día (Festival)
            this.startEvent('festival');
        }
        
        // Actualizar evento activo
        this.updateEvent(deltaTime);
    }
    
    startEvent(eventType) {
        switch(eventType) {
            case 'festival':
                this.activeEvent = {
                    type: 'festival',
                    name: '🎉 Festival del Pueblo',
                    duration: 3000, // ~50 segundos
                    centerX: NAV.MAP_WIDTH / 2,
                    centerY: NAV.MAP_HEIGHT / 2,
                    description: 'Todos los habitantes se reúnen en la plaza'
                };
                console.log(`🎉 FESTIVAL INICIADO - Día ${this.day}`);
                break;
        }
    }
    
    updateEvent(deltaTime) {
        if (!this.activeEvent) return;
        
        this.eventTimer += deltaTime;
        
        if (this.eventTimer >= this.activeEvent.duration) {
            console.log(`🎉 FESTIVAL TERMINADO`);
            this.activeEvent = null;
            this.eventTimer = 0;
        }
    }
    
    isEventActive() {
        return this.activeEvent !== null;
    }
    
    getEventCenter() {
        if (!this.activeEvent) return null;
        return { x: this.activeEvent.centerX, y: this.activeEvent.centerY };
    }
    
    isWalkable(x, y) {
        const tx = Math.floor(x / CONFIG.TILE_SIZE);
        const ty = Math.floor(y / CONFIG.TILE_SIZE);
        
        if (!Utils.inBounds(tx, ty, this.width, this.height)) return false;
        
        return this.tiles[ty][tx].walkable;
    }
    
    getTile(x, y) {
        const tx = Math.floor(x / CONFIG.TILE_SIZE);
        const ty = Math.floor(y / CONFIG.TILE_SIZE);
        
        if (!Utils.inBounds(tx, ty, this.width, this.height)) return null;
        
        return this.tiles[ty][tx];
    }
    
    getTimeOfDay() {
        if (this.isNight) return 'night';
        if (this.hour >= 5 && this.hour < 7) return 'dawn';
        if (this.hour >= 18 && this.hour < 20) return 'dusk';
        return 'day';
    }
    
    // Debug info
    getCycleInfo() {
        const totalCycle = CONFIG.DAY_LENGTH + CONFIG.NIGHT_LENGTH;
        const cycleProgress = (this.time % totalCycle) / totalCycle;
        const dayRatio = CONFIG.DAY_LENGTH / totalCycle;
        
        return {
            isNight: this.isNight,
            isReturnPhase: this.isReturnPhase,
            hour: this.hour,
            dayRemainingMs: this.dayRemainingMs,
            cycleProgress: cycleProgress,
            dayProgress: this.isNight ? 1 : (cycleProgress / dayRatio)
        };
    }
    
    getZonesByType(type) {
        return this.zones.filter(z => z.type === type);
    }
    
    getRandomPositionInZone(zoneType) {
        const zones = this.getZonesByType(zoneType);
        if (zones.length === 0) return null;
        
        const zone = zones[Utils.randomInt(0, zones.length - 1)];
        return {
            x: Utils.randomBetween(zone.x, zone.x + zone.w) * CONFIG.TILE_SIZE,
            y: Utils.randomBetween(zone.y, zone.y + zone.h) * CONFIG.TILE_SIZE
        };
    }
    
    findNearbyResources(x, y, resourceType, radius = 200) {
        const nearby = [];
        const tx = Math.floor(x / CONFIG.TILE_SIZE);
        const ty = Math.floor(y / CONFIG.TILE_SIZE);
        const radiusTiles = Math.ceil(radius / CONFIG.TILE_SIZE);
        
        for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
            for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
                const nx = tx + dx;
                const ny = ty + dy;
                
                if (Utils.inBounds(nx, ny, this.width, this.height)) {
                    const tile = this.tiles[ny][nx];
                    if (tile.resource && tile.resource.type === resourceType) {
                        nearby.push({
                            x: nx * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                            y: ny * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                            resource: tile.resource
                        });
                    }
                }
            }
        }
        
        return nearby;
    }
}
