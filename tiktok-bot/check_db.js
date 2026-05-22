const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');

const app = initializeApp({
  apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
  authDomain: "zero-strom-web.firebaseapp.com",
  projectId: "zero-strom-web",
  storageBucket: "zero-strom-web.appspot.com",
  messagingSenderId: "758369466349",
  appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
});
const db = getFirestore(app);

async function check() {
  const users = ['vic', 'fictor', 'jenny_fer2110_'];
  
  for (const u of users) {
    console.log(`\n--- Buscando ${u} en userStats ---`);
    const snap = await getDoc(doc(db, 'userStats', u));
    if (snap.exists()) {
      console.log(`✅ ${u} existe. tiktokId: ${snap.data().tiktokId}, displayName: ${snap.data().displayName}`);
    } else {
      console.log(`❌ ${u} NO existe.`);
    }
  }

  console.log("\n--- Buscando alias en userAliases ---");
  for (const u of users) {
      const aliasSnap = await getDoc(doc(db, 'userAliases', u));
      if (aliasSnap.exists()) {
          console.log(`Alias encontrado: ${u} -> ${aliasSnap.data().aliasedTo}`);
      }
  }

  const aliasDocs = await getDocs(collection(db, 'userAliases'));
  aliasDocs.forEach(d => {
    const data = d.data();
    if (users.includes(data.aliasedTo.toLowerCase())) {
      console.log(`Alias inverso encontrado: TikTok [${d.id}] -> Web [${data.aliasedTo}]`);
    }
  });

  process.exit(0);
}
check().catch(console.error);
