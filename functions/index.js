const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require('firebase-admin/messaging');
const { format, addDays, startOfDay } = require('date-fns');

initializeApp();
const { subscribe } = require('./subscribe');

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
        const tomorrowFormatted = format(tomorrow, 'MMM dd, yyyy');
        const dayAfterTomorrowFormatted = format(dayAfterTomorrow, 'MMM dd, yyyy');
        console.log(tomorrowFormatted, dayAfterTomorrowFormatted)

        const userIds = new Set();

        // Get all users
        const allUsersSnapshot = await db.collection('users').get();

        for (const userDoc of allUsersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const mealAttendance = userData.mealAttendance;

            // Check for tomorrow
            if (!mealAttendance || !mealAttendance[tomorrowFormatted]) {
                userIds.add(userId);
                //console.log(userId, tomorrowFormatted, mealAttendance[tomorrowFormatted])
            } else {
                const { breakfast, lunch, dinner } = mealAttendance[tomorrowFormatted];
                if (breakfast === null && lunch === null && dinner === null) {
                    userIds.add(userId);
                }
            }

            // Check for the day after tomorrow
            if (!mealAttendance || !mealAttendance[dayAfterTomorrowFormatted]) {
                userIds.add(userId);
                //console.log(userId, dayAfterTomorrowFormatted, mealAttendance[dayAfterTomorrowFormatted])
            } else {
                const { breakfast, lunch, dinner } = mealAttendance[dayAfterTomorrowFormatted];
                if (breakfast === null && lunch === null && dinner === null) {
                    userIds.add(userId);
                }
            }
        }

        console.log(userIds)

        for (const userId of userIds) {
            const message = {
                data: {
                    title: 'Mealticker Notice',
                    body: `[${userId}] You haven't ticked for the next two days!`,
                    icon: 'https://mealtrack-nine.vercel.app/mealtracker.png',
                    url: 'https://mealtrack-nine.vercel.app/',
                },
                webpush: {
                    fcm_options: {
                        link: 'https://mealtrack-nine.vercel.app/',
                    },
                },
                android: {
                  priority: "high",
                },
                apns: {
                    headers: {
                      'apns-priority': '10' // Set priority to high for iOS
                    },
                    payload: {
                      aps: {
                        'content-available': 1 // Essential for data messages on iOS to be treated as high priority
                      }
                    }
                  }
            };

            await db.collection('messages').doc(userId).set({
                message
            });
        }
    } catch (error) {
        console.error("Error in checkMissingMealAvailability: ", error)
    }
};

const sendMessagesFromQueue = async (db, admin) => {
    try {
        const { FieldValue } = require('@google-cloud/firestore');
        console.log('Sending messages from queue...');
        const messageQueueSnapshot = await db.collection('messages').get();
        messageQueueSnapshot.forEach(async (messageDoc) => {
            const userId = messageDoc.id;
            let messageData = messageDoc.data();
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            console.log(messageData, userData)

            if (!userData || !userData.pushSubscription) {
                await db.collection('messages').doc(userId).delete();
                return;
            }

            let retryCount = messageData.retryCount || 0;
            const fcmToken = userData.pushSubscription;
            // const parts = pushSubscription.endpoint.split('/');
            // const fcmToken = parts[parts.length - 1]; // Get the last segment of the URL
            messageData.message.token = fcmToken
            console.log(fcmToken, messageData.message)
            
            let success = false;
            while (retryCount < 3 && !success) {
                try {
                    //console.log(pushSubscription)
                    //const response = await admin.messaging().sendToDevice(fcmToken, messageData.message);
                    const response = await admin.messaging().send(messageData.message);
                    console.log('Successfully sent message:', response);
                    success = true;
                } catch (error) {
                    console.error('Error sending message:', error);
                    if (error.code === 'messaging/registration-token-not-registered') {
                        console.log(`Removing invalid token for user: ${userId}`);
                        await db.collection('messages').doc(userId).delete();
                        await db.collection('users').doc(userId).update({ pushSubscription: FieldValue.delete() });
                        break; // Stop retrying for this message
                    }
                    retryCount++;
                    await db.collection('messages').doc(userId).update({ retryCount });
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before retrying
                }
            }

            if (success) {
                await db.collection('messages').doc(userId).delete();
            } else {
                console.error('Message failed to send after multiple retries:', userId);
                await db.collection('messages').doc(userId).update({ retryCount: 0 });
            }

        });
    } catch (error) {
        console.error("Error in sendMessagesFromQueue: ", error)
    }
};

exports.checkMealAvailability = onSchedule('0 16 * * *', async () => { await checkMissingMealAvailability(db, admin); });
exports.sendMessages = onSchedule('*/45 * * * *', async () => { await sendMessagesFromQueue(db, admin); });
exports.subscribe = subscribe;