import { InventoryItem } from '../types';

export function calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const s2 = str2.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    const tokens1 = s1.split(/\s+/).filter(Boolean);
    const tokens2 = s2.split(/\s+/).filter(Boolean);
    
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    let matches = 0;
    for (const t1 of tokens1) {
        // Simple token matching
        if (tokens2.some(t2 => t1 === t2 || (t1.length > 3 && t2.includes(t1)) || (t2.length > 3 && t1.includes(t2)))) {
            matches++;
        }
    }
    
    // Use Jaccard-like index for tokens
    return matches / Math.max(tokens1.length, tokens2.length);
}

export function findBestMatch(scannedName: string, items: InventoryItem[]): { item: InventoryItem, score: number } | null {
    if (!scannedName || !items || items.length === 0) return null;

    let bestMatch: InventoryItem | null = null;
    let highestScore = 0;

    for (const item of items) {
        const score = calculateSimilarity(scannedName, item.name);
        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    }

    // Threshold for a "good" match
    if (bestMatch && highestScore > 0.4) {
        return { item: bestMatch, score: highestScore };
    }

    return null;
}
