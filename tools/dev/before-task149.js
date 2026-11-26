/*
 * tools/dev/before-task149.js - task 149: the core files as they were BEFORE the gray tones (core/color.js: the tone ladders, the rule's extraAxes and their handling in generateHarmonyPalette;
 * core/facecolor.js: _grayRuleIdx and its five call sites; core/state.js: grayTones; core/session.js: the always-written settings.grayTones; core/session-apply.js: grayTones in the lists).
 * The old "core unchanged against the base" tests compare these files with a historic tree; task 149 changed them on purpose (approved), so they compare them through this function:
 * beforeTask149(text, file) returns the text without exactly the task-149 parts (any other file: unchanged).
 */
const OLD_RULE = `registerHarmonyRule({
    id: 'max-contrast-gray',
    label: 'Max-Kontrast-Graustufen',
    note: 'this app\\'s own default for unassigned trails - widest available letter spread for the real trail count, not always all 8',
    params: [{ id: 'direction', label: 'Richtung', i18n: 'rule.axis.direction', count: 2 }],
    generate(idx, system, slots) {
        const white = system.grayScale.white;
        const indices = _maxContrastGrayIndices(slots, white.length);
        const ordered = idx[0] === 1 ? indices.slice().reverse() : indices;
        return ordered.map(i => {
            const w = white[i];
            return { hue: 0, w, s: 1 - w };
        });
    }
});
`;
module.exports = function beforeTask149(text, file) {
    if (file === 'core/color.js') {
        const a = text.indexOf('// Task 149: the TONE ladders');
        if (a < 0) return text;
        const marker = '\n});\n';
        const b = text.indexOf(marker, text.indexOf("id: 'max-contrast-gray'", a)) + marker.length;
        text = text.slice(0, a) + OLD_RULE + text.slice(b);
        const c = text.indexOf('    // task 149: a rule may declare `extraAxes`');
        const d = text.indexOf('    const stepIdx = ');
        const dEnd = text.indexOf('\n', d) + 1;
        text = text.slice(0, c) + text.slice(dEnd);
        return text.replace('!Array.isArray(stepIdx) || stepIdx.length !== params.length', '!Array.isArray(idx) || idx.length !== params.length').replace('stepIdx.forEach(', 'idx.forEach(');
    }
    if (file === 'core/facecolor.js') {
        return text.replace(/\/\/ task 149: the ONE place[\s\S]*?\n\}\n/, '')
            .replace("_grayRuleIdx('max-contrast-gray', [0])", '[0]').split('_grayRuleIdx(palette.ruleId, palette.idx)').join('palette.idx');
    }
    if (file === 'core/state.js') return text.replace(/\/\/ Task 149: how many grays[\s\S]*?let grayTones = GRAY_TONES_DEFAULT;\n/, '');
    if (file === 'core/session.js') {
        return text.replace(/\/\/ Task 149: the number of grays[\s\S]*?(?=\/\/ Task 144: the Download name)/, '')
            .replace('            grayTones: _grayTonesNormalize(s.grayTones),\n', '')
            .replace(/\n        \/\/ gray tones \(task 149\)[^\n]*\n        settings\.grayTones = [^\n]*\n/, '');
    }
    if (file === 'core/session-apply.js') {
        return text.replace("'uiMode', 'exportName', 'grayTones',", "'uiMode', 'exportName',").split('exportName, grayTones,').join('exportName,')
            .split(' grayTones = c.grayTones;').join('').split(' grayTones = built.grayTones;').join('')
            .replace(/    built\.grayTones = [^\n]*\n/, '');
    }
    return text;
};
