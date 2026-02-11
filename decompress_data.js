const https = require('https');
const data = 'N4Ig7g9gTg1gzgBwIYGMCmIBcoBGAbCFeLUPJAOwHMBXJStANTSjgEsJysAGAGhH0LFMAbVAAXAJ4IMmEHBQALNABNqeZgH0UUDiD4APLABYAbAEY+ErACYAzAE4+AM1Zo8yuCRABJAHIAVAFEAJQYAQQAZLBAAETDvCIBNEABfPlZyBGoxT2xYgHkvASIvSWlo9SQANzQNKohWdC0FCnI3VJTOgF1OvgQ8akoMgFVh7xjc4RAVHAQAWlskNFRFgFY5vC4IKr0QJAQEVkPyCEO5+SVVdSg5ri4zEC6+gaHyb3InCCwpwJiAIQACi8MgB6ZRoHCDOYqVhiaBzfqDDK7faHY6nVgg-ysAC2aAAyooVGpmI8UkA';

https.get('https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js', (res) => {
    let script = '';
    res.on('data', (d) => { script += d; });
    res.on('end', () => {
        const fakeWindow = {};
        const fn = new Function('window', script + '; return window.LZString;');
        const LZString = fn(fakeWindow);
        if (LZString) {
            console.log(LZString.decompressFromEncodedURIComponent(data));
        } else {
            // Try global
            const fn2 = new Function(script + '; return LZString;');
            console.log(fn2().decompressFromEncodedURIComponent(data));
        }
    });
});
