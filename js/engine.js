class Engine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.running = false;
        this.paused = false;
        this.speed = 1;
        this.lastTime = 0;
        this.initialized = false;
        
        this.selectedNPC = null;
        this.hoverNPC = null;
        
        this.tileCache = new Map();
        
        // Variables para pan/arrastre
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.cameraStart = { x: 0, y: 0 };
        this.dragThreshold = 5; // píxeles mínimos para considerar drag vs click
        this.hasDragged = false;
        
        this.debugNav = false;
        this.lastPinchDist = 0;
        
        this.setupEvents();
    }
    
    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.canvas.style.width = parent.clientWidth + 'px';
        this.canvas.style.height = parent.clientHeight + 'px';
        
        // Recalcular cámara si ya está inicializado
        if (this.initialized && this.world) {
            this.fitWorldToView();
        }
    }
    
    fitWorldToView() {
        if (!this.world) return;
        
        const w = this.worldPixelWidth || NAV.MAP_WIDTH;
        const h = this.worldPixelHeight || NAV.MAP_HEIGHT;
        
        const isMobile = window.innerWidth <= 768;
        
        const zoomX = (this.canvas.width * 0.95) / w;
        const zoomY = (this.canvas.height * 0.95) / h;
        let zoom = Math.min(zoomX, zoomY);
        
        // En móvil, mostrar más área para ver NPCs
        if (isMobile) {
            zoom = zoom * 0.8;
        }
        
        this.camera = {
            x: (this.canvas.width - w * zoom) / 2,
            y: (this.canvas.height - h * zoom) / 2,
            zoom: zoom
        };
    }
    
    // Sistema de debug para ciclos
    init(world) {
        this.world = world;
        this.npcs = world.npcs;
        this.initialized = true;
        this.preRenderTiles();
        
        // Inicializar tracking de fases
        this.lastPhase = 'day';
        this.phaseStartTime = performance.now();
        
        // Cargar imagen del mapa
        this.mapImage = new Image();
        this.mapReady = false;
        this.mapImage.onload = () => {
            this.mapReady = true;
            this.worldPixelWidth = this.mapImage.width;
            this.worldPixelHeight = this.mapImage.height;
            console.log(`🗺️ Map loaded: ${this.worldPixelWidth}x${this.worldPixelHeight}`);
            this.fitWorldToView();
        };
        this.mapImage.src = 'assets/pixel-town-map-background.png';
        
        // Fallback
        this.worldPixelWidth = NAV.MAP_WIDTH;
        this.worldPixelHeight = NAV.MAP_HEIGHT;
        this.fitWorldToView();
    }
    
    // Debug de fases del ciclo
    checkPhaseChanges() {
        if (!this.world) return;
        
        const cycleInfo = this.world.getCycleInfo();
        let currentPhase = 'day';
        
        if (cycleInfo.isNight) {
            currentPhase = 'night';
        } else if (cycleInfo.isReturnPhase) {
            currentPhase = 'return';
        }
        
        if (currentPhase !== this.lastPhase) {
            const now = performance.now();
            const elapsed = now - this.phaseStartTime;
            
            switch(currentPhase) {
                case 'day':
                    console.log(`🌅 NUEVO DÍA - Ciclo completado en ${(elapsed/1000).toFixed(1)}s`);
                    break;
                case 'return':
                    console.log(`🏠 FASE DE RETORNO - NPCs deben volver a casa. Quedan: ${(cycleInfo.dayRemainingMs/1000).toFixed(1)}s`);
                    break;
                case 'night':
                    console.log(`🌙 NOCHE - Duración: ${(CONFIG.NIGHT_DURATION_MS/1000).toFixed(0)}s`);
                    break;
            }
            
            this.lastPhase = currentPhase;
            this.phaseStartTime = now;
        }
    }
    
    setupEvents() {
        // Mouse down - iniciar posible pan o click
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.isPanning = true;
            this.hasDragged = false;
            this.panStart = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            this.cameraStart = {
                x: this.camera.x,
                y: this.camera.y
            };
            this.canvas.style.cursor = 'grabbing';
        });
        
        // Mouse move - pan o hover
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Si estamos arrastrando (panning)
            if (this.isPanning) {
                const dx = mouseX - this.panStart.x;
                const dy = mouseY - this.panStart.y;
                
                // Si nos movemos más del threshold, es un drag, no un click
                if (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold) {
                    this.hasDragged = true;
                    this.canvas.style.cursor = 'grabbing';
                }
                
                // Aplicar pan a la cámara
                if (this.hasDragged) {
                    this.camera.x = this.cameraStart.x + dx;
                    this.camera.y = this.cameraStart.y + dy;
                }
                return;
            }
            
            // Hover sobre NPCs (solo si no estamos panning)
            const pos = this.getMousePos(e);
            this.hoverNPC = this.findNPCAt(pos.x, pos.y);
            this.canvas.style.cursor = this.hoverNPC ? 'pointer' : 'grab';
        });
        
        // Mouse up - finalizar pan o procesar click
        this.canvas.addEventListener('mouseup', (e) => {
            if (!this.isPanning) return;
            
            this.isPanning = false;
            this.canvas.style.cursor = 'grab';
            
            // Si no arrastramos (fue un click simple)
            if (!this.hasDragged) {
                const pos = this.getMousePos(e);
                const clickedNPC = this.findNPCAt(pos.x, pos.y);
                
                if (clickedNPC) {
                    this.selectedNPC = clickedNPC;
                    if (window.onNPCSelected) {
                        window.onNPCSelected(clickedNPC);
                    }
                } else if (this.selectedNPC) {
                    this.selectedNPC.target = { x: pos.x, y: pos.y };
                    this.selectedNPC.setState(NPC_STATES.EXPLORING);
                    this.selectedNPC.isMoving = true;
                }
            }
            
            this.hasDragged = false;
        });
        
        // Mouse leave - cancelar pan
        this.canvas.addEventListener('mouseleave', () => {
            this.isPanning = false;
            this.hasDragged = false;
            this.canvas.style.cursor = 'grab';
        });
        
        // SOPORTE TÁCTIL PARA MÓVIL
        // Touch start
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.isPanning = true;
                this.hasDragged = false;
                this.panStart = {
                    x: touch.clientX - rect.left,
                    y: touch.clientY - rect.top
                };
                this.cameraStart = {
                    x: this.camera.x,
                    y: this.camera.y
                };
            }
        }, { passive: false });
        
        // Touch move
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && this.isPanning) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const touchX = touch.clientX - rect.left;
                const touchY = touch.clientY - rect.top;
                
                const dx = touchX - this.panStart.x;
                const dy = touchY - this.panStart.y;
                
                if (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold) {
                    this.hasDragged = true;
                }
                
                if (this.hasDragged) {
                    this.camera.x = this.cameraStart.x + dx;
                    this.camera.y = this.cameraStart.y + dy;
                }
            }
        }, { passive: false });
        
        // Touch end
        this.canvas.addEventListener('touchend', (e) => {
            if (!this.isPanning) return;
            
            this.isPanning = false;
            
            // Si no arrastramos, fue un tap
            if (!this.hasDragged) {
                const touch = e.changedTouches[0];
                const pos = this.getTouchPos(touch);
                const clickedNPC = this.findNPCAt(pos.x, pos.y);
                
                if (clickedNPC) {
                    this.selectedNPC = clickedNPC;
                    if (window.onNPCSelected) {
                        window.onNPCSelected(clickedNPC);
                    }
                } else if (this.selectedNPC) {
                    this.selectedNPC.target = { x: pos.x, y: pos.y };
                    this.selectedNPC.setState(NPC_STATES.EXPLORING);
                    this.selectedNPC.isMoving = true;
                }
            }
            
            this.hasDragged = false;
        });
        
        // Pinch zoom (dos dedos)
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                this.lastPinchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        }, { passive: true });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                
                if (this.lastPinchDist > 0) {
                    const scale = dist / this.lastPinchDist;
                    const newZoom = Utils.clamp(this.camera.zoom * scale, 0.3, 3);
                    
                    // Zoom hacia el centro entre los dos dedos
                    const rect = this.canvas.getBoundingClientRect();
                    const centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
                    const centerY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
                    
                    const worldX = (centerX - this.camera.x) / this.camera.zoom;
                    const worldY = (centerY - this.camera.y) / this.camera.zoom;
                    
                    this.camera.x = centerX - worldX * newZoom;
                    this.camera.y = centerY - worldY * newZoom;
                    this.camera.zoom = newZoom;
                }
                
                this.lastPinchDist = dist;
            }
        }, { passive: false });
        
        // Rueda del ratón - zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Factor de zoom
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Utils.clamp(this.camera.zoom * zoomFactor, 0.3, 3);
            
            // Zoom hacia el cursor
            const worldX = (mouseX - this.camera.x) / this.camera.zoom;
            const worldY = (mouseY - this.camera.y) / this.camera.zoom;
            
            this.camera.x = mouseX - worldX * newZoom;
            this.camera.y = mouseY - worldY * newZoom;
            this.camera.zoom = newZoom;
        });
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.camera.x) / this.camera.zoom,
            y: (e.clientY - rect.top - this.camera.y) / this.camera.zoom
        };
    }
    
    getTouchPos(touch) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (touch.clientX - rect.left - this.camera.x) / this.camera.zoom,
            y: (touch.clientY - rect.top - this.camera.y) / this.camera.zoom
        };
    }
    
    findNPCAt(x, y) {
        for (const npc of this.npcs) {
            if (Utils.distance(x, y, npc.x, npc.y) < 20) {
                return npc;
            }
        }
        return null;
    }
    
    start() {
        if (!this.initialized) {
            console.error('Engine no inicializado');
            return;
        }
        if (this.running) return;
        
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    stop() {
        this.running = false;
    }
    
    togglePause() {
        this.paused = !this.paused;
        if (!this.paused) this.lastTime = performance.now();
        return this.paused;
    }
    
    cycleSpeed() {
        this.speed = this.speed >= 4 ? 0.5 : this.speed * 2;
        return this.speed;
    }
    
    gameLoop(timestamp) {
        if (!this.running) return;
        
        const rawDelta = timestamp - this.lastTime;
        this.lastTime = timestamp;
        const deltaTime = Math.min(rawDelta / 16.67, 3);
        
        if (!this.paused) {
            this.world.update(deltaTime * this.speed);
            
            // Debug de fases del ciclo
            if (this.world) this.checkPhaseChanges();
            for (const npc of this.npcs) {
                npc.update(deltaTime * this.speed);
            }
            this.processInteractions();
        }
        
        this.render();
        this.updateUI();
        
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    processInteractions() {
        for (let i = 0; i < this.npcs.length; i++) {
            for (let j = i + 1; j < this.npcs.length; j++) {
                const npc1 = this.npcs[i];
                const npc2 = this.npcs[j];
                
                if (Utils.distance(npc1.x, npc1.y, npc2.x, npc2.y) < 40) {
                    if (npc1.state === NPC_STATES.SOCIALIZING && 
                        npc2.state === NPC_STATES.SOCIALIZING) {
                        npc1.interact(npc2);
                        npc2.interact(npc1);
                        
                        // Generar diálogo
                        if (window.onNPCDialogue) {
                            const phrase = this.generateDialogue(npc1, npc2);
                            window.onNPCDialogue(npc1, npc2, phrase);
                        }
                    }
                }
            }
        }
    }
    
    generateDialogue(npc1, npc2) {
        const phrases = [
            "¡Hola! ¿Cómo va tu día?",
            "Voy a buscar comida, ¿vienes?",
            "El bosque tiene muchos recursos hoy.",
            "Necesito descansar un poco.",
            "¿Has visto la zona nueva de la ciudad?",
            "Estoy explorando el mapa.",
            "Tengo mucha hambre...",
            "¡Qué bonito día hace!",
            "Escuché que hay comida en el centro.",
            "Me voy a dormir temprano hoy.",
            "¿Trabajas en algo interesante?",
            "La noche se acerca, deberíamos descansar."
        ];
        
        const contextPhrases = {
            'seeking_food': ["Tengo hambre, ¿sabes dónde hay comida?", "Busco algo para comer..."],
            'eating': ["Esta comida está deliciosa.", "Necesitaba esto."],
            'resting': ["Estoy descansando, hablamos luego.", "Qué sueño tengo..."],
            'working': ["Estoy ocupado trabajando.", "El trabajo no espera."],
            'exploring': ["Descubrí un lugar interesante.", "El mapa es más grande de lo que pensaba."]
        };
        
        const statePhrases = contextPhrases[npc1.state];
        if (statePhrases && Math.random() < 0.7) {
            return statePhrases[Math.floor(Math.random() * statePhrases.length)];
        }
        
        return phrases[Math.floor(Math.random() * phrases.length)];
    }
    
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Limpiar canvas
        ctx.fillStyle = '#1a0a1a';
        ctx.fillRect(0, 0, w, h);
        
        // Limitar cámara
        this.constrainCamera();
        
        ctx.save();
        ctx.translate(this.camera.x, this.camera.y);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        
        // Dibujar mapa primero
        if (this.mapReady) {
            ctx.drawImage(this.mapImage, 0, 0);
        }
        
        // Dibujar NPCs con sprites reales
        for (const npc of this.npcs) {
            this.renderNPC(ctx, npc);
        }
        
        ctx.restore();
        this.renderTimeOverlay(ctx);
        this.renderMiniMap(ctx);
    }
    
    renderPath(ctx, path) {
        if (!path || path.length < 2) return;
        
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Puntos del path
        ctx.fillStyle = '#00ff00';
        for (const point of path) {
            ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
        }
    }
    
    constrainCamera() {
        if (!this.world) return;
        
        const w = this.worldPixelWidth || (this.world.width * CONFIG.TILE_SIZE);
        const h = this.worldPixelHeight || (this.world.height * CONFIG.TILE_SIZE);
        
        const minX = Math.min(0, this.canvas.width - w * this.camera.zoom);
        const minY = Math.min(0, this.canvas.height - h * this.camera.zoom);
        const maxX = 0;
        const maxY = 0;
        
        this.camera.x = Utils.clamp(this.camera.x, minX, maxX);
        this.camera.y = Utils.clamp(this.camera.y, minY, maxY);
    }
    
    renderMiniMap(ctx) {
        if (!this.world) return;
        
        const miniMapSize = 120;
        const padding = 15;
        const x = this.canvas.width - miniMapSize - padding;
        const y = padding;
        
        const w = this.worldPixelWidth || (this.world.width * CONFIG.TILE_SIZE);
        const h = this.worldPixelHeight || (this.world.height * CONFIG.TILE_SIZE);
        const aspect = h / w;
        const mmH = miniMapSize * aspect;
        
        // Fondo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, miniMapSize, mmH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, miniMapSize, mmH);
        
        // NPCs
        const scaleX = miniMapSize / w;
        const scaleY = mmH / h;
        
        for (const npc of this.npcs) {
            const miniX = x + (npc.x / (this.world.width * CONFIG.TILE_SIZE)) * miniMapSize;
            const miniY = y + (npc.y / (this.world.height * CONFIG.TILE_SIZE)) * mmH;
            ctx.fillStyle = npc === this.selectedNPC ? '#f1c40f' : npc.color;
            ctx.fillRect(miniX - 1, miniY - 1, 3, 3);
        }
        
        // Área visible
        const viewX = x + ((-this.camera.x / this.camera.zoom) / w) * miniMapSize;
        const viewY = y + ((-this.camera.y / this.camera.zoom) / h) * mmH;
        const viewW = (this.canvas.width / this.camera.zoom) / w * miniMapSize;
        const viewH = (this.canvas.height / this.camera.zoom) / h * mmH;
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.strokeRect(viewX, viewY, viewW, viewH);
    }
    
    preRenderTiles() {
        const tileSize = CONFIG.TILE_SIZE;
        for (const type of ['grass', 'water', 'forest', 'city', 'road', 'sand']) {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = tileSize;
            offCanvas.height = tileSize;
            const offCtx = offCanvas.getContext('2d');
            
            this.drawPixelTile(offCtx, type, 0, 0, tileSize);
            this.tileCache.set(type, offCanvas);
        }
    }
    
    drawPixelTile(ctx, type, x, y, size) {
        switch(type) {
            case 'grass':
                this.drawGrassTile(ctx, x, y, size);
                break;
            case 'water':
                this.drawWaterTile(ctx, x, y, size);
                break;
            case 'forest':
                this.drawForestTile(ctx, x, y, size);
                break;
            case 'city':
                this.drawCityTile(ctx, x, y, size);
                break;
            case 'road':
                this.drawRoadTile(ctx, x, y, size);
                break;
            case 'sand':
                this.drawSandTile(ctx, x, y, size);
                break;
        }
    }
    
    drawGrassTile(ctx, x, y, size) {
        // Base verde oscuro
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(x, y, size, size);
        
        // Variación de hierba
        ctx.fillStyle = '#3d7a37';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
        
        // Puntos de hierba
        ctx.fillStyle = '#4d9a47';
        const positions = [[4,4], [12,8], [8,14], [16,6], [20,18], [24,10]];
        for (const [px, py] of positions) {
            if (px < size && py < size) {
                ctx.fillRect(x + px, y + py, 2, 2);
            }
        }
        
        // Sombra sutil
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(x, y + size - 2, size, 2);
    }
    
    drawWaterTile(ctx, x, y, size) {
        // Base azul
        ctx.fillStyle = '#1a5276';
        ctx.fillRect(x, y, size, size);
        
        // Ondas
        ctx.fillStyle = '#2980b9';
        ctx.fillRect(x + 4, y + 8, size - 8, 2);
        ctx.fillRect(x + 2, y + 16, size - 4, 2);
        ctx.fillRect(x + 6, y + 24, size - 10, 2);
        
        // Brillo
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + 4, y + 6, 4, 2);
        ctx.fillRect(x + 12, y + 14, 3, 2);
    }
    
    drawForestTile(ctx, x, y, size) {
        // Base
        ctx.fillStyle = '#1e3a1e';
        ctx.fillRect(x, y, size, size);
        
        // Árbol pixel-art
        ctx.fillStyle = '#2d5016';
        ctx.fillRect(x + 10, y + 10, 12, 12); // Copa
        ctx.fillRect(x + 14, y + 22, 4, 8);   // Tronco
        
        // Detalles
        ctx.fillStyle = '#3d7026';
        ctx.fillRect(x + 8, y + 8, 4, 4);
        ctx.fillRect(x + 20, y + 12, 4, 4);
    }
    
    drawCityTile(ctx, x, y, size) {
        // Base
        ctx.fillStyle = '#5d6d7e';
        ctx.fillRect(x, y, size, size);
        
        // Edificio
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(x + 6, y + 8, 20, 22);
        
        // Ventanas
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(x + 10, y + 12, 4, 4);
        ctx.fillRect(x + 18, y + 12, 4, 4);
        ctx.fillRect(x + 10, y + 20, 4, 4);
        
        // Techo
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(x + 4, y + 4, 24, 4);
    }
    
    drawRoadTile(ctx, x, y, size) {
        // Base
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(x, y, size, size);
        
        // Línea central
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(x + 12, y, 8, size);
        
        // Marcas
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(x + 14, y + 8, 4, 6);
        ctx.fillRect(x + 14, y + 22, 4, 6);
    }
    
    drawSandTile(ctx, x, y, size) {
        // Base arena
        ctx.fillStyle = '#9a7b4f';
        ctx.fillRect(x, y, size, size);
        
        // Variación
        ctx.fillStyle = '#aa8b5f';
        ctx.fillRect(x + 4, y + 4, 8, 6);
        ctx.fillRect(x + 16, y + 14, 6, 8);
        
        // Brillo
        ctx.fillStyle = '#ba9b6f';
        ctx.fillRect(x + 8, y + 8, 4, 4);
    }
    
    renderWorld(ctx) {
        const tileSize = CONFIG.TILE_SIZE;
        const zoom = this.camera.zoom;
        
        // Calcular rango visible basado en la cámara
        const startX = Math.floor((-this.camera.x / zoom) / tileSize);
        const startY = Math.floor((-this.camera.y / zoom) / tileSize);
        const endX = startX + Math.ceil((this.canvas.width / zoom) / tileSize) + 1;
        const endY = startY + Math.ceil((this.canvas.height / zoom) / tileSize) + 1;
        
        for (let y = Math.max(0, startY); y < Math.min(this.world.height, endY); y++) {
            for (let x = Math.max(0, startX); x < Math.min(this.world.width, endX); x++) {
                const tile = this.world.tiles[y][x];
                const cached = this.tileCache.get(tile.type);
                
                if (cached) {
                    ctx.drawImage(cached, x * tileSize, y * tileSize);
                } else {
                    this.drawPixelTile(ctx, tile.type, x * tileSize, y * tileSize, tileSize);
                }
            }
        }
    }
    
    renderDecorations(ctx) {
        // Dibujar árboles adicionales en tiles forest
        const tileSize = CONFIG.TILE_SIZE;
        for (const zone of this.world.zones) {
            if (zone.type === 'forest') {
                for (let y = zone.y; y < zone.y + zone.h; y++) {
                    for (let x = zone.x; x < zone.x + zone.w; x++) {
                        if (Math.random() < 0.3) {
                            const tx = x * tileSize + tileSize / 2;
                            const ty = y * tileSize + tileSize / 2;
                            this.drawTree(ctx, tx, ty);
                        }
                    }
                }
            }
        }
    }
    
    drawTree(ctx, x, y) {
        // Tronco
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(x - 2, y, 4, 12);
        
        // Copa (3 niveles)
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(x - 8, y - 8, 16, 8);
        ctx.fillStyle = '#3d7a37';
        ctx.fillRect(x - 6, y - 14, 12, 6);
        ctx.fillStyle = '#4d9a47';
        ctx.fillRect(x - 4, y - 18, 8, 4);
    }
    
    renderNPC(ctx, npc) {
        const x = npc.x;
        const y = npc.y;
        
        // Si el NPC tiene sprite cargado, usarlo
        if (npc.spriteLoaded && npc.sprite && npc.sprite.complete && npc.sprite.naturalWidth > 0) {
            const frameWidth = 32;
            const frameHeight = 32;
            
            // Calcular dirección (0=down, 1=left, 2=right, 3=up)
            let direction = 0;
            if (Math.abs(npc.direction.x) > Math.abs(npc.direction.y)) {
                direction = npc.direction.x > 0 ? 2 : 1; // right : left
            } else {
                direction = npc.direction.y > 0 ? 0 : 3; // down : up
            }
            
            // Frame de animación (0, 1, 2) para caminar
            const frame = npc.isMoving ? Math.floor(npc.animationFrame / 8) % 3 : 1;
            
            // Dibujar sprite
            const spriteX = frame * frameWidth;
            const spriteY = (npc.spriteRow * 4 + direction) * frameHeight;
            
            ctx.drawImage(
                npc.sprite,
                spriteX, spriteY,
                frameWidth, frameHeight,
                x - 16, y - 16,
                32, 32
            );
        } else {
            // Fallback: dibujar círculo de color mientras carga el sprite
            ctx.fillStyle = npc.color;
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();
            
            // Borde para distinguirlo
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Indicador de carga
            ctx.fillStyle = 'white';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('...', x, y - 18);
        }
        
        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y + 14, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Selección
        if (npc === this.selectedNPC) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 18, y - 18, 36, 36);
        }
        
        // Nombre
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 3;
        ctx.fillText(npc.name.split(' ')[0], x, y - 22);
        ctx.shadowBlur = 0;
    }
    
    darkenColor(color, factor) {
        // Simple función para oscurecer colores
        const hex = color.replace('#', '');
        const r = Math.floor(parseInt(hex.substr(0, 2), 16) * factor);
        const g = Math.floor(parseInt(hex.substr(2, 2), 16) * factor);
        const b = Math.floor(parseInt(hex.substr(4, 2), 16) * factor);
        return `rgb(${r},${g},${b})`;
    }
    
    renderTimeOverlay(ctx) {
        const timeOfDay = this.world.getTimeOfDay();
        
        if (timeOfDay === 'night') {
            ctx.fillStyle = 'rgba(10, 10, 40, 0.5)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Estrellas
            ctx.fillStyle = 'white';
            for (let i = 0; i < 20; i++) {
                const sx = (i * 73) % this.canvas.width;
                const sy = (i * 37) % (this.canvas.height / 2);
                ctx.fillRect(sx, sy, 1, 1);
            }
        } else if (timeOfDay === 'dusk') {
            ctx.fillStyle = 'rgba(100, 50, 20, 0.25)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (timeOfDay === 'dawn') {
            ctx.fillStyle = 'rgba(255, 180, 100, 0.15)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    updateUI() {
        const timeDisplay = document.getElementById('time-badge');
        if (timeDisplay) {
            const cycleInfo = this.world.getCycleInfo();
            const timeOfDay = this.world.getTimeOfDay();
            const icon = timeOfDay === 'day' ? '☀️' : timeOfDay === 'night' ? '🌙' : '🌅';
            
            let phaseText = '';
            if (cycleInfo.isNight) {
                phaseText = 'NOCHE';
            } else if (cycleInfo.isReturnPhase) {
                phaseText = 'VOLVER A CASA';
            } else if (this.world.isEventActive()) {
                phaseText = '🎉 FESTIVAL';
            } else {
                phaseText = 'DÍA';
            }
            
            timeDisplay.textContent = `${icon} Día ${this.world.day} - ${Utils.formatTime(this.world.hour)} | ${phaseText}`;
        }
    }
}
