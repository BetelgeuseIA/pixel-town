// npc.js - Sistema de NPCs con IA local de estados

const NPC_STATES = {
    IDLE: 'idle',
    EXPLORING: 'exploring',
    SEEKING_FOOD: 'seeking_food',
    EATING: 'eating',
    RESTING: 'resting',
    SOCIALIZING: 'socializing',
    WORKING: 'working',
    GOING_HOME: 'going_home',
    SLEEPING: 'sleeping',
    WALKING_PATH: 'walking_path'
};

const NPC_PERSONALITIES = {
    SOCIAL: { name: 'social', socialNeed: 1.5, workEthic: 0.7 },
    WORKER: { name: 'worker', socialNeed: 0.7, workEthic: 1.5 },
    EXPLORER: { name: 'explorer', socialNeed: 0.8, workEthic: 0.8 },
    HOME_BODY: { name: 'home_body', socialNeed: 0.5, workEthic: 1.0 }
};

class NPC {
    constructor(id, x, y, world) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.world = world;
        
        // Atributos base
        this.name = this.generateName();
        this.color = this.generateColor();
        this.personality = this.randomPersonality();
        
        // Necesidades
        this.needs = {
            hunger: Utils.randomBetween(50, 100),
            energy: Utils.randomBetween(60, 100),
            social: Utils.randomBetween(40, 100)
        };
        
        // Estado
        this.state = NPC_STATES.IDLE;
        this.target = null;
        this.speed = CONFIG.NPC_SPEED;
        this.direction = { x: 0, y: 0 };
        
        // Memoria - mejorada
        this.memory = {
            explored: new Set(),
            knownLocations: [],
            relationships: new Map(),
            lastMeal: 0,
            conversations: [],
            // NUEVO: Memoria de lugares importantes
            foodLocations: [],      // Donde encontró comida
            homeLocation: null,     // Su casa
            workLocation: null,     // Su lugar de trabajo
            favoritePlaces: [],     // Lugares que le gustan
            avoidedPlaces: []       // Lugares peligrosos/bloqueados
        };
        
        // Trabajo
        this.job = null;
        this.home = null;
        
        // Sprite - cargar de forma segura
        this.spriteLoaded = false;
        this.spriteRow = this.id % 8; // Diferente personaje para cada NPC
        this.spriteFrame = 0;
        this.loadSprite();
        
        // Animación
        this.animationFrame = 0;
        this.idleTime = 0;
        
        // Estado de movimiento
        this.isMoving = false;
    }
    
    loadSprite() {
        // Intentar cargar el sprite, pero no bloquear si falla
        this.sprite = new Image();
        this.sprite.crossOrigin = 'anonymous'; // Para CORS
        this.sprite.onload = () => {
            this.spriteLoaded = true;
            console.log(`✅ Sprite cargado para NPC ${this.id} (${this.sprite.naturalWidth}x${this.sprite.naturalHeight})`);
        };
        this.sprite.onerror = (e) => {
            console.warn(`⚠️ Error cargando sprite para NPC ${this.id}:`, e);
            this.spriteLoaded = false;
        };
        this.sprite.src = 'assets/32x32folk.png';
        console.log(`🔄 Cargando sprite para NPC ${this.id}...`);
    }
    
    generateName() {
        const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack',
                      'Luna', 'Miles', 'Nora', 'Oliver', 'Penny', 'Quinn', 'Rose', 'Sam', 'Tara', 'Uma'];
        return names[this.id % names.length] + ` #${this.id}`;
    }
    
    generateColor() {
        const colors = ['#66ccff', '#ff6666', '#66ff66', '#ffff66', '#ff66ff', '#ff9966', '#66ffcc', '#cc66ff'];
        return colors[this.id % colors.length];
    }
    
    randomPersonality() {
        const keys = Object.keys(NPC_PERSONALITIES);
        return NPC_PERSONALITIES[keys[Utils.randomInt(0, keys.length - 1)]];
    }
    
    update(deltaTime) {
        // Limitar deltaTime para evitar saltos
        deltaTime = Math.min(deltaTime, 2);
        
        this.animationFrame += deltaTime;
        
        // Decaer necesidades
        this.decayNeeds(deltaTime);
        
        // Tomar decisión basada en prioridades
        this.decideState();
        
        // Ejecutar comportamiento del estado actual
        this.executeState(deltaTime);
        
        // Actualizar memoria
        this.updateMemory();
    }
    
    decayNeeds(deltaTime) {
        this.needs.hunger -= CONFIG.HUNGER_DECAY * deltaTime;
        this.needs.energy -= CONFIG.ENERGY_DECAY * deltaTime;
        this.needs.social -= 0.02 * deltaTime;
        
        // Aplicar modificadores de personalidad
        if (this.personality.name === 'home_body') {
            this.needs.energy -= 0.01 * deltaTime;
        }
        
        // Limitar necesidades
        this.needs.hunger = Utils.clamp(this.needs.hunger, 0, 100);
        this.needs.energy = Utils.clamp(this.needs.energy, 0, 100);
        this.needs.social = Utils.clamp(this.needs.social, 0, 100);
    }
    
    decideState() {
        const cycleInfo = this.world.getCycleInfo();
        const hour = this.world.hour;
        
        // EVENTO ACTIVO: Si hay festival, ir al centro
        if (this.world.isEventActive() && !cycleInfo.isReturnPhase && !cycleInfo.isNight) {
            const eventCenter = this.world.getEventCenter();
            if (eventCenter && this.state !== NPC_STATES.WALKING_PATH) {
                // Ir al festival solo si no estamos yendo a casa
                if (this.state !== NPC_STATES.GOING_HOME && this.state !== NPC_STATES.SLEEPING) {
                    this.setState(NPC_STATES.EXPLORING);
                    this.target = { x: eventCenter.x + Utils.randomBetween(-100, 100), 
                                   y: eventCenter.y + Utils.randomBetween(-100, 100) };
                    this.isMoving = true;
                    return;
                }
            }
        }
        if (cycleInfo.isReturnPhase && !cycleInfo.isNight && this.home) {
            if (this.state !== NPC_STATES.GOING_HOME && 
                this.state !== NPC_STATES.WALKING_PATH &&
                this.state !== NPC_STATES.SLEEPING) {
                this.setState(NPC_STATES.GOING_HOME);
            }
            return;
        }
        
        // PRIORIDAD 2: Es de noche
        if (cycleInfo.isNight && this.home) {
            if (this.state !== NPC_STATES.GOING_HOME && 
                this.state !== NPC_STATES.WALKING_PATH &&
                this.state !== NPC_STATES.SLEEPING) {
                this.setState(NPC_STATES.GOING_HOME);
            }
            return;
        }
        
        // PRIORIDAD 3: Energía muy baja
        if (this.needs.energy < CONFIG.ENERGY_THRESHOLD && this.home) {
            if (this.state !== NPC_STATES.GOING_HOME && 
                this.state !== NPC_STATES.SLEEPING) {
                this.setState(NPC_STATES.GOING_HOME);
            }
            return;
        }
        
        // PRIORIDAD 4: Hambre
        if (this.needs.hunger < CONFIG.HUNGER_THRESHOLD) {
            if (this.state !== NPC_STATES.SEEKING_FOOD && this.state !== NPC_STATES.EATING) {
                this.setState(NPC_STATES.SEEKING_FOOD);
            }
            return;
        }
        
        // PRIORIDAD 5: Social
        if (this.needs.social < 30 && this.personality.socialNeed > 1.0) {
            if (this.state !== NPC_STATES.SOCIALIZING) {
                this.setState(NPC_STATES.SOCIALIZING);
            }
            return;
        }
        
        // PRIORIDAD 6: Trabajar (solo de día, no en fase de retorno)
        if (!cycleInfo.isReturnPhase && !cycleInfo.isNight && this.personality.workEthic > 1.2) {
            if (this.state !== NPC_STATES.WORKING) {
                this.setState(NPC_STATES.WORKING);
            }
            return;
        }
        
        // DEFAULT: Explorar (solo si no es retorno ni noche)
        if (!cycleInfo.isReturnPhase && !cycleInfo.isNight) {
            if (this.state === NPC_STATES.IDLE || this.state === NPC_STATES.SLEEPING) {
                this.setState(NPC_STATES.EXPLORING);
            }
        }
    }
    
    setState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.target = null;
            this.idleTime = 0;
            this.isMoving = false;
        }
    }
    
    executeState(deltaTime) {
        switch (this.state) {
            case NPC_STATES.IDLE:
                this.idleBehavior(deltaTime);
                break;
            case NPC_STATES.EXPLORING:
                this.exploreBehavior(deltaTime);
                break;
            case NPC_STATES.SEEKING_FOOD:
                this.seekFoodBehavior(deltaTime);
                break;
            case NPC_STATES.EATING:
                this.eatingBehavior(deltaTime);
                break;
            case NPC_STATES.RESTING:
                this.restingBehavior(deltaTime);
                break;
            case NPC_STATES.SOCIALIZING:
                this.socialBehavior(deltaTime);
                break;
            case NPC_STATES.WORKING:
                this.workBehavior(deltaTime);
                break;
            case NPC_STATES.GOING_HOME:
                this.goingHomeBehavior(deltaTime);
                break;
            case NPC_STATES.SLEEPING:
                this.sleepingBehavior(deltaTime);
                break;
            case NPC_STATES.WALKING_PATH:
                this.walkingPathBehavior(deltaTime);
                break;
        }
    }
    
    idleBehavior(deltaTime) {
        this.idleTime += deltaTime;
        
        // Mirar alrededor ocasionalmente
        if (this.idleTime > 100) {
            this.setState(NPC_STATES.EXPLORING);
        }
    }
    
    exploreBehavior(deltaTime) {
        if (!this.target || this.isAtTarget()) {
            // Elegir nuevo punto de exploración
            const angle = Utils.randomBetween(0, Math.PI * 2);
            const distance = Utils.randomBetween(100, 300);
            let targetX = this.x + Math.cos(angle) * distance;
            let targetY = this.y + Math.sin(angle) * distance;
            
            // Asegurar que está dentro del mapa
            targetX = Utils.clamp(targetX, 50, this.world.width * CONFIG.TILE_SIZE - 50);
            targetY = Utils.clamp(targetY, 50, this.world.height * CONFIG.TILE_SIZE - 50);
            
            if (this.world.isWalkable(targetX, targetY)) {
                this.target = { x: targetX, y: targetY };
                this.isMoving = true;
            }
        }
        
        if (this.target) {
            this.moveToTarget(deltaTime);
        }
    }
    
    seekFoodBehavior(deltaTime) {
        if (!this.target) {
            // Buscar comida cercana
            const foodSources = this.world.findNearbyResources(this.x, this.y, 'food', 400);
            
            if (foodSources.length > 0) {
                const closest = Utils.findClosest({ x: this.x, y: this.y }, foodSources);
                this.target = closest.target;
                this.isMoving = true;
            } else {
                // Explorar para encontrar comida
                this.exploreBehavior(deltaTime);
                return;
            }
        }
        
        if (this.target) {
            this.moveToTarget(deltaTime);
            
            if (this.isAtTarget()) {
                this.setState(NPC_STATES.EATING);
            }
        }
    }
    
    eatingBehavior(deltaTime) {
        this.idleTime += deltaTime;
        
        if (this.idleTime > 60) {
            this.needs.hunger = Math.min(this.needs.hunger + 40, 100);
            this.memory.lastMeal = this.world.time;
            this.setState(NPC_STATES.IDLE);
        }
    }
    
    restingBehavior(deltaTime) {
        this.idleTime += deltaTime;
        this.needs.energy += 0.8 * deltaTime;
        
        // Despertar si es de día o si ya descansó suficiente
        if (this.world.getTimeOfDay() === 'day' || this.needs.energy > 80) {
            if (this.idleTime > 50) {
                this.setState(NPC_STATES.IDLE);
            }
        }
    }
    
    socialBehavior(deltaTime) {
        if (!this.target) {
            // Buscar NPCs cercanos
            const nearbyNPCs = this.findNearbyNPCs(200);
            if (nearbyNPCs.length > 0) {
                const closest = Utils.findClosest({ x: this.x, y: this.y }, nearbyNPCs);
                this.target = { x: closest.target.x, y: closest.target.y };
                this.isMoving = true;
            } else {
                // Explorar para encontrar compañía
                this.exploreBehavior(deltaTime);
                return;
            }
        }
        
        if (this.target) {
            // Acercarse pero no encimar
            const dist = Utils.distance(this.x, this.y, this.target.x, this.target.y);
            
            if (dist > 50) {
                this.moveToTarget(deltaTime);
            } else {
                // Interactuar
                this.idleTime += deltaTime;
                if (this.idleTime > 120) {
                    this.needs.social += 25;
                    this.needs.social = Math.min(this.needs.social, 100);
                    
                    // Buscar el NPC real con el que interactuó
                    const nearbyNPCs = this.findNearbyNPCs(60);
                    for (const other of nearbyNPCs) {
                        const currentRelation = this.memory.relationships.get(other.id) || 0;
                        this.memory.relationships.set(other.id, currentRelation + 1);
                        
                        this.memory.conversations.push({
                            with: other.name,
                            time: this.world.time,
                            day: this.world.day
                        });
                    }
                    
                    this.idleTime = 0;
                    this.setState(NPC_STATES.IDLE);
                }
            }
        }
    }
    
    workBehavior(deltaTime) {
        // Ir a zona de trabajo
        if (!this.target) {
            const cityZones = this.world.getZonesByType('city');
            if (cityZones.length > 0) {
                const zone = cityZones[0];
                this.target = {
                    x: Utils.randomBetween(zone.x * CONFIG.TILE_SIZE, (zone.x + zone.w) * CONFIG.TILE_SIZE),
                    y: Utils.randomBetween(zone.y * CONFIG.TILE_SIZE, (zone.y + zone.h) * CONFIG.TILE_SIZE)
                };
                this.isMoving = true;
            }
        }
        
        if (this.target) {
            this.moveToTarget(deltaTime);
            
            if (this.isAtTarget()) {
                this.idleTime += deltaTime;
                
                // Dejar de trabajar si es noche o si se cansó
                if (this.world.getTimeOfDay() === 'night' || this.needs.energy < 40) {
                    this.setState(NPC_STATES.RESTING);
                } else if (this.idleTime > 200) {
                    this.target = null;
                    this.idleTime = 0;
                }
            }
        }
    }
    
    moveToTarget(deltaTime) {
        if (!this.target) return;
        
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 5) {
            this.x = this.target.x;
            this.y = this.target.y;
            this.isMoving = false;
            return;
        }
        
        // Normalizar dirección
        const speed = this.speed * deltaTime;
        const moveX = (dx / distance) * speed;
        const moveY = (dy / distance) * speed;
        
        // Verificar si el nuevo lugar es caminable
        const newX = this.x + moveX;
        const newY = this.y + moveY;
        
        if (this.world.isWalkable(newX, newY)) {
            this.x = newX;
            this.y = newY;
            this.direction = { x: dx / distance, y: dy / distance };
        } else {
            // Intentar deslizarse alrededor del obstáculo
            if (this.world.isWalkable(newX, this.y)) {
                this.x = newX;
            } else if (this.world.isWalkable(this.x, newY)) {
                this.y = newY;
            } else {
                // No puede moverse, buscar nuevo target
                this.target = null;
                this.isMoving = false;
            }
        }
    }
    
    isAtTarget() {
        if (!this.target) return false;
        return Utils.distance(this.x, this.y, this.target.x, this.target.y) < 15;
    }
    
    findNearbyNPCs(radius) {
        return this.world.npcs.filter(npc => 
            npc !== this && Utils.distance(this.x, this.y, npc.x, npc.y) < radius
        );
    }
    
    updateMemory() {
        const tx = Math.floor(this.x / CONFIG.TILE_SIZE);
        const ty = Math.floor(this.y / CONFIG.TILE_SIZE);
        const key = `${tx},${ty}`;
        
        if (!this.memory.explored.has(key)) {
            this.memory.explored.add(key);
            
            const tile = this.world.getTile(this.x, this.y);
            if (tile && tile.resource) {
                const location = {
                    x: tx * CONFIG.TILE_SIZE,
                    y: ty * CONFIG.TILE_SIZE,
                    type: tile.type,
                    resource: tile.resource.type
                };
                
                this.memory.knownLocations.push(location);
                
                // NUEVO: Recordar dónde encontró comida
                if (tile.resource.type === 'food') {
                    this.memory.foodLocations.push(location);
                    // Limitar a las últimas 5
                    if (this.memory.foodLocations.length > 5) {
                        this.memory.foodLocations.shift();
                    }
                }
            }
        }
        
        // NUEVO: Recordar casa
        if (this.home && !this.memory.homeLocation) {
            this.memory.homeLocation = {
                x: this.home.x,
                y: this.home.y,
                id: this.home.id
            };
        }
    }
    
    // Ir a casa con pathfinding inteligente
    goingHomeBehavior(deltaTime) {
        if (!this.home) {
            this.setState(NPC_STATES.IDLE);
            return;
        }
        
        // Si ya llegamos
        if (this.isAtHome()) {
            const cycleInfo = this.world.getCycleInfo();
            if (cycleInfo.isNight) {
                this.setState(NPC_STATES.SLEEPING);
            } else {
                // Si es día pero fase de retorno, descansar en casa
                this.setState(NPC_STATES.RESTING);
            }
            return;
        }
        
        // Si no tenemos target o path, calcular uno
        if (!this.target && !this.path) {
            // Calcular si tenemos tiempo suficiente
            const cycleInfo = this.world.getCycleInfo();
            
            if (window.navGrid) {
                const path = window.navGrid.findPath(this.x, this.y, this.home.x, this.home.y);
                
                if (path && path.length > 1) {
                    // Calcular tiempo estimado de viaje
                    const estimatedTravelMs = this.calculateTravelTime(path);
                    
                    // Si no tenemos suficiente tiempo, ir más rápido o cancelar
                    if (!cycleInfo.isNight && cycleInfo.dayRemainingMs > 0) {
                        if (estimatedTravelMs >= cycleInfo.dayRemainingMs - 10000) {
                            // Apurarse - aumentar velocidad temporalmente
                            this.speed = CONFIG.NPC_SPEED * 1.5;
                            console.log(`⏰ ${this.name} se apura a casa. Tiempo: ${estimatedTravelMs.toFixed(0)}ms, Quedan: ${cycleInfo.dayRemainingMs.toFixed(0)}ms`);
                        }
                    }
                    
                    this.path = path.slice(1);
                    this.pathIndex = 0;
                    this.setState(NPC_STATES.WALKING_PATH);
                    return;
                }
            }
            
            // Fallback: ir directo si no hay pathfinding
            this.target = { x: this.home.x, y: this.home.y };
            this.isMoving = true;
        }
        
        // Moverse hacia casa
        if (this.target) {
            this.moveToTarget(deltaTime);
            if (this.isAtTarget()) {
                this.target = null;
            }
        }
    }
    
    // Calcular tiempo estimado de viaje en ms
    calculateTravelTime(path) {
        if (!path || path.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < path.length; i++) {
            totalDistance += Utils.distance(path[i-1].x, path[i-1].y, path[i].x, path[i].y);
        }
        
        // Convertir a ms: distancia / velocidad * 16.67ms por frame
        return (totalDistance / CONFIG.NPC_SPEED) * 16.67;
    }
    
    // Verificar si está en casa
    isAtHome() {
        if (!this.home) return false;
        return Utils.distance(this.x, this.y, this.home.x, this.home.y) < 30;
    }
    
    // Nuevo: Dormir en casa
    sleepingBehavior(deltaTime) {
        if (!this.home) {
            this.setState(NPC_STATES.IDLE);
            return;
        }
        
        this.idleTime += deltaTime;
        
        // Recuperar energía
        this.needs.energy += 1.5 * deltaTime;
        this.needs.energy = Math.min(this.needs.energy, 100);
        
        // Hambre baja lentamente mientras duerme
        this.needs.hunger -= 0.02 * deltaTime;
        this.needs.hunger = Math.max(this.needs.hunger, 0);
        
        // Despertar si es de día y tiene suficiente energía
        const hour = this.world.hour;
        if (hour >= 6 && this.needs.energy > 75) {
            this.setState(NPC_STATES.IDLE);
        }
    }
    
    // Nuevo: Seguir path calculado
    walkingPathBehavior(deltaTime) {
        if (!this.path || this.pathIndex >= this.path.length) {
            this.path = null;
            this.pathIndex = 0;
            
            // Llegamos al destino
            if (this.state === NPC_STATES.GOING_HOME || this.state === NPC_STATES.SLEEPING) {
                this.setState(NPC_STATES.SLEEPING);
            } else {
                this.setState(NPC_STATES.IDLE);
            }
            return;
        }
        
        const nextPoint = this.path[this.pathIndex];
        const dx = nextPoint.x - this.x;
        const dy = nextPoint.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) {
            this.pathIndex++;
            return;
        }
        
        const speed = this.speed * deltaTime;
        const moveX = (dx / distance) * speed;
        const moveY = (dy / distance) * speed;
        
        this.x += moveX;
        this.y += moveY;
        this.direction = { x: dx / distance, y: dy / distance };
        this.isMoving = true;
    }
    
    // Fix: Separación de NPCs - evitar amontonamiento
    separateFromOtherNPCs() {
        const SEPARATION_DISTANCE = 25;
        let moveX = 0;
        let moveY = 0;
        let count = 0;
        
        for (const other of this.world.npcs) {
            if (other === this) continue;
            
            const dist = Utils.distance(this.x, this.y, other.x, other.y);
            if (dist < SEPARATION_DISTANCE && dist > 0) {
                const dx = (this.x - other.x) / dist;
                const dy = (this.y - other.y) / dist;
                moveX += dx;
                moveY += dy;
                count++;
            }
        }
        
        if (count > 0) {
            this.x += (moveX / count) * 2;
            this.y += (moveY / count) * 2;
        }
    }
    
    // Método requerido por engine.js para interacciones
    interact(otherNpc) {
        if (!otherNpc) return;
        
        // Mejorar relación con el otro NPC
        const currentRelation = this.memory.relationships.get(otherNpc.id) || 0;
        this.memory.relationships.set(otherNpc.id, currentRelation + 1);
        
        // Satisfacer necesidad social
        this.needs.social = Math.min(this.needs.social + 10, 100);
        
        // Guardar conversación en memoria
        this.memory.conversations.push({
            with: otherNpc.name,
            time: this.world.time,
            day: this.world.day
        });
        
        // Limitar memoria de conversaciones a las últimas 50
        if (this.memory.conversations.length > 50) {
            this.memory.conversations.shift();
        }
    }
}
