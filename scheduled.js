// scheduled.js
const { format, isWithinInterval, addDays, startOfDay, getMonth, getDate, getYear } = require('date-fns');

module.exports = {
    init: function (db, admin) {
        // Check missing availability and send notifications (run daily at 8:00 AM)
        cron.schedule('0 7 * * *', async () => {
            console.log('Checking for missing meal availability...');
            try {
                await checkMissingMealAvailability(db, admin);
            } catch (error) {
                console.error('Error checking meal availability:', error);
            }
        });

        //Send messages from the queue (run every 15 minutes)
        cron.schedule('*/15 * * * *', async () => {
            console.log('Sending messages from queue...');
            try {
                await sendMessagesFromQueue(db, admin);
            } catch (error) {
                console.error('Error sending messages:', error);
            }
        });
    }
}

const checkMissingMealAvailability = async (db, admin) => {
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
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendMessagesFromQueue = async (db, admin) => {
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
        while(retryCount < 3 && !success){
            try {
                const response = await admin.messaging().sendToDevice(pushSubscription, messageData.message);
                console.log('Successfully sent message:', response);
                success = true;
            } catch (error) {
                console.error('Error sending message:', error);
                retryCount++;
                await db.collection('MessageQueue').doc(userId).update({retryCount});
                await sleep(5000); // Wait for 5 seconds before retrying
            }
        }

        if (success) {
            await db.collection('MessageQueue').doc(userId).delete();    
        }else{
            console.error('Message failed to send after multiple retries:', userId);
            await db.collection('MessageQueue').doc(userId).update({retryCount: 0});
        }
        
    });
}