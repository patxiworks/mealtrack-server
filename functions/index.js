const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require('firebase-admin/messaging');
const { format, addDays, startOfDay } = require('date-fns');

initializeApp();

const db = getFirestore();
const admin = {
    messaging: () => getMessaging()
};

const checkMissingMealAvailability = async (db, admin) => {
    try {
        console.log('Checking for missing meal availability...');
        const today = startOfDay(new Date());
        const tomorrow = addDays(today, 1);
        const dayAfterTomorrow = addDays(today, 2);
        const tomorrowFormatted = format(tomorrow, 'yyyy-MM-dd');
        const dayAfterTomorrowFormatted = format(dayAfterTomorrow, 'yyyy-MM-dd');

        const usersSnapshot = await db.collection('Users')
            .where(`mealAttendance.${tomorrowFormatted}`, '==', null)
            .get();

        const usersSnapshot2 = await db.collection('Users')
            .where(`mealAttendance.${dayAfterTomorrowFormatted}`, '==', null)
            .get();

        const allUserDocs = [...usersSnapshot.docs, ...usersSnapshot2.docs];
        const userIds = new Set();
        allUserDocs.forEach(userDoc => userIds.add(userDoc.id));

        for (const userId of userIds) {
            const message = {
                notification: {
                    title: 'Meal Availability Reminder',
                    body: 'Please set your meal availability for the next two days.',
                }
            };

            await db.collection('MessageQueue').doc(userId).set({
                message
            });
        }
    } catch (error) {
        console.error("Error in checkMissingMealAvailability: ", error)
    }
};

const sendMessagesFromQueue = async (db, admin) => {
    try {
        console.log('Sending messages from queue...');
        const messageQueueSnapshot = await db.collection('MessageQueue').get();
        messageQueueSnapshot.forEach(async (messageDoc) => {
            const userId = messageDoc.id;
            let messageData = messageDoc.data();
            const userDoc = await db.collection('Users').doc(userId).get();
            const userData = userDoc.data();

            if (!userData || !userData.pushSubscription) {
                await db.collection('MessageQueue').doc(userId).delete();
                return;
            }

            let retryCount = messageData.retryCount || 0;
            const pushSubscription = userData.pushSubscription;
            let success = false;
            while (retryCount < 3 && !success) {
                try {
                    const response = await admin.messaging().sendToDevice(pushSubscription, messageData.message);
                    console.log('Successfully sent message:', response);
                    success = true;
                } catch (error) {
                    console.error('Error sending message:', error);
                    retryCount++;
                    await db.collection('MessageQueue').doc(userId).update({ retryCount });
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before retrying
                }
            }

            if (success) {
                await db.collection('MessageQueue').doc(userId).delete();
            } else {
                console.error('Message failed to send after multiple retries:', userId);
                await db.collection('MessageQueue').doc(userId).update({ retryCount: 0 });
            }

        });
    } catch (error) {
        console.error("Error in sendMessagesFromQueue: ", error)
    }
};

exports.checkMealAvailability = onSchedule('0 7 * * *', async () => { await checkMissingMealAvailability(db, admin); });
exports.sendMessages = onSchedule('*/15 * * * *', async () => { await sendMessagesFromQueue(db, admin); });