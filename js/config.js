const CONFIG = {
    // Canvas
    TILE_SIZE: 32,
    MAP_WIDTH: 88,   // 2816/32 = 88 tiles para coincidir con el mapa real
    MAP_HEIGHT: 48,  // 1536/32 = 48 tiles para coincidir con el mapa real
    
    // Sistema de tiempo real
    DAY_DURATION_MS: 10 * 60 * 1000,      // 10 minutos de día
    NIGHT_DURATION_MS: 1 * 60 * 1000,       // 1 minuto de noche
    RETURN_HOME_BUFFER_MS: 90 * 1000,      // 90 segundos para volver
    
    // Calcular totales
    TOTAL_CYCLE_MS: 11 * 60 * 1000,        // 11 minutos total
    
    // Conversiones (usar en runtime)
    get DAY_LENGTH() { 
        // Frames a 60fps para 10 minutos
        return (this.DAY_DURATION_MS / 1000) * 60;
    },
    
    get NIGHT_LENGTH() {
        // Frames para 1 minuto
        return (this.NIGHT_DURATION_MS / 1000) * 60;
    },
    
    get RETURN_BUFFER() {
        // Frames para 90 segundos
        return (this.RETURN_HOME_BUFFER_MS / 1000) * 60;
    },
    
    HOURS_PER_DAY: 24,
    
    // NPCs
    NPC_COUNT: 8,
    NPC_SPEED: 1.5,
    
    // Necesidades - ajustadas para ciclos de 11 minutos
    HUNGER_DECAY: 0.0005,
    ENERGY_DECAY: 0.0003,
    HUNGER_THRESHOLD: 30,
    ENERGY_THRESHOLD: 25,
    
    // Colores pixel-art
    COLORS: {
        GRASS: '#2d5a27',
        WATER: '#1a5276',
        FOREST: '#1e3a1e',
        CITY: '#5d6d7e',
        ROAD: '#7f8c8d',
        SAND: '#9a7b4f',
        NIGHT_OVERLAY: 'rgba(10, 10, 40, 0.5)',
        DAWN_OVERLAY: 'rgba(255, 180, 100, 0.15)'
    }
};
