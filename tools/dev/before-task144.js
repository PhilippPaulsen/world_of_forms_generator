/*
 * tools/dev/before-task144.js - task 144: core/export.js as it was BEFORE the Download name (exportFileBase / exportFileStem / exportFileName, the stem in exportPNG and downloadBlob,
 * `title` in buildExportData). tools/anim/test-anim-svg-driver.js pins core/export.js byte-equal to its historic base; this removes exactly the task-144 parts first.
 */
module.exports = function beforeTask144(text) {
    return text
        .replace(/\/\/ Task 144: the name of the files of the Download dialog\.[\s\S]*?function exportPNG\(\) \{\n    saveCanvas\(exportFileStem\(\), 'png'\);\n\}\n/, "function exportPNG() {\n    saveCanvas('world_of_forms', 'png');\n}\n")
        .replace('a.download = exportFileName(filename);', 'a.download = filename;')
        .replace(/    \/\/ task 144: the name a person typed[^\n]*\n[^\n]*data\.title = [^\n]*\n/, '');
};
