const SEPARATOR = '|';

function buildId(parts) {
    return ['mg', ...parts].join(SEPARATOR);
}

function parseId(customId) {
    if (!customId.startsWith('mg|')) return null;
    const parts = customId.split(SEPARATOR);
    if (parts.length < 2) return null;
    return parts.slice(1);
}

function buildReminderId(action, medicineId, targetId, scheduleId, dateKey) {
    return buildId(['rem', action, medicineId, targetId, scheduleId, dateKey]);
}

function parseReminderId(customId) {
    const parts = parseId(customId);
    if (!parts || parts[0] !== 'rem' || parts.length < 6) return null;
    return {
        action: parts[1],
        medicineId: parts[2],
        targetId: parts[3],
        scheduleId: parts[4],
        dateKey: parts[5]
    };
}

function buildVerifyId(action, medicineId, targetId, scheduleId, dateKey) {
    return buildId(['verify', action, medicineId, targetId, scheduleId, dateKey]);
}

function parseVerifyId(customId) {
    const parts = parseId(customId);
    if (!parts || parts[0] !== 'verify' || parts.length < 6) return null;
    return {
        action: parts[1],
        medicineId: parts[2],
        targetId: parts[3],
        scheduleId: parts[4],
        dateKey: parts[5]
    };
}

module.exports = {
    buildId,
    parseId,
    buildReminderId,
    parseReminderId,
    buildVerifyId,
    parseVerifyId
};
