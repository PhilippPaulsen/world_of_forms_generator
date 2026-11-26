/*
 * tools/dev/before-task145.js - task 145: core/facecolor.js as it was BEFORE the view-dependent default anchor (newFaceAnchor() and the constant FACE_ANCHOR_SIMPLE_REGISTER).
 * The old "core unchanged against the base of task NNN" tests compare core/facecolor.js with a historic tree; task 145 changed these lines on purpose (approved), so they compare it
 * through this function, which puts the old three lines back.
 */
module.exports = function beforeTask145(text) {
    return text.replace(/\/\/ Task 145: the register of a fresh anchor[\s\S]*?function newFaceAnchor\(\) \{\n[^\n]*\n\}\n/, 'function newFaceAnchor() {\n    return { hueIndex: 1, registerIndex: 0 };\n}\n');
};
