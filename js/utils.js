const Utils = {
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    },
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    findClosest(point, points) {
        let closest = null;
        let minDist = Infinity;
        for (const p of points) {
            const dist = this.distance(point.x, point.y, p.x, p.y);
            if (dist < minDist) {
                minDist = dist;
                closest = p;
            }
        }
        return { target: closest, distance: minDist };
    },
    inBounds(x, y, width, height) {
        return x >= 0 && x < width && y >= 0 && y < height;
    },
    formatTime(hour) {
        const h = Math.floor(hour);
        const m = Math.floor((hour - h) * 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
};
