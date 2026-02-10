
export const formatDate = (date: Date | string | number): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

export const formatDateForDisplay = formatDate; // Alias for backward compatibility if needed

export const formatDateForFilename = (date: Date | string | number): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid_Date';
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${month}-${day}-${year}`;
};

export const formatDateTime = (date: Date | string | number): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const getCurrentLocalISODate = (): string => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offset);
    return local.toISOString().slice(0, 10); // YYYY-MM-DD
};
