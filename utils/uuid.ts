/**
 * Generates a UUID v4.
 * Uses crypto.randomUUID() if available (secure context),
 * otherwise falls back to a math-based polyfill.
 */
export const generateUUID = (): string => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {
        console.warn('crypto.randomUUID failed (likely insecure context), falling back to polyfill', e);
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
