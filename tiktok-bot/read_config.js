const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
  authDomain: "zero-strom-web.firebaseapp.com",
  projectId: "zero-strom-web",
  storageBucket: "zero-strom-web.appspot.com",
  messagingSenderId: "758369466349",
  appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

getDoc(doc(db, 'systemConfig', 'overlayAlertsConfig'))
  .then(snap => {
    if (!snap.exists()) {
      console.log('No such document!');
    } else {
      console.log('Document data:', JSON.stringify(snap.data(), null, 2));
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Error getting document', err);
    process.exit(1);
  });
