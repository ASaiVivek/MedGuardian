const MEAL_FREQUENCIES = [
    { value: 'before_breakfast', label: 'Before breakfast' },
    { value: 'after_breakfast', label: 'After breakfast' },
    { value: 'before_lunch', label: 'Before lunch' },
    { value: 'after_lunch', label: 'After lunch' },
    { value: 'before_dinner', label: 'Before dinner' },
    { value: 'after_dinner', label: 'After dinner' }
];

const MEAL_FREQUENCY_VALUES = MEAL_FREQUENCIES.map(f => f.value);

const INTAKE_COMPLETE_TYPES = [
    'medicine_taken',
    'medicine_missed_manual',
    'medicine_missed_auto',
    'medicine_missed_confirmed',
    'medicine_taken_verified',
    'medicine_taken_late'
];

const TAKEN_TYPES = [
    'medicine_taken',
    'medicine_taken_verified',
    'medicine_taken_late'
];

const MISSED_TYPES = [
    'medicine_missed_manual',
    'medicine_missed_auto',
    'medicine_missed_confirmed'
];

function parseFrequencies(input) {
    if (!input || !input.trim()) return [];

    const parts = input.split(',').map(f => f.trim()).filter(Boolean);
    const valid = [];
    const invalid = [];

    for (const part of parts) {
        if (MEAL_FREQUENCY_VALUES.includes(part)) {
            valid.push(part);
        } else if (/^custom_\d{2}:\d{2}$/.test(part)) {
            valid.push(part);
        } else if (/^\d{2}:\d{2}$/.test(part)) {
            valid.push(`custom_${part}`);
        } else {
            invalid.push(part);
        }
    }

    return { valid: [...new Set(valid)], invalid };
}

function formatFrequency(frequencies) {
    if (!Array.isArray(frequencies)) return String(frequencies || '');
    return frequencies.map(f => {
        if (f.startsWith('custom_')) return `At ${f.replace('custom_', '')}`;
        return f.replace(/_/g, ' ');
    }).join(', ');
}

module.exports = {
    MEAL_FREQUENCIES,
    MEAL_FREQUENCY_VALUES,
    INTAKE_COMPLETE_TYPES,
    TAKEN_TYPES,
    MISSED_TYPES,
    parseFrequencies,
    formatFrequency
};
