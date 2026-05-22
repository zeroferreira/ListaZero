const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, deleteField, updateDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
  authDomain: "zero-strom-web.firebaseapp.com",
  projectId: "zero-strom-web",
  storageBucket: "zero-strom-web.appspot.com",
  messagingSenderId: "758369466349",
  appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
});
const db = getFirestore(app);

async function fix() {
  console.log("Arreglando documento usuario...");
  try {
    await updateDoc(doc(db, 'userStats', 'usuario'), {
      tiktokId: deleteField()
    });
    console.log("tiktokId eliminado de usuario.");
  } catch (e) {
    console.log("No se pudo actualizar usuario", e.message);
  }

  console.log("Arreglando documento jenny_fer2110_...");
  try {
    await setDoc(doc(db, 'userStats', 'jenny_fer2110_'), {
      tiktokId: 'jenny_fer2110_'
    }, { merge: true });
    console.log("tiktokId añadido a jenny_fer2110_.");
  } catch (e) {
    console.log("No se pudo actualizar jenny_fer2110_", e.message);
  }

  process.exit(0);
}
fix().catch(console.error);
