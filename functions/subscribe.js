const functions = require("firebase-functions");
const admin = require("firebase-admin");

// This part is typically handled automatically by Firebase Cloud Functions
// but is included here to show the assumed initialization.
// if (!admin.apps.length) {
//   admin.initializeApp();
// }

const db = admin.firestore();

exports.subscribe = functions.https.onRequest(async (req, res) => {
  const allowedOrigins = [
    'https://mealtrack-nine.vercel.app', 
    'https://9000-idx-studio-1745510583460.cluster-c3a7z3wnwzapkx3rfr5kz62dac.cloudworkstations.dev'
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST'); // Allow the necessary HTTP methods
  res.set('Access-Control-Allow-Headers', 'Content-Type'); // Allow the necessary headers
  // Handle the preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {    
    res.status(204).send('');
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { userId, pushSubscription } = req.body;
  console.log(userId, pushSubscription)

  if (!userId || !pushSubscription) {
    return res.status(400).send("Missing userId or pushSubscription in request body.");
  }

  try {
    // Store the subscription in Firestore under the 'Users' collection
    await db.collection("users").doc(userId).set({
      pushSubscription: pushSubscription
    }, { merge: true }); // Use merge: true to update if the document already exists

    return res.status(201).send({ message: "Subscription saved successfully." });

  } catch (error) {
    console.error("Error saving subscription:", error);
    return res.status(500).send("Failed to save subscription.");
  }
});