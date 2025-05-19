// routes.js
const express = require('express');
const router = express.Router();
const { format, isWithinInterval, addDays, startOfDay, getMonth, getDate, getYear } = require('date-fns');

module.exports = (db) => {
  // Subscribe Endpoint
  // router.post('/api/subscribe', async (req, res) => {
  //   try {
  //     const { userId, pushSubscription } = req.body;
  //     if (!userId || !pushSubscription) {
  //       return res.status(400).send({ error: 'Missing userId or pushSubscription' });
  //     }

  //     // Store in Firestore
  //     await db.collection('Users').doc(userId).set({
  //       pushSubscription
  //     }, { merge: true });

  //     res.status(201).send({ message: 'Subscribed successfully' });
  //   } catch (error) {
  //     console.error('Error storing push subscription:', error);
  //     res.status(500).send({ error: 'Internal server error' });
  //   }
  // });

  // Meal Attendance Endpoint
  router.post('/api/meal-attendance', async (req, res) => {
    try {
      const { userId, date, breakfast, lunch, dinner } = req.body;
        if (!userId || !date || !breakfast || !lunch || !dinner) {
            return res.status(400).send({ error: 'Missing data' });
        }

      // Store in Firestore
      await db.collection('Users').doc(userId).set({
        mealAttendance: {
            [date]: {
                breakfast,
                lunch,
                dinner
            }
        }
      }, { merge: true });

      res.status(201).send({ message: 'Meal attendance set successfully' });
    } catch (error) {
      console.error('Error storing meal attendance:', error);
      res.status(500).send({ error: 'Internal server error' });
    }
  });

  return router;
}