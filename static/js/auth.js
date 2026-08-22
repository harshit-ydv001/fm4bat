const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-app.firebaseapp.com",
    projectId: "your-app",
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then((result) => {
        // Successful login, redirect to dashboard
        window.location.href = "/dashboard";
    }).catch((error) => {
        alert("Google Login Failed: " + error.message);
    });
}

function sendOTP() {
    const phoneNumber = document.getElementById("phone-number").value;
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });
    
    auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier).then((confirmationResult) => {
        window.confirmationResult = confirmationResult;
        document.getElementById("otp-container").classList.remove("hidden");
        alert("OTP sent successfully!");
    }).catch((error) => {
        alert("SMS not sent: " + error.message);
    });
}

function verifyOTP() {
    const code = document.getElementById("otp-code").value;
    window.confirmationResult.confirm(code).then((result) => {
        window.location.href = "/dashboard";
    }).catch((error) => {
        alert("Invalid OTP code!");
    });
}