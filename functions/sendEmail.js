/**
 * Firebase Cloud Function to send emails via Bird.com API
 * 
 * Installation:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login: firebase login
 * 3. Initialize: firebase init functions
 * 4. Install dependencies: cd functions && npm install
 * 5. Deploy: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

exports.sendOrderConfirmation = functions.https.onCall(async (data, context) => {
    // Verify authentication if needed
    // if (!context.auth) {
    //     throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    // }

    const {
        to,
        subject,
        html,
        text
    } = data;

    if (!to || !subject || !html) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required email parameters');
    }

    const BIRD_API_KEY = 'OEYmDssyk0pj1z1LPsl0lU9MAu8rhjNIzjty';
    const BIRD_API_URL = 'https://api.bird.com/v1/messages'; // Adjust based on actual Bird.com API endpoint

    try {
        const response = await fetch(BIRD_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BIRD_API_KEY}`,
                'X-API-Key': BIRD_API_KEY
            },
            body: JSON.stringify({
                to: to,
                subject: subject,
                html: html,
                text: text || html.replace(/<[^>]*>/g, '') // Remove HTML tags for text version
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: `HTTP error! status: ${response.status}`
            }));
            throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return {
            success: true,
            messageId: result.id || 'sent'
        };
    } catch (error) {
        console.error('Error sending email via Bird.com:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send email', error.message);
    }
});