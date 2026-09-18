const assert = require('assert');
const { buildReminderId, parseReminderId, buildVerifyId, parseVerifyId } = require('./interactionIds');
const { parseFrequencies, formatFrequency } = require('../constants/frequencies');

function testInteractionIds() {
    const id = buildReminderId('taken', 'med_1726627200000', '123456789', 'sched_med_1726627200000_before_breakfast', '2025-09-18');
    const parsed = parseReminderId(id);

    assert.strictEqual(parsed.action, 'taken');
    assert.strictEqual(parsed.medicineId, 'med_1726627200000');
    assert.strictEqual(parsed.targetId, '123456789');
    assert.strictEqual(parsed.scheduleId, 'sched_med_1726627200000_before_breakfast');
    assert.strictEqual(parsed.dateKey, '2025-09-18');

    const verifyId = buildVerifyId('late', 'med_1', 'user_2', 'sched_3', '2025-09-18');
    const verifyParsed = parseVerifyId(verifyId);
    assert.strictEqual(verifyParsed.action, 'late');
}

function testFrequencies() {
    const result = parseFrequencies('before_breakfast, after_dinner, 08:00, 22:00');
    assert.deepStrictEqual(result.valid, ['before_breakfast', 'after_dinner', 'custom_08:00', 'custom_22:00']);
    assert.strictEqual(result.invalid.length, 0);

    const bad = parseFrequencies('invalid_freq');
    assert.strictEqual(bad.invalid.length, 1);

    const formatted = formatFrequency(['before_breakfast', 'custom_08:00']);
    assert.ok(formatted.includes('before breakfast'));
    assert.ok(formatted.includes('At 08:00'));
}

testInteractionIds();
testFrequencies();
console.log('✅ All utility tests passed');
