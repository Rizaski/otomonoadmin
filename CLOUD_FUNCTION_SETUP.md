# Firebase Cloud Function Setup for Email Sending

## Problem
The Bird.com API cannot be accessed directly from the browser due to CORS (Cross-Origin Resource Sharing) restrictions. We need to use Firebase Cloud Functions as a backend proxy.

## Solution
Deploy a Firebase Cloud Function that will handle email sending server-side.

## Setup Steps

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Functions
Navigate to your project directory and run:
```bash
firebase init functions
```

When prompted:
- Select your Firebase project
- Choose JavaScript
- Install dependencies? Yes

### 4. Install Dependencies
```bash
cd functions
npm install
```

### 5. Deploy the Function
```bash
firebase deploy --only functions
```

### 6. Update Frontend Code
The frontend code will automatically use the Cloud Function if it's available. No changes needed.

## How It Works

1. When admin clicks "Confirm" button, the frontend calls `firebase.functions().httpsCallable('sendOrderConfirmation')`
2. The Cloud Function receives the email data
3. The Cloud Function sends the email via Bird.com API (server-side, no CORS issues)
4. Returns success/failure to the frontend

## Alternative: Use EmailJS (No Backend Required)

If you prefer not to use Cloud Functions, you can switch back to EmailJS which works client-side:

1. Sign up at https://www.emailjs.com
2. Add EmailJS script to `index.html`
3. Configure with your EmailJS keys

See `EMAILJS_SETUP.md` for details.

## Testing

After deploying, test by:
1. Opening the admin panel
2. Going to Customers page
3. Clicking "Confirm" button for a customer with email
4. Check if email is sent successfully

## Troubleshooting

**Function not deploying?**
- Check Firebase CLI is installed: `firebase --version`
- Ensure you're logged in: `firebase login`
- Check billing is enabled for Cloud Functions (free tier available)

**Function deployed but not working?**
- Check Firebase Console > Functions for errors
- Check browser console for errors
- Verify the function name matches: `sendOrderConfirmation`

**Still getting CORS errors?**
- The function should resolve this. If not, check that it's deployed correctly
- Verify the function URL in Firebase Console

