import './style.css';
import { auth, provider, db } from './firebase-config.js';
import { signInWithPopup, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('auth-modal');
  const getStartedBtn = document.getElementById('hero-get-started');
  const navSignupBtn = document.getElementById('nav-signup-btn');
  const navLoginBtn = document.getElementById('nav-login-btn');
  const closeModalBtns = document.querySelectorAll('.close-modal');
  const googleLoginBtn = document.getElementById('google-login-btn');
  
  // New Form Elements
  const authForm = document.getElementById('auth-form');
  const nameGroup = document.getElementById('name-group');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const modalTitle = document.getElementById('modal-title');
  const modalSubtitle = document.getElementById('modal-subtitle');

  let isSignUp = false; // Track if we are in sign up or login mode

  // Toggle between Sign Up and Login using tabs
  const setAuthMode = (signUp) => {
    isSignUp = signUp;
    if (isSignUp) {
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      modalTitle.textContent = 'Create an Account';
      modalSubtitle.textContent = 'Sign up to get started with your vault.';
      authSubmitBtn.innerHTML = `Sign Up <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/0000/svg"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      nameGroup.style.display = 'block';
      fullNameInput.required = true;
    } else {
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      modalTitle.textContent = 'Welcome Back';
      modalSubtitle.textContent = 'Enter your credentials to access your vault.';
      authSubmitBtn.innerHTML = `Sign In <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/0000/svg"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      nameGroup.style.display = 'none';
      fullNameInput.required = false;
    }
  };

  if (tabLogin) tabLogin.addEventListener('click', () => setAuthMode(false));
  if (tabSignup) tabSignup.addEventListener('click', () => setAuthMode(true));

  // Handle Email/Password Submit
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    
    const originalText = authSubmitBtn.textContent;
    authSubmitBtn.textContent = 'Please wait...';
    authSubmitBtn.disabled = true;

    try {
      let user;
      if (isSignUp) {
        // Create user
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
        
        // Update profile with full name
        const displayName = fullNameInput.value;
        await updateProfile(user, { displayName });
        
        // Save new user profile to Firestore
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: displayName,
          createdAt: new Date(),
          lastLogin: new Date()
        });
      } else {
        // Log in user
        const result = await signInWithEmailAndPassword(auth, email, password);
        user = result.user;
        
        // Update last login
        await setDoc(doc(db, "users", user.uid), {
          lastLogin: new Date()
        }, { merge: true });
      }
      
      console.log("Logged in with email:", user);
      window.location.href = '/dashboard.html';
    } catch (error) {
      console.error("Auth failed:", error);
      alert(`Authentication failed: ${error.message}`);
      authSubmitBtn.textContent = originalText;
      authSubmitBtn.disabled = false;
    }
  });

  // Show Modal Functions
  const showModal = () => {
    modal.classList.add('show');
  };

  const hideModal = () => {
    modal.classList.remove('show');
    // Reset form
    authForm.reset();
  };

  if (getStartedBtn) getStartedBtn.addEventListener('click', showModal);
  if (navSignupBtn) navSignupBtn.addEventListener('click', showModal);

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', hideModal);
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideModal();
    }
  });

  // Handle Google Login
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Save user profile to Firestore
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastLogin: new Date()
        }, { merge: true });

        console.log("Logged in and user saved to Firestore:", user);
        window.location.href = '/dashboard.html';
      } catch (error) {
        console.error("Login failed:", error);
        alert(`Login failed: ${error.message}. Ensure your Firebase config is correct.`);
      }
    });
  }

  // Handle Auth State
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in
      if (navSignupBtn) navSignupBtn.style.display = 'none';
      if (navLoginBtn) {
        navLoginBtn.style.display = 'inline-flex';
        navLoginBtn.addEventListener('click', () => {
          window.location.href = '/dashboard.html';
        });
      }
      if (getStartedBtn) {
        getStartedBtn.innerHTML = `Go to Dashboard <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/0000/svg"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        getStartedBtn.removeEventListener('click', showModal);
        getStartedBtn.addEventListener('click', () => {
          window.location.href = '/dashboard.html';
        });
      }
    } else {
      // User is signed out
      if (navSignupBtn) navSignupBtn.style.display = 'inline-flex';
      if (navLoginBtn) navLoginBtn.style.display = 'none';
    }
  });
});
