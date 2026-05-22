const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
  const docs = await getDocs(collection(db, 'userStats'));
  docs.forEach(d => {
    const data = d.data();
    const dn = String(data.displayName || '').toLowerCase();
    const tid = String(data.tiktokId || '').toLowerCase();
    const id = String(d.id).toLowerCase();
    
    if (dn.includes('vic') || tid.includes('vic') || id.includes('vic')) {
      console.log(`Encontrado: DocID=${d.id}, DisplayName=${data.displayName}, TiktokId=${data.tiktokId}`);
    }
    
    if (dn.includes('fictor') || tid.includes('fictor') || id.includes('fictor')) {
      console.log(`Encontrado: DocID=${d.id}, DisplayName=${data.displayName}, TiktokId=${data.tiktokId}`);
    }
  });
  process.exit(0);
}
check().catch(console.error);
