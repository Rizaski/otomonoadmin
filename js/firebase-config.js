// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBNWEchdrKX9A2WdMa3VTnpbKgo0_eWqHE",
    authDomain: "otomono-c9938.firebaseapp.com",
    projectId: "otomono-c9938",
    storageBucket: "otomono-c9938.firebasestorage.app",
    messagingSenderId: "348906539551",
    appId: "1:348906539551:web:e249c40d0ae9e2964a632a",
    measurementId: "G-YVL497L1V3"
};

// Initialize Firebase
let db, auth;
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // Initialize services
    db = firebase.firestore();
    // Only initialize auth if the module is loaded
    try {
        if (typeof firebase.auth === 'function') {
            auth = firebase.auth();
        } else {
            console.warn('Firebase Auth module not loaded');
            auth = null;
        }
    } catch (err) {
        console.warn('Firebase Auth module not loaded:', err);
        auth = null;
    }

    // Enable offline persistence (optional - for offline support)
    // Using a simplified approach to avoid deprecation warnings
    // The compat library handles persistence automatically for offline support
    try {
        // For compat library, we can use enablePersistence without synchronizeTabs
        // This reduces deprecation warnings while still providing offline support
        db.enablePersistence().catch(err => {
            // Suppress known non-critical errors (these are expected in many scenarios)
            if (err.code === 'failed-precondition') {
                // Multiple tabs open or incompatible SDK version
                // This is expected behavior, silently continue without persistence
                if (err.message && err.message.includes('newer version')) {
                    // SDK version mismatch - continue without persistence
                    // App will work normally, just without offline support
                } else {
                    // Multiple tabs - this is normal behavior
                }
            } else if (err.code === 'unimplemented') {
                // Browser doesn't support persistence (e.g., Safari private mode)
                // App will work normally, just without offline support
            } else {
                // Other errors - only log if they're unexpected
                if (err.code !== 'unavailable') {
                    console.debug('Firestore persistence:', err.message || err);
                }
            }
        });
    } catch (err) {
        // Persistence API not available - this is fine, app will work without it
        // No need to log as this is expected in some environments
    }

    // Export for use in other scripts
    window.db = db;
    window.auth = auth;

    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase:', error);
    // Don't create mock objects - let the app handle errors gracefully
}