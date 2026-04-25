# 📋 ESTUDIO COMPLETO - PIXEL TOWN
## Análisis y Plan de Mejoras

---

## 1. ESTADO ACTUAL DEL SISTEMA

### ✅ LO QUE FUNCIONA:
- ✅ Canvas con mapa pixel-art generado por IA
- ✅ Sistema de cámara con pan/zoom/mini-mapa
- ✅ 8 NPCs con estados básicos (explorar, comer, dormir, socializar)
- ✅ Pathfinding A* con evasión de obstáculos
- ✅ Ciclo día/noche de 10 minutos + 1 minuto noche
- ✅ Fase de retorno a casa (90 segundos buffer)
- ✅ Casas asignadas a cada NPC
- ✅ Panel de diálogo y stats
- ✅ Controles de pausa/velocidad/ayuda

### ❌ PROBLEMAS IDENTIFICADOS:

#### CRÍTICOS:
1. **NPCs atascados**: El pathfinding A* a veces genera caminos imposibles o NPCs se quedan quietos
2. **Colisiones NPC-NPC**: Los NPCs se amontonan unos encima de otros
3. **Rendimiento**: El debug nav grid ralentiza el juego cuando está activo
4. **Falta de persistencia**: No hay guardado de progreso

#### MEDIOS:
5. **Mundo estático**: El mapa no cambia, no hay construcción
6. **NPCs sin memoria real**: No recuerdan dónde encontraron comida
7. **Economía inexistente**: No hay intercambio, trabajo real ni dinero
8. **Sin eventos**: No pasa nada interesante (invasión, festival, clima)

#### LEVEs:
9. **UI básica**: El panel de diálogo es muy simple
10. **Sin sonido**: No hay efectos de sonido ni música
11. **Animaciones pobres**: Los NPCs caminan rígido
12. **Falta de tutorial**: Los nuevos jugadores no saben qué hacer

---

## 2. PLAN DE MEJORAS POR PRIORIDAD

### 🔴 PRIORIDAD 1 - ESTABILIDAD (Hoy)

#### 1.1 Fix Pathfinding
- Implementar detección de path bloqueado
- Si path no válido, buscar punto cercano alternativo
- Timeout: si NPC no avanza en 5 segundos, recalcular

#### 1.2 Colisiones NPC-NPC
- Separación mínima de 20px entre NPCs
- Si chocan, rebotan o esperan

#### 1.3 Spawn Seguro
- Verificar que casas estén en zonas caminables
- Si casa está bloqueada, mover NPC a punto cercano válido

---

### 🟠 PRIORIDAD 2 - GAMEPLAY (Esta semana)

#### 2.1 Memoria de NPCs
- Cada NPC guarda: lugares visitados, dónde encontró comida, rutas preferidas
- Usar esto para decisiones inteligentes

#### 2.2 Eventos Dinámicos
- **Festival**: 1 vez por día, NPCs se reúnen en plaza
- **Tormenta**: Ralentiza a todos, buscan refugio
- **Mercado**: Intercambian recursos
- **Invasión**: NPCs huyen o pelean

#### 2.3 Construcción
- Los NPCs pueden construir nuevas casas
- Requieren madera del bosque
- Casa nueva = nuevo NPC puede unirse

---

### 🟡 PRIORIDAD 3 - PROFUNDIDAD (Próximas semanas)

#### 3.1 Economía Real
- Trabajo → Monedas → Comida/Casa/Mejoras
- Cada NPC tiene profesión: Granjero, Leñador, Comerciante
- Comercio entre NPCs

#### 3.2 Relaciones Complejas
- Amistad/Enemistad entre NPCs específicos
- Matrimonio, hijos, familias
- Conflictos por recursos

#### 3.3 Clima Estacional
- Primavera/Verano/Otoño/Invierno
- Afecta cosechas, movimiento, eventos

---

### 🟢 PRIORIDAD 4 - POLISH (Futuro)

#### 4.1 Animaciones Suaves
- Walk cycle de 4 frames
- Idle animation (respirar, mirar alrededor)
- Reacciones emocionales

#### 4.2 Sonido y Música
- Música ambiente cambia día/noche
- Efectos: pasos, diálogos, construcción
- Mute toggle

#### 4.3 Persistencia
- Guardar estado en localStorage
- Cargar al reiniciar
- Exportar/importar ciudades

---

## 3. QUÉ IMPLEMENTAR AHORA

### Inmediato (hoy):
1. **Fix colisiones NPC** - separación mínima
2. **Fix pathfinding atascado** - timeout y recálculo
3. **Evento básico** - Festival diario

### Esta semana:
4. **Memoria de NPCs** - lugares descubiertos
5. **Profesiones** - Granjero, Leñador, Comerciante
6. **Construcción** - casas nuevas

---

## 4. MÉTRICAS DE ÉXITO

- ✅ NPCs se mueven fluidamente sin atascarse
- ✅ 90% de NPCs llegan a casa antes de la noche
- ✅ Eventos dinámicos generan historias interesantes
- ✅ Los NPCs recuerdan y reaccionan al pasado
- ✅ El jugador puede ver la ciudad crecer con el tiempo

---

## 5. NOTAS TÉCNICAS

- **Sin APIs externas** - Todo local
- **Sin backend** - Todo en el navegador
- **Canvas puro** - No WebGL para compatibilidad
- **Mobile friendly** - Touch controls para móvil

---

*Generado por Betelgeuse el 25 Abril 2026*
