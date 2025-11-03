// Login Page Logic
class LoginApp {
    constructor() {
        this.waitForFirebase().then(() => {
            this.init();
        }).catch(err => {
            console.error('Firebase initialization failed:', err);
        });
    }

    async waitForFirebase() {
        const maxWait = 10000;
        const startTime = Date.now();

        while (!window.auth && (Date.now() - startTime) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!window.auth) {
            throw new Error('Firebase Auth not initialized');
        }

        // Check if user is already logged in
        this.checkAuthState();
    }

    init() {
        this.setupEventListeners();
    }

    checkAuthState() {
        if (!window.auth) return;

        window.auth.onAuthStateChanged((user) => {
            if (user) {
                // User is already logged in, redirect to admin panel
                window.location.href = 'index.html';
            }
        });
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const passwordToggle = document.getElementById('passwordToggle');
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (passwordToggle) {
            passwordToggle.addEventListener('click', () => {
                this.togglePasswordVisibility();
            });
        }

        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showForgotPasswordDialog();
            });
        }
    }

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('loginPassword');
        const toggleIcon = document.querySelector('#passwordToggle i');

        if (passwordInput && toggleIcon) {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.classList.remove('fa-eye');
                toggleIcon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
            }
        }
    }

    async handleLogin() {
        if (!window.auth) {
            this.showError('Firebase Authentication is not available. Please refresh the page.');
            return;
        }

        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        const loginBtn = document.getElementById('loginBtn');
        const rememberMe = document.getElementById('rememberMe');

        if (!emailInput || !passwordInput) {
            this.showError('Login form elements not found.');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const remember = rememberMe ? rememberMe.checked : false;

        // Validation
        if (!email) {
            this.showError('Please enter your email address.');
            emailInput.focus();
            return;
        }

        if (!this.validateEmail(email)) {
            this.showError('Please enter a valid email address.');
            emailInput.focus();
            return;
        }

        if (!password) {
            this.showError('Please enter your password.');
            passwordInput.focus();
            return;
        }

        // Set loading state
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Signing in...</span>';
        }

        try {
            // Set persistence based on remember me
            if (remember) {
                await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            } else {
                await window.auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
            }

            // Sign in with email and password
            const userCredential = await window.auth.signInWithEmailAndPassword(email, password);

            console.log('Login successful:', userCredential.user.email);

            // Redirect to admin panel
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Login error:', error);

            let errorMessage = 'Login failed. Please try again.';

            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email address.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password. Please try again.';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Invalid email or password.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed login attempts. Please try again later.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your connection.';
                    break;
                default:
                    errorMessage = error.message || 'Login failed. Please try again.';
            }

            this.showError(errorMessage);

            // Reset button state
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Sign In</span>';
            }
        }
    }

    async showForgotPasswordDialog() {
        const emailInput = document.getElementById('loginEmail');
        const currentEmail = emailInput ? emailInput.value.trim() : '';

        const confirmed = await this.showConfirm(
            'Reset Password',
            'Enter your email address to receive a password reset link.',
            'info', {
                input: true,
                inputType: 'email',
                inputPlaceholder: 'Enter your email',
                inputValue: currentEmail
            }
        );

        if (confirmed && confirmed.email) {
            await this.sendPasswordResetEmail(confirmed.email);
        }
    }

    async sendPasswordResetEmail(email) {
        if (!window.auth) {
            this.showError('Firebase Authentication is not available.');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showError('Please enter a valid email address.');
            return;
        }

        try {
            await window.auth.sendPasswordResetEmail(email);
            await this.showAlert(
                'Password Reset Email Sent',
                'Please check your email inbox for a password reset link. The link will expire after a short period.',
                'success'
            );

            // Update email input if it was empty
            const emailInput = document.getElementById('loginEmail');
            if (emailInput && !emailInput.value) {
                emailInput.value = email;
            }
        } catch (error) {
            console.error('Password reset error:', error);

            let errorMessage = 'Failed to send password reset email.';

            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email address.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your connection.';
                    break;
                default:
                    errorMessage = error.message || 'Failed to send password reset email.';
            }

            this.showError(errorMessage);
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';

            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }

    showAlert(title, message, type = 'info') {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const dialogIcon = document.getElementById('dialogIcon');
            const dialogTitle = document.getElementById('dialogTitle');
            const dialogMessage = document.getElementById('dialogMessage');
            const dialogButtons = document.getElementById('dialogButtons');
            const confirmBtn = document.getElementById('dialogConfirm');

            if (!dialog) {
                resolve(true);
                return;
            }

            // Set icon based on type
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-times-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };

            if (dialogIcon) {
                const iconElement = dialogIcon.querySelector('i');
                if (iconElement) {
                    iconElement.className = `fas ${icons[type] || icons.info}`;
                    dialogIcon.className = `custom-dialog-icon ${type}`;
                }
            }

            if (dialogTitle) dialogTitle.textContent = title;
            if (dialogMessage) dialogMessage.textContent = message;

            // Update button text
            if (confirmBtn) {
                confirmBtn.textContent = 'OK';
                confirmBtn.className = 'custom-dialog-btn primary';
            }

            // Clear existing buttons and add just OK button
            if (dialogButtons) {
                dialogButtons.innerHTML = '';
                if (confirmBtn) {
                    dialogButtons.appendChild(confirmBtn);
                }
            }

            // Remove old event listeners
            const newConfirmBtn = confirmBtn.cloneNode(true);
            if (confirmBtn && confirmBtn.parentNode) {
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            }

            // Add new event listener
            newConfirmBtn.addEventListener('click', () => {
                dialog.classList.remove('active');
                dialog.style.display = 'none';
                resolve(true);
            });

            dialog.classList.add('active');
            dialog.style.display = 'flex';
        });
    }

    showConfirm(title, message, type = 'info', options = {}) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const dialogIcon = document.getElementById('dialogIcon');
            const dialogTitle = document.getElementById('dialogTitle');
            const dialogMessage = document.getElementById('dialogMessage');
            const dialogButtons = document.getElementById('dialogButtons');

            if (!dialog) {
                resolve(false);
                return;
            }

            // Set icon based on type
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-times-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };

            if (dialogIcon) {
                const iconElement = dialogIcon.querySelector('i');
                if (iconElement) {
                    iconElement.className = `fas ${icons[type] || icons.info}`;
                    dialogIcon.className = `custom-dialog-icon ${type}`;
                }
            }

            if (dialogTitle) dialogTitle.textContent = title;
            if (dialogMessage) dialogMessage.textContent = message;

            // Handle input field if requested
            let inputElement = null;
            if (options.input) {
                const inputContainer = document.createElement('div');
                inputContainer.style.marginTop = '15px';

                inputElement = document.createElement('input');
                inputElement.type = options.inputType || 'text';
                inputElement.className = 'form-input';
                inputElement.placeholder = options.inputPlaceholder || '';
                inputElement.value = options.inputValue || '';
                inputElement.style.width = '100%';
                inputElement.style.marginTop = '10px';

                inputContainer.appendChild(inputElement);
                if (dialogMessage && dialogMessage.parentNode) {
                    dialogMessage.parentNode.insertBefore(inputContainer, dialogMessage.nextSibling);
                }
            }

            // Create buttons
            dialogButtons.innerHTML = '';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'custom-dialog-btn secondary';
            cancelBtn.textContent = 'Cancel';
            dialogButtons.appendChild(cancelBtn);

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'custom-dialog-btn primary';
            confirmBtn.textContent = options.confirmText || 'Confirm';
            dialogButtons.appendChild(confirmBtn);

            // Event handlers
            cancelBtn.addEventListener('click', () => {
                dialog.classList.remove('active');
                dialog.style.display = 'none';
                if (inputElement && inputElement.parentNode) {
                    inputElement.parentNode.remove();
                }
                resolve(false);
            });

            confirmBtn.addEventListener('click', () => {
                dialog.classList.remove('active');
                dialog.style.display = 'none';

                let result = true;
                if (options.input && inputElement) {
                    result = {
                        confirmed: true,
                        email: inputElement.value.trim()
                    };
                }

                if (inputElement && inputElement.parentNode) {
                    inputElement.parentNode.remove();
                }

                resolve(result);
            });

            // Focus on input if present
            if (inputElement) {
                setTimeout(() => inputElement.focus(), 100);
            }

            dialog.classList.add('active');
            dialog.style.display = 'flex';
        });
    }
}

// Initialize login app when DOM is ready
let loginApp;

function initializeLogin() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeLogin);
    } else {
        loginApp = new LoginApp();
        window.loginApp = loginApp;
    }
}

initializeLogin();