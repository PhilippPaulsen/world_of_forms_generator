/*
 * The glossary of the pattern name (task 071b): the ONE source of the Hinterreiter terms the name uses (order, position, main group, shape sign, nodes, node number, family, letter, sector,
 * overline, lower-case / capital letter, aA, name structure). Pure data and two functions, no DOM, no p5. The TEXTS live in ui-i18n.js (DICT, keys glossary.*: the German original beside the
 * English); an entry only points at its two keys: `termKey` (the word) and `textKey` (the explanation). The stored name stays language-neutral (the Hinterreiter notation); only the
 * explanation is translated. Used by sketch.js (patternNameTooltip), core/export.js (the optional "glossary" field: the ids, no texts) and the info card's section "Begriffe" (index.html).
 */
const GLOSSARY = Object.freeze([
    Object.freeze({ id: 'order', termKey: 'glossary.order.term', textKey: 'glossary.order' }),
    Object.freeze({ id: 'position', termKey: 'glossary.position.term', textKey: 'glossary.position' }),
    Object.freeze({ id: 'maingroup', termKey: 'glossary.maingroup.term', textKey: 'glossary.maingroup' }),
    Object.freeze({ id: 'formsign', termKey: 'glossary.formsign.term', textKey: 'glossary.formsign' }),
    Object.freeze({ id: 'nodes', termKey: 'glossary.nodes.term', textKey: 'glossary.nodes' }),
    Object.freeze({ id: 'nodenumber', termKey: 'glossary.nodenumber.term', textKey: 'glossary.nodenumber' }),
    Object.freeze({ id: 'family', termKey: 'glossary.family.term', textKey: 'glossary.family' }),
    Object.freeze({ id: 'letter', termKey: 'glossary.letter.term', textKey: 'glossary.letter' }),
    Object.freeze({ id: 'sector', termKey: 'glossary.sector.term', textKey: 'glossary.sector' }),
    Object.freeze({ id: 'bar', termKey: 'glossary.bar.term', textKey: 'glossary.bar' }),
    Object.freeze({ id: 'lower', termKey: 'glossary.lower.term', textKey: 'glossary.lower' }),
    Object.freeze({ id: 'mirror', termKey: 'glossary.mirror.term', textKey: 'glossary.mirror' }),
    Object.freeze({ id: 'both', termKey: 'glossary.both.term', textKey: 'glossary.both' }),
    Object.freeze({ id: 'nameform', termKey: 'glossary.nameform.term', textKey: 'glossary.nameform' }),
]);
// The ids of the terms a v2 display name (core/orbits.js gridDisplayNameFor) uses: the grid terms always, the line terms, and the overline / capital / aA only where the name carries them.
function glossaryIdsForName(v2) {
    if (!v2 || !Array.isArray(v2.tokens)) return [];
    const ids = ['order', 'position', 'maingroup', 'formsign', 'nodes', 'nodenumber', 'family', 'letter', 'sector', 'nameform'];
    if (v2.tokens.some(t => t.key && t.key.gegen)) ids.push('bar');
    if (v2.tokens.some(t => t.spiegelgleich)) ids.push('both');
    return GLOSSARY.map(e => e.id).filter(id => ids.indexOf(id) >= 0);
}
function glossaryEntry(id) {
    for (const e of GLOSSARY) if (e.id === id) return e;
    return null;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { GLOSSARY, glossaryIdsForName, glossaryEntry };
