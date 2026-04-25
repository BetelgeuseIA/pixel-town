// main.js - Punto de entrada con navegación inteligente

// Inicializar sistema de navegación
const navGrid = new NavGrid();

// Inicializar mundo
const world = new World(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);

// Asignar casas a NPCs
const houses = NAV.ZONES.houses;

// Crear NPCs - spawnear cerca de sus casas
world.npcs = [];
for (let i = 0; i < CONFIG.NPC_COUNT; i++) {
    const house = houses[i % houses.length];
    
    // Spawnear cerca de la puerta de la casa
    const spawnX = house.door.x + Utils.randomBetween(-20, 20);
    const spawnY = house.door.y + Utils.randomBetween(-20, 20);
    
    const npc = new NPC(i, spawnX, spawnY, world);
    
    // Asignar casa
    npc.home = {
        id: house.id,
        x: house.door.x,
        y: house.door.y,
        houseX: house.x,
        houseY: house.y,
        houseW: house.w,
        houseH: house.h
    };
    
    world.npcs.push(npc);
}

// Exponer navGrid para el engine
window.navGrid = navGrid;

// Inicializar motor
const engine = new Engine('game-canvas');
engine.init(world);

// Variable global para NPC seleccionado
let selectedNPC = null;
let dialogueHistory = [];
const MAX_HISTORY = 20;

// Callback cuando se selecciona un NPC
window.onNPCSelected = (npc) => {
    selectedNPC = npc;
    updateDialoguePanel();
};

// Callback cuando NPCs interactúan
window.onNPCDialogue = (npc1, npc2, phrase) => {
    addDialogueEntry(npc1, npc2, phrase);
};

function addDialogueEntry(speaker, listener, message) {
    const entry = {
        speaker: speaker.name,
        listener: listener?.name,
        message: message,
        time: `${Utils.formatTime(world.hour)}`,
        day: world.day,
        color: speaker.color
    };
    
    dialogueHistory.unshift(entry);
    if (dialogueHistory.length > MAX_HISTORY) {
        dialogueHistory.pop();
    }
    
    if (selectedNPC && (selectedNPC.name === speaker.name || selectedNPC.name === listener?.name)) {
        updateDialoguePanel();
    }
}

function updateDialoguePanel() {
    const content = document.getElementById('dialogue-content');
    if (!content) return;
    
    if (!selectedNPC) {
        content.innerHTML = '<p class="dialogue-placeholder">Haz click en un habitante para ver su historia...</p>';
        return;
    }
    
    let html = `
        <div id="npc-stats">
            <h3 style="color: ${selectedNPC.color};">👤 ${selectedNPC.name}</h3>
            <p style="font-size: 12px; color: #a0a0b0; margin-bottom: 8px;">${selectedNPC.getStateDescription()} | ${selectedNPC.personality.name}</p>
            <p style="font-size: 11px; color: #888; margin-bottom: 8px;">🏠 Casa: ${selectedNPC.home?.id || 'Sin casa'}</p>
            
            <div class="stat-bar">
                <div class="stat-bar-label">
                    <span>🍎 Hambre</span>
                    <span>${Math.round(selectedNPC.needs.hunger)}%</span>
                </div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill stat-hunger" style="width: ${selectedNPC.needs.hunger}%"></div>
                </div>
            </div>
            
            <div class="stat-bar">
                <div class="stat-bar-label">
                    <span>⚡ Energía</span>
                    <span>${Math.round(selectedNPC.needs.energy)}%</span>
                </div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill stat-energy" style="width: ${selectedNPC.needs.energy}%"></div>
                </div>
            </div>
            
            <div class="stat-bar">
                <div class="stat-bar-label">
                    <span>💬 Social</span>
                    <span>${Math.round(selectedNPC.needs.social)}%</span>
                </div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill stat-social" style="width: ${selectedNPC.needs.social}%"></div>
                </div>
            </div>
        </div>
    `;
    
    const npcConversations = dialogueHistory.filter(d => 
        d.speaker === selectedNPC.name || d.listener === selectedNPC.name
    );
    
    if (npcConversations.length > 0) {
        html += '<div style="margin-top: 10px;"><strong style="font-size: 11px; color: #888;">📝 Conversaciones recientes:</strong></div>';
        
        npcConversations.slice(0, 5).forEach(conv => {
            html += `
                <div class="dialogue-entry">
                    <div>
                        <span class="npc-name" style="color: ${conv.color};">${conv.speaker}</span>
                        <span class="time">Día ${conv.day}, ${conv.time}</span>
                    </div>
                    <div class="message">"${conv.message}"</div>
                </div>
            `;
        });
    } else {
        html += '<p style="color: #888; font-size: 12px; margin-top: 10px;">Este habitante aún no ha conversado con nadie.</p>';
    }
    
    content.innerHTML = html;
    content.scrollTop = 0;
}

// Controles
document.getElementById('btn-pause').addEventListener('click', () => {
    const paused = engine.togglePause();
    const btn = document.getElementById('btn-pause');
    btn.textContent = paused ? '▶️ Reanudar' : '⏸️ Pausa';
    btn.style.borderColor = paused ? '#27ae60' : '#f39c12';
});

document.getElementById('btn-speed').addEventListener('click', () => {
    const speed = engine.cycleSpeed();
    const label = speed === 0.5 ? '½x' : speed === 1 ? 'x1' : speed === 2 ? 'x2' : 'x4';
    document.getElementById('btn-speed').textContent = `⚡ ${label}`;
});

document.getElementById('btn-interact').addEventListener('click', () => {
    if (!selectedNPC) {
        addDialogueEntry(
            { name: 'Sistema', color: '#888' },
            null,
            'Selecciona un habitante primero para interactuar.'
        );
        updateDialoguePanel();
        return;
    }
    
    const nearbyNPCs = selectedNPC.findNearbyNPCs(100);
    if (nearbyNPCs.length > 0) {
        const target = nearbyNPCs[0];
        selectedNPC.setState(NPC_STATES.SOCIALIZING);
        selectedNPC.target = { x: target.x, y: target.y };
        selectedNPC.isMoving = true;
        
        const phrases = [
            "¡Hola! Me alegra verte por aquí.",
            "¿Tienes planes para hoy?",
            "El pueblo está creciendo mucho.",
            "¿Has encontrado recursos interesantes?",
            "Necesito hablar con alguien..."
        ];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        addDialogueEntry(selectedNPC, target, phrase);
        updateDialoguePanel();
    } else {
        addDialogueEntry(
            selectedNPC,
            null,
            "No hay nadie cerca con quien hablar..."
        );
        updateDialoguePanel();
    }
});

// Sistema de ayuda
const helpOverlay = document.getElementById('help-overlay');
document.getElementById('btn-help').addEventListener('click', () => {
    helpOverlay.classList.remove('hidden');
});

document.getElementById('btn-close-help').addEventListener('click', () => {
    helpOverlay.classList.add('hidden');
});

helpOverlay.addEventListener('click', (e) => {
    if (e.target === helpOverlay) {
        helpOverlay.classList.add('hidden');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        helpOverlay.classList.add('hidden');
    }
    // Toggle debug nav grid con tecla 'D'
    if (e.key === 'd' || e.key === 'D') {
        engine.debugNav = !engine.debugNav;
        console.log('Debug nav grid:', engine.debugNav ? 'ON' : 'OFF');
    }
});

// Iniciar
console.log('🎮 Pixel Town iniciado');
console.log(`📊 Mapa: ${NAV.MAP_WIDTH}x${NAV.MAP_HEIGHT} pixeles`);
console.log(`👥 NPCs: ${CONFIG.NPC_COUNT} con casas asignadas`);

window.world = world;
window.engine = engine;
window.navGrid = navGrid;

engine.start();
