/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./editor/index.html",
        "./editor/*.js"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                slate: {
                    750: '#2d3748',
                    850: '#1a202c',
                    950: '#020617',
                },
                indigo: {
                    450: '#818cf8',
                    550: '#6366f1',
                }
            },
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'Noto Sans JP', 'Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
            },
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                'glow': '0 0 15px rgba(99, 102, 241, 0.3)',
            }
        }
    },
    plugins: [],
}
