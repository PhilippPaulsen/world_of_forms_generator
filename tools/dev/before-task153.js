/*
 * tools/dev/before-task153.js - task 153: the core files as they were BEFORE the neutral anchor (core/facecolor.js: `neutral: true` in newFaceAnchor(); core/session.js and core/session-apply.js:
 * the optional anchor field `neutral`, written only when true). The old "core unchanged against the base" tests compare these files with a historic tree; task 153 changed them on purpose
 * (approved), so they compare them through this function (chained after before-task149.js): beforeTask153(text, file) returns the text without exactly the task-153 parts.
 */
module.exports = function beforeTask153(text, file) {
    if (file === 'core/facecolor.js') return text.replace(/, neutral: true \};   \/\/ task 153[^\n]*\n/, ' };\n');
    if (file === 'core/session.js') {
        return text.replace("Object.assign({ hueIndex: o.faceAnchor.hueIndex, registerIndex: o.faceAnchor.registerIndex }, o.faceAnchor.neutral === true ? { neutral: true } : {}) : null,   // task 153: `neutral` only when true (additive)", '{ hueIndex: o.faceAnchor.hueIndex, registerIndex: o.faceAnchor.registerIndex } : null,')
            .replace("Object.assign({ hueIndex: a.hueIndex, registerIndex: a.registerIndex }, a.neutral === true ? { neutral: true } : {});   // task 153: a bad `neutral` reads as absent", '{ hueIndex: a.hueIndex, registerIndex: a.registerIndex };');
    }
    if (file === 'core/session-apply.js') {
        return text.replace("Object.assign({ hueIndex: sheet.faceAnchor.hueIndex, registerIndex: sheet.faceAnchor.registerIndex }, sheet.faceAnchor.neutral === true ? { neutral: true } : {});   // task 153", '{ hueIndex: sheet.faceAnchor.hueIndex, registerIndex: sheet.faceAnchor.registerIndex };')
            .replace("Object.assign({ hueIndex: snap.base.faceAnchor.hueIndex, registerIndex: snap.base.faceAnchor.registerIndex }, snap.base.faceAnchor.neutral === true ? { neutral: true } : {}) : null,   // task 153", '{ hueIndex: snap.base.faceAnchor.hueIndex, registerIndex: snap.base.faceAnchor.registerIndex } : null,');
    }
    return text;
};
