// Add this utility — src/UTILS/sanitizeSubjectName.js
export function sanitizeSubjectName(name) {
  if (!name) return name;
  
  const CYRILLIC_MAP = {
    "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041A": "K",
    "\u041C": "M", "\u041D": "H", "\u041E": "O", "\u0420": "P",
    "\u0421": "C", "\u0422": "T", "\u0425": "X",
    "\u0430": "a", "\u0435": "e", "\u043E": "o", "\u0440": "p",
    "\u0441": "c", "\u0445": "x",
  };

  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, (ch) => CYRILLIC_MAP[ch] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}