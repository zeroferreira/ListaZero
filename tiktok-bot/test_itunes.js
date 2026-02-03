
const axios = require('axios');

async function testSearch(query) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`;
    try {
        const res = await axios.get(url);
        if (res.data.resultCount > 0) {
            const t = res.data.results[0];
            console.log(`Query: "${query}" -> Found: "${t.trackName}" by "${t.artistName}"`);
        } else {
            console.log(`Query: "${query}" -> No results`);
        }
    } catch (e) {
        console.error(e.message);
    }
}

(async () => {
    await testSearch("Bad Bunny - Tití Me Preguntó");
    await testSearch("Tití Me Preguntó - Bad Bunny");
    await testSearch("Linkin Park - Numb");
    await testSearch("Numb - Linkin Park");
    await testSearch("Shakira - La Tortura");
    await testSearch("La Tortura - Shakira");
})();
