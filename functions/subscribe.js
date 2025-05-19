const functions = require("firebase-functions");
const admin = require("firebase-admin");

// This part is typically handled automatically by Firebase Cloud Functions
// but is included here to show the assumed initialization.
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.subscribe = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { userId, pushSubscription } = req.body;

  if (!userId || !pushSubscription) {
    return res.status(400).send("Missing userId or pushSubscription in request body.");
  }

  try {
    // Store the subscription in Firestore under the 'Users' collection
    await db.collection("Users").doc(userId).set({
      pushSubscription: pushSubscription
    }, { merge: true }); // Use merge: true to update if the document already exists

    return res.status(201).send({ message: "Subscription saved successfully." });

  } catch (error) {
    console.error("Error saving subscription:", error);
    return res.status(500).send("Failed to save subscription.");
  }
});