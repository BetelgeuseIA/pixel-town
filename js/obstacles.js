// obstacles.js - Sistema de obstáculos basado en análisis del mapa
// NO MODIFICA el movimiento existente, solo añade información

const Obstacles = {
    // Colores detectados del mapa (promedios)
    COLORS: {
        WATER: { r: 66, g: 144, b: 159 },      // Agua - No caminable
        MOUNTAIN: { r: 94, g: 130, b: 67 },    // Montaña - No caminable
        HOUSE: { r: 75, g: 135, b: 62 },       // Casa - No caminable (excepto dueño)
        ROAD: { r: 59, g: 134, b: 155 },      // Camino - Caminable
        FOREST: { r: 82, g: 123, b: 91 }      // Bosque - Caminable pero lento
    },
    
    // Tolerancia para detección de color
    TOLERANCE: 40,
    
    // Cache de obstáculos (optimización)
    cache: new Map(),
    
    // Verificar si un pixel es caminable (basado en color)
    isWalkable(x, y, canvas) {
        if (!canvas) return true; // Si no hay canvas, asumir caminable
        
        const key = \`\${Math.floor(x)},\${Math.floor(y)}\`;
        if (this.cache.has(key)) return this.cache.get(key);
        
        // Por defecto, asumir caminable (no bloquear si hay error)
        let result = true;
        
        try {
            const ctx = canvas.getContext('2d');
            const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
            const [r, g, b] = pixel;
            
            // Verificar agua (azul dominante)
            if (this.isColorMatch(r, g, b, this.COLORS.WATER)) {
                result = false;
            }
            // Verificar montaña (oscuro)
            else if (this.isColorMatch(r, g, b, this.COLORS.MOUNTAIN)) {
                result = false;
            }
            // Verificar casa (verde específico)
            else if (this.isColorMatch(r, g, b, this.COLORS.HOUSE)) {
                result = false;
            }
        } catch (e) {
            // Si hay error al leer pixel, no bloquear
            console.warn('Error leyendo pixel:', e);
        }
        
        this.cache.set(key, result);
        return result;
    },
    
    // Comparar color con tolerancia
    isColorMatch(r, g, b, target) {
        return Math.abs(r - target.r) < this.TOLERANCE &&
               Math.abs(g - target.g) < this.TOLERANCE &&
               Math.abs(b - target.b) < this.TOLERANCE;
    },
    
    // Limpiar cache
    clearCache() {
        this.cache.clear();
    }
};

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Obstacles;
}
