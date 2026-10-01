// Local vector icons: no platform-dependent emoji or icon-font downloads.
const paths = {
  '⚡': 'm13 2-9 12h7l-1 8 10-12h-7z',
  '🔘': 'M5 5h14v14H5z M9 12h6',
  '😊': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M8 9h.01 M16 9h.01 M8 14q4 5 8 0',
  '🔍': 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 m5 12 6 6',
  '💬': 'M4 3h16v14H9l-5 4z M8 8h8 M8 12h5',
  '🛠️': 'M14 4a6 6 0 0 0-7 7L2 16l6 6 5-5a6 6 0 0 0 7-7l-4 4-4-4z',
  '💾': 'M3 3h15l3 3v15H3z M7 3v6h10V3 M7 21v-8h10v8',
  '🔊': 'M3 9h4l5-5v16l-5-5H3z M16 8q5 4 0 8 M19 4q8 8 0 16',
  '🤖': 'M5 7h14v13H5z M12 3v4 M2 11v5 M22 11v5 M8 12h.01 M16 12h.01 M9 16h6',
  '🛡️': 'M12 2 3 6v6q0 7 9 10 9-3 9-10V6z m-5 10 3 3 7-7',
  '🖼️': 'M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M16 7h.01',
  '🔣': 'M4 5h6 M7 2v6 M4 18l6-8 M4 10l6 8 M14 5h7 M14 10h7 M14 16h7 M14 20h7',
  '📋': 'M9 4H4v18h16V4h-5 M9 2h6v4H9z M8 11h8 M8 16h8',
  '🧩': 'M3 3h6q-2 6 3 6t3-6h6v6q-6-2-6 3t6 3v6h-6q2-6-3-6t-3 6H3v-6q6 2 6-3t-6-3z',
  '⚖️': 'M12 3v18 M6 21h12 M3 7h18 M6 7l-4 8h8z M18 7l-4 8h8z',
  '🔄': 'M20 8a8 8 0 0 0-14-3L3 8 M3 3v5h5 M4 16a8 8 0 0 0 14 3l3-3 M21 21v-5h-5',
  '↩️': 'M8 4 3 9l5 5 M3 9h12a6 6 0 0 1 0 12h-4',
  '🔢': 'M4 6h6 M7 3v6 M14 6h6 M4 15l6 6 M4 21l6-6 M14 16h6 M14 20h6',
  '🔤': 'M2 20 8 4l6 16 M4 15h8 M17 11h3q3 0 3 3v6 M23 15h-3q-4 0-4 3t4 2h3',
};

export const createToolboxIcon = (name, documentRef = document) => {
  const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '26', height: '26',
    fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(key, value);
  svg.classList.add('toolbox-svg-icon');
  const path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', paths[name] || 'M3 3h8v8H3z M13 13h8v8h-8z M13 3h8v8h-8z M3 13h8v8H3z');
  svg.appendChild(path);
  return svg;
};
