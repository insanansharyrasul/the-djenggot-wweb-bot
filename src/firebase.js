const admin = require('firebase-admin');
const path = require('path');

// Path to service account key file (USE YOUR OWN FILE)
const serviceAccountPath = path.join(__dirname, '../firebase-adminsdk.json');

let app;
let db;

const initializeFirebaseApp = () => {
    try {
        app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath)
        });

        db = admin.firestore();

        db.settings({ timestampsInSnapshots: true });

        console.log("Firebase Admin and Firestore initialized successfully");
        return app;
    } catch (error) {
        console.error("Error initializing Firebase Admin app:", error);
        throw error;
    }
}

const getFirebaseApp = () => app;
const getFirestoreDb = () => db;

module.exports = {
    initializeFirebaseApp,
    getFirebaseApp,
    getFirestoreDb,
    FieldValue: admin.firestore.FieldValue
};