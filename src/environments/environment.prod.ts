// Production environment configuration
// Replace with production Firebase credentials before deployment

export const environment = {
    production: true,

    firebase: {
        apiKey: "YOUR_PRODUCTION_API_KEY",
        authDomain: "YOUR_PROJECT.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT.firebasestorage.app",
        messagingSenderId: "YOUR_SENDER_ID",
        appId: "YOUR_APP_ID",
        measurementId: "YOUR_MEASUREMENT_ID"
    },

    geminiApiKey: ''
};
