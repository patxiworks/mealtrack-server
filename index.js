// index.js
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const { format, isWithinInterval, addDays, startOfDay, getMonth, getDate, getYear } = require('date-fns');

// Initialize Firebase Admin SDK
const serviceAccount = require('key/serviceAccount.json'); // Replace with your service account key file
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  //databaseURL: 'your-firebase-database-url' // Replace with your database URL
});

const db = admin.firestore();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Import routes
const routes = require('./routes');
app.use('/', routes(db));

// Import scheduled tasks
const scheduled = require('./scheduled');
scheduled.init(db, admin);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});