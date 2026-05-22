const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

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
  const sysAliasSnap = await getDoc(doc(db, 'systemConfig', 'userAliases'));
  if (sysAliasSnap.exists()) {
    console.log("systemConfig/userAliases:", sysAliasSnap.data());
  } else {
    console.log("No existe systemConfig/userAliases");
  }
  process.exit(0);
}
check().catch(console.error);
