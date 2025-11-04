// Customer Jersey Details Management
class CustomerApp {
    constructor() {
        this.orderId = null;
        this.token = null;
        this.jerseys = []; // Jerseys saved to Firebase
        this.localJerseys = []; // Jerseys added locally (not yet saved to Firebase)
        this.orderData = null;
        this.editingIndex = null;
        this.isEditingLocal = false;
        this.isSubmitted = false;
        this.orderStatusListener = null;
        this.formEnabled = false;
        this._initialized = false;
    }

    async waitForFirebase() {
        // Wait for Firebase to be initialized (max 10 seconds)
        const maxWait = 10000;
        const startTime = Date.now();

        while (!window.db && (Date.now() - startTime) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!window.db) {
            throw new Error('Firebase not initialized within timeout period');
        }

        return true;
    }

    async init() {
        try {
            console.log('CustomerApp.init() started');

            // Get order ID and token from URL
            const urlParams = new URLSearchParams(window.location.search);
            this.orderId = urlParams.get('orderId');
            this.token = urlParams.get('token');

            console.log('Order ID:', this.orderId, 'Token:', this.token ? 'Present' : 'Missing');

            if (!this.orderId || !this.token) {
                console.error('Missing orderId or token');
                this.showError('Invalid link. Please use the link provided by the administrator.');
                return;
            }

            // Verify order exists and token matches
            await this.loadOrderData();

            // Setup event listeners first
            this.setupEventListeners();
            this.setupDynamicEventListeners();

            // Load from local storage if available (after DOM is ready and listeners are set up)
            setTimeout(() => {
                this.loadFromLocalStorage();
            }, 100);

            console.log('CustomerApp.init() completed successfully');
        } catch (error) {
            console.error('Error in CustomerApp.init():', error);
            this.showError('Error initializing application: ' + error.message);
        }
    }

    async loadOrderData() {
        try {
            if (!window.db) {
                throw new Error('Firebase not initialized');
            }

            console.log('Loading order data for orderId:', this.orderId);

            const orderDoc = await db.collection('orders').doc(this.orderId).get();

            if (!orderDoc.exists) {
                throw new Error('Order not found');
            }

            const orderDataRaw = orderDoc.data();
            this.orderData = {
                id: orderDoc.id,
                ...orderDataRaw
            };

            console.log('Order data loaded:', this.orderData);
            console.log('Order amount/quantity from Firebase:', this.orderData.amount, this.orderData.quantity);

            // Verify token
            if (this.orderData.linkToken !== this.token) {
                throw new Error('Invalid access token');
            }

            // Ensure order info section is visible
            const orderInfoSection = document.getElementById('orderInfoSection');
            if (orderInfoSection) {
                orderInfoSection.style.display = 'block';
                orderInfoSection.style.visibility = 'visible';
            }

            // Ensure size guide section is visible (hide if submitted)
            const sizeGuideSection = document.getElementById('sizeGuideSection');
            if (sizeGuideSection) {
                if (this.orderData.status === 'submitted') {
                    sizeGuideSection.style.display = 'none';
                } else {
                    sizeGuideSection.style.display = 'block';
                    sizeGuideSection.style.visibility = 'visible';
                }
            }

            // Render order information
            this.renderOrderInfo();

            // Retry rendering after a short delay if content is empty
            setTimeout(() => {
                const orderInfoContent = document.getElementById('orderInfoContent');
                if (orderInfoContent && (!orderInfoContent.innerHTML || orderInfoContent.innerHTML.trim() === '')) {
                    console.log('Retrying renderOrderInfo...');
                    this.renderOrderInfo();
                }
            }, 200);

            // Initialize size guide if not submitted
            if (this.orderData.status !== 'submitted') {
                setTimeout(() => {
                    this.initializeSizeGuide();
                }, 100);
            }

            // Check order status
            if (this.orderData.status === 'submitted') {
                this.isSubmitted = true;
                await this.loadJerseys();
                // Hide size guide for submitted orders
                const sizeGuideSection = document.getElementById('sizeGuideSection');
                if (sizeGuideSection) {
                    sizeGuideSection.style.display = 'none';
                }
                this.showSubmittedView();
                // Set up real-time listener for status changes
                this.setupStatusListener();
                return;
            } else if (this.orderData.status === 'draft') {
                // Draft status allows editing
                this.isSubmitted = false;
                await this.loadJerseys();
                if (this.jerseys.length > 0) {
                    this.showReviewSection();
                } else {
                    document.getElementById('jerseyFormSection').style.display = 'block';
                    document.getElementById('reviewSection').style.display = 'none';
                }
                // Set up real-time listener for status changes
                this.setupStatusListener();
                return;
            }

            // Load existing jerseys
            await this.loadJerseys();

            // If jerseys exist, show review section
            if (this.jerseys.length > 0) {
                this.showReviewSection();
            } else {
                // Show form section but keep form disabled until button is clicked
                document.getElementById('jerseyFormSection').style.display = 'block';
                document.getElementById('reviewSection').style.display = 'none';
            }

            // Set up real-time listener for status changes (for pending orders too)
            this.setupStatusListener();
        } catch (error) {
            console.error('Error loading order:', error);
            this.showError(error.message || 'Error loading order data');
        }
    }

    async loadJerseys() {
        if (!window.db) {
            console.error('Firebase not initialized');
            this.jerseys = [];
            return;
        }

        try {
            const jerseysSnapshot = await db.collection('orders').doc(this.orderId)
                .collection('jerseys').orderBy('created', 'asc').get();

            this.jerseys = jerseysSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error loading jerseys:', error);
            this.jerseys = [];
            this.showError('Error loading jersey details: ' + error.message);
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');

        // Enable Jersey Form button - retry if not found
        const attachEnableButtonListener = () => {
            const enableFormBtn = document.getElementById('enableJerseyFormBtn');
            if (enableFormBtn) {
                // Remove any existing listeners by cloning
                const clonedBtn = enableFormBtn.cloneNode(true);
                enableFormBtn.parentNode.replaceChild(clonedBtn, enableFormBtn);

                // Add click listener
                clonedBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Enable Jersey Form button clicked');
                    this.enableJerseyForm();
                });

                console.log('Enable Jersey Form button listener attached successfully');
                return true;
            }
            return false;
        };

        // Try to attach immediately
        if (!attachEnableButtonListener()) {
            console.warn('Enable Jersey Form button not found, retrying...');
            // Retry after a short delay
            setTimeout(() => {
                if (!attachEnableButtonListener()) {
                    console.error('Enable Jersey Form button still not found after retry');
                }
            }, 300);
        }

        // Form submission
        const form = document.getElementById('jerseyDetailsForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleJerseySubmit(e));
        }

        // Add Another button - saves to local array and shows preview
        const addAnotherBtn = document.getElementById('addAnotherBtn');
        if (addAnotherBtn) {
            addAnotherBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addToLocalJerseys();
            });
        }

        const addMoreBtn = document.getElementById('addMoreBtn');
        if (addMoreBtn) {
            addMoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showFormSection();
            });
        }

        // Submit Order button - saves all to Firebase (from review section)
        const submitOrderBtn = document.getElementById('submitOrderBtn');
        if (submitOrderBtn) {
            submitOrderBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.submitOrder();
            });
        }

        // Submit Details button - saves all to Firebase (from preview table)
        const submitDetailsBtn = document.getElementById('submitDetailsBtn');
        if (submitDetailsBtn) {
            submitDetailsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.submitOrder();
            });
        }

        // Size guide tabs
        const sizeTabs = document.querySelectorAll('.size-tab');
        sizeTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.getAttribute('data-tab');
                this.switchSizeGuideTab(tabName);
            });
        });

        // Edit form submission
        const editForm = document.getElementById('editJerseyForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));
        }

        // Modal close handlers
        const closeBtns = document.querySelectorAll('.close, #cancelEditBtn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const editModal = document.getElementById('editJerseyModal');
                if (editModal) {
                    editModal.classList.remove('active');
                    editModal.style.display = 'none';
                }
            });
        });

        // Close modal on outside click
        const modal = document.getElementById('editJerseyModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    modal.style.display = 'none';
                }
            });
        }
    }

    // Event delegation for dynamically created buttons - called separately to avoid duplicates
    setupDynamicEventListeners() {
        // Remove existing listener if any (using named function)
        if (this._dynamicClickHandler) {
            document.removeEventListener('click', this._dynamicClickHandler);
        }

        this._dynamicClickHandler = (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn) return;

            const action = actionBtn.getAttribute('data-action');
            const indexStr = actionBtn.getAttribute('data-index');
            const index = indexStr ? parseInt(indexStr, 10) : -1;

            if (action === 'edit-jersey' && index >= 0 && window.customerApp) {
                e.preventDefault();
                e.stopPropagation();
                window.customerApp.editJersey(index);
            } else if (action === 'delete-jersey' && index >= 0 && window.customerApp) {
                e.preventDefault();
                e.stopPropagation();
                window.customerApp.deleteJersey(index);
            } else if (action === 'edit-preview-jersey' && index >= 0 && window.customerApp) {
                e.preventDefault();
                e.stopPropagation();
                window.customerApp.editPreviewJersey(index);
            } else if (action === 'delete-preview-jersey' && index >= 0 && window.customerApp) {
                e.preventDefault();
                e.stopPropagation();
                window.customerApp.deletePreviewJersey(index);
            }
        };

        document.addEventListener('click', this._dynamicClickHandler);
    }

    handleJerseySubmit(e) {
        e.preventDefault();

        if (this.isSubmitted && this.orderData.status !== 'draft') {
            this.showError('Order already submitted. Cannot add more jerseys.');
            return;
        }

        // Validate and add to local jerseys
        const jerseyData = this.getFormData();
        if (!jerseyData) return; // Validation failed

        // Handle quantity - if quantity > 1, add multiple entries
        const quantity = jerseyData.quantity || 1;
        delete jerseyData.quantity; // Remove quantity from jersey data

        // Add multiple jerseys if quantity > 1
        for (let i = 0; i < quantity; i++) {
            this.localJerseys.push({
                ...jerseyData
            });
        }

        // Save to local storage
        this.saveToLocalStorage();

        // Update preview table
        this.renderPreviewTable();

        // Show quantity field after first jersey is added
        if (this.localJerseys.length > 0) {
            const quantityGroup = document.getElementById('jerseyQuantityGroup');
            if (quantityGroup) {
                quantityGroup.style.display = 'block';
            }
        }

        // Reset form (but keep quantity field visible)
        document.getElementById('jerseyDetailsForm').reset();
        const quantityField = document.getElementById('jerseyQuantity');
        if (quantityField) {
            quantityField.value = '1';
        }

        // Show success
        this.showSuccess(`Jersey added! (${quantity} item(s)) You can add another jersey or submit your details.`);
    }

    getFormData() {
        const jerseyData = {
            type: document.getElementById('jerseyType').value,
            name: document.getElementById('jerseyName').value.trim(),
            number: document.getElementById('jerseyNumber').value.trim(),
            sizeCategory: document.getElementById('jerseySizeCategory').value,
            size: document.getElementById('jerseySize').value,
            sleeve: document.getElementById('jerseySleeve').value,
            shorts: document.getElementById('jerseyShorts').value
        };

        // Get quantity if field is visible
        const quantityField = document.getElementById('jerseyQuantity');
        const quantityGroup = document.getElementById('jerseyQuantityGroup');
        if (quantityGroup && quantityGroup.style.display !== 'none' && quantityField) {
            const quantity = parseInt(quantityField.value) || 1;
            jerseyData.quantity = quantity;
        } else {
            jerseyData.quantity = 1; // Default to 1
        }

        // Validation
        if (!jerseyData.type || !jerseyData.name || !jerseyData.number || !jerseyData.sizeCategory || !jerseyData.size || !jerseyData.sleeve || !jerseyData.shorts) {
            this.showError('Please fill in all required fields');
            return null;
        }

        // Validate jersey number is numeric only
        if (!/^[0-9]+$/.test(jerseyData.number)) {
            this.showError('Jersey number must contain numbers only');
            return null;
        }

        return jerseyData;
    }

    addToLocalJerseys() {
        const jerseyData = this.getFormData();
        if (!jerseyData) return; // Validation failed

        // Handle quantity - if quantity > 1, add multiple entries
        const quantity = jerseyData.quantity || 1;
        delete jerseyData.quantity; // Remove quantity from jersey data

        // Add multiple jerseys if quantity > 1
        for (let i = 0; i < quantity; i++) {
            this.localJerseys.push({
                ...jerseyData
            });
        }

        // Save to local storage
        this.saveToLocalStorage();

        // Update preview table
        this.renderPreviewTable();

        // Show quantity field after first jersey is added
        if (this.localJerseys.length > 0) {
            const quantityGroup = document.getElementById('jerseyQuantityGroup');
            if (quantityGroup) {
                quantityGroup.style.display = 'block';
            }
        }

        // Reset form (but keep quantity field visible)
        document.getElementById('jerseyDetailsForm').reset();
        const quantityField = document.getElementById('jerseyQuantity');
        if (quantityField) {
            quantityField.value = '1';
        }

        // Focus on first field
        const jerseyType = document.getElementById('jerseyType');
        if (jerseyType) {
            jerseyType.focus();
        }

        this.showSuccess(`Jersey added! (${quantity} item(s)) You can add another or click "Save Jersey Details" to review.`);
    }

    renderPreviewTable() {
        const tbody = document.getElementById('previewTable');
        const container = document.getElementById('previewTableContainer');
        const submitBtn = document.getElementById('submitDetailsBtn');

        if (!tbody || !container) return;

        if (this.localJerseys.length === 0) {
            container.style.display = 'none';
            if (submitBtn) submitBtn.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        if (submitBtn) submitBtn.style.display = 'inline-flex';

        tbody.innerHTML = this.localJerseys.map((jersey, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${jersey.type || 'N/A'}</td>
                <td>${jersey.name || 'N/A'}</td>
                <td>${jersey.number || 'N/A'}</td>
                <td>${jersey.sizeCategory || 'N/A'}</td>
                <td>${jersey.size || 'N/A'}</td>
                <td>${jersey.sleeve || 'N/A'}</td>
                <td>${jersey.shorts || 'N/A'}</td>
                <td>
                    <button class="action-btn" data-action="edit-preview-jersey" data-index="${index}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn delete" data-action="delete-preview-jersey" data-index="${index}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    enableJerseyForm() {
        console.log('enableJerseyForm() called');
        const form = document.getElementById('jerseyDetailsForm');
        const enableSection = document.getElementById('enableFormSection');

        if (!form) {
            console.error('Jersey form not found');
            return;
        }

        if (!enableSection) {
            console.error('Enable form section not found');
        }

        form.style.display = 'block';

        // Enable all form fields
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.disabled = false;
        });

        // Enable buttons
        const buttons = form.querySelectorAll('button');
        buttons.forEach(button => {
            button.disabled = false;
        });

        // Add auto-save on input change (exclude buttons)
        inputs.forEach(input => {
            // Remove existing listeners to avoid duplicates
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);

            newInput.addEventListener('change', () => {
                this.saveToLocalStorage();
            });
            newInput.addEventListener('input', () => {
                // Debounce auto-save on input
                clearTimeout(this._saveTimeout);
                this._saveTimeout = setTimeout(() => {
                    this.saveToLocalStorage();
                }, 500);
            });
        });

        if (enableSection) {
            enableSection.style.display = 'none';
        }

        this.formEnabled = true;

        // Focus on first field
        const jerseyType = document.getElementById('jerseyType');
        if (jerseyType) {
            jerseyType.focus();
        }

        // Load form data from local storage if available
        this.loadFormDataFromStorage();

        console.log('Form enabled successfully');
    }

    showFormSection() {
        document.getElementById('reviewSection').style.display = 'none';
        document.getElementById('jerseyFormSection').style.display = 'block';

        // Enable form if it was previously enabled
        if (this.formEnabled) {
            const form = document.getElementById('jerseyDetailsForm');
            if (form) {
                form.style.display = 'block';
                const enableSection = document.getElementById('enableFormSection');
                if (enableSection) {
                    enableSection.style.display = 'none';
                }
            }
        } else {
            const form = document.getElementById('jerseyDetailsForm');
            if (form) {
                form.style.display = 'none';
            }
        }

        document.getElementById('jerseyDetailsForm').reset();

        // Focus on first field if form is enabled
        if (this.formEnabled) {
            const jerseyType = document.getElementById('jerseyType');
            if (jerseyType) {
                jerseyType.focus();
            }
        }
    }

    showReviewSection() {
        document.getElementById('jerseyFormSection').style.display = 'none';
        document.getElementById('reviewSection').style.display = 'block';

        // Show local jerseys if available, otherwise show Firebase jerseys
        const jerseysToShow = this.localJerseys.length > 0 ? this.localJerseys : this.jerseys;
        this.renderJerseysTable(jerseysToShow);
    }

    renderJerseysTable(jerseys = null) {
        const tbody = document.getElementById('jerseyReviewTable');
        if (!tbody) return;

        const jerseysToRender = jerseys !== null ? jerseys : (this.localJerseys.length > 0 ? this.localJerseys : this.jerseys);

        if (jerseysToRender.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data">No jersey details added yet</td></tr>';
            return;
        }

        tbody.innerHTML = jerseysToRender.map((jersey, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${jersey.type || 'N/A'}</td>
                <td>${jersey.name || 'N/A'}</td>
                <td>${jersey.number || 'N/A'}</td>
                <td>${jersey.sizeCategory || 'N/A'}</td>
                <td>${jersey.size || 'N/A'}</td>
                <td>${jersey.sleeve || 'N/A'}</td>
                <td>${jersey.shorts || 'N/A'}</td>
                <td>
                    <button class="action-btn" data-action="edit-jersey" data-index="${index}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn delete" data-action="delete-jersey" data-index="${index}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    editJersey(index) {
        if (this.isSubmitted && this.orderData.status !== 'draft') {
            this.showError('Order already submitted. Cannot edit jerseys.');
            return;
        }

        // Use local jerseys if available, otherwise use Firebase jerseys
        const jerseysArray = this.localJerseys.length > 0 ? this.localJerseys : this.jerseys;
        const jersey = jerseysArray[index];
        if (!jersey) return;

        this.editingIndex = index;

        document.getElementById('editJerseyType').value = jersey.type || '';
        document.getElementById('editJerseyName').value = jersey.name || '';
        document.getElementById('editJerseyNumber').value = jersey.number || '';
        document.getElementById('editJerseySizeCategory').value = jersey.sizeCategory || '';
        document.getElementById('editJerseySize').value = jersey.size || '';
        document.getElementById('editJerseySleeve').value = jersey.sleeve || '';
        document.getElementById('editJerseyShorts').value = jersey.shorts || '';

        const editModal = document.getElementById('editJerseyModal');
        if (editModal) {
            editModal.classList.add('active');
            editModal.style.display = 'flex';
        }
    }

    editPreviewJersey(index) {
        const jersey = this.localJerseys[index];
        if (!jersey) return;

        this.editingIndex = index;
        this.isEditingLocal = true;

        document.getElementById('editJerseyType').value = jersey.type || '';
        document.getElementById('editJerseyName').value = jersey.name || '';
        document.getElementById('editJerseyNumber').value = jersey.number || '';
        document.getElementById('editJerseySizeCategory').value = jersey.sizeCategory || '';
        document.getElementById('editJerseySize').value = jersey.size || '';
        document.getElementById('editJerseySleeve').value = jersey.sleeve || '';
        document.getElementById('editJerseyShorts').value = jersey.shorts || '';

        const editModal = document.getElementById('editJerseyModal');
        if (editModal) {
            editModal.classList.add('active');
            editModal.style.display = 'flex';
        }
    }
    async deletePreviewJersey(index) {
        const confirmed = await this.showConfirm(
            'Delete Jersey Entry',
            'Are you sure you want to delete this jersey entry?',
            'warning'
        );
        if (!confirmed) {
            return;
        }
        this.localJerseys.splice(index, 1);
        this.saveToLocalStorage();
        this.renderPreviewTable();
        this.renderJerseysTable(this.localJerseys);
        this.showSuccess('Jersey entry deleted successfully!');
    }

    async handleEditSubmit(e) {
        e.preventDefault();

        if (this.editingIndex === null) return;

        const updatedData = {
            type: document.getElementById('editJerseyType').value,
            name: document.getElementById('editJerseyName').value.trim(),
            number: document.getElementById('editJerseyNumber').value.trim(),
            sizeCategory: document.getElementById('editJerseySizeCategory').value,
            size: document.getElementById('editJerseySize').value,
            sleeve: document.getElementById('editJerseySleeve').value,
            shorts: document.getElementById('editJerseyShorts').value
        };

        // Validation
        if (!updatedData.type || !updatedData.name || !updatedData.number || !updatedData.sizeCategory || !updatedData.size || !updatedData.sleeve || !updatedData.shorts) {
            this.showError('Please fill in all required fields');
            return;
        }

        // Validate jersey number is numeric only
        if (!/^[0-9]+$/.test(updatedData.number)) {
            this.showError('Jersey number must contain numbers only');
            return;
        }

        try {
            // If editing local jersey (not yet saved to Firebase)
            if (this.isEditingLocal) {
                this.localJerseys[this.editingIndex] = updatedData;
                this.saveToLocalStorage();
                this.renderPreviewTable();
                this.renderJerseysTable(this.localJerseys);
                this.isEditingLocal = false;
            } else {
                // Editing Firebase jersey
                const jersey = this.jerseys[this.editingIndex];
                if (!jersey) return;

                await db.collection('orders').doc(this.orderId)
                    .collection('jerseys').doc(jersey.id).update(updatedData);

                this.jerseys[this.editingIndex] = {
                    ...jersey,
                    ...updatedData
                };

                await this.updateOrderQuantity();
                this.renderJerseysTable();
            }

            // Close modal
            const editModal = document.getElementById('editJerseyModal');
            if (editModal) {
                editModal.classList.remove('active');
                editModal.style.display = 'none';
            }
            this.editingIndex = null;

            this.showSuccess('Jersey details updated successfully!');
        } catch (error) {
            console.error('Error updating jersey:', error);
            this.showError('Error updating jersey details: ' + error.message);
        }
    }

    async deleteJersey(index) {
        if (this.isSubmitted && this.orderData.status !== 'draft') {
            this.showError('Order already submitted. Cannot delete jerseys.');
            return;
        }

        // Check if deleting from local or Firebase jerseys
        if (this.localJerseys.length > 0) {
            // Deleting from local jerseys (preview/review section)
            const confirmed = await this.showConfirm(
                'Delete Jersey Entry',
                'Are you sure you want to delete this jersey entry?',
                'warning'
            );
            if (!confirmed) {
                return;
            }
            this.localJerseys.splice(index, 1);
            this.saveToLocalStorage();
            this.renderPreviewTable();
            this.renderJerseysTable(this.localJerseys);
            this.showSuccess('Jersey entry deleted successfully!');
            return;
        }

        // Deleting from Firebase
        const jersey = this.jerseys[index];
        if (!jersey) return;

        const confirmed = await this.showConfirm(
            'Delete Jersey Entry',
            'Are you sure you want to delete this jersey entry?',
            'warning'
        );
        if (!confirmed) {
            return;
        }

        try {
            // Delete from Firebase
            await db.collection('orders').doc(this.orderId)
                .collection('jerseys').doc(jersey.id).delete();

            // Remove from local array
            this.jerseys.splice(index, 1);

            // Update order quantity to match number of jerseys
            await this.updateOrderQuantity();

            // Refresh table
            this.renderJerseysTable();

            // If no jerseys left, show form section
            if (this.jerseys.length === 0) {
                document.getElementById('jerseyFormSection').style.display = 'block';
                document.getElementById('reviewSection').style.display = 'none';
            }

            this.showSuccess('Jersey entry deleted successfully!');
        } catch (error) {
            console.error('Error deleting jersey:', error);
            this.showError('Error deleting jersey entry: ' + error.message);
        }
    }

    async submitOrder() {
        // Use local jerseys if available, otherwise use Firebase jerseys
        const jerseysToSubmit = this.localJerseys.length > 0 ? this.localJerseys : this.jerseys;

        if (jerseysToSubmit.length === 0) {
            this.showError('Please add at least one jersey before submitting.');
            return;
        }

        const confirmed = await this.showConfirm(
            'Submit Order',
            'Are you sure you want to submit this order? You will not be able to make changes after submission.',
            'warning'
        );
        if (!confirmed) {
            return;
        }

        try {
            // If there are local jerseys, save them all to Firebase
            if (this.localJerseys.length > 0) {
                const batch = db.batch();
                const jerseysRef = db.collection('orders').doc(this.orderId).collection('jerseys');

                // Save all local jerseys to Firebase
                this.localJerseys.forEach((jersey) => {
                    const jerseyRef = jerseysRef.doc();
                    batch.set(jerseyRef, {
                        ...jersey,
                        created: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });

                await batch.commit();

                // Move local jerseys to Firebase jerseys array
                this.jerseys = [...this.localJerseys];
                this.localJerseys = [];

                // Clear local storage after successful submission
                this.clearLocalStorage();
            }

            // Get ACTUAL jersey count from Firebase (in case there are existing jerseys)
            // This ensures accuracy even if jerseys were added in multiple sessions
            const jerseysSnapshot = await db.collection('orders').doc(this.orderId)
                .collection('jerseys').get();
            const jerseyCount = jerseysSnapshot.size;

            console.log('Total jerseys in Firebase:', jerseyCount);

            // Update order status and quantity with the actual count from Firebase
            await db.collection('orders').doc(this.orderId).update({
                status: 'submitted',
                amount: jerseyCount, // Update quantity to match actual number of jerseys in Firebase
                submittedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Verify the update was successful
            const updatedOrderDoc = await db.collection('orders').doc(this.orderId).get();
            const updatedOrderData = updatedOrderDoc.data();
            console.log('Order updated with amount:', updatedOrderData.amount);

            // Create notification for admin when customer submits jersey details
            try {
                const notification = {
                    type: 'success',
                    title: 'Jersey Details Submitted',
                    message: `${this.orderData.customer || 'Customer'} has submitted ${jerseyCount} jersey detail(s) for Order ${this.orderId.substring(0, 8)}`,
                    read: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    orderId: this.orderId,
                    customerName: this.orderData.customer || 'Customer',
                    jerseyCount: jerseyCount
                };

                await db.collection('notifications').add(notification);
                console.log('Notification created for admin');
            } catch (error) {
                console.error('Error creating notification:', error);
                // Don't fail the submission if notification creation fails
            }

            // Reload jerseys from Firebase to ensure sync
            await this.loadJerseys();

            // Create or update customer in customers collection when order is submitted
            try {
                if (this.orderData && this.orderData.customer && this.orderData.mobile) {
                    // Check if customer already exists by name and mobile
                    const existingCustomers = await db.collection('customers')
                        .where('name', '==', this.orderData.customer)
                        .where('phone', '==', this.orderData.mobile)
                        .limit(1)
                        .get();

                    const customerData = {
                        name: this.orderData.customer,
                        phone: this.orderData.mobile,
                        email: this.orderData.email || '',
                        status: 'active',
                        lastOrderDate: firebase.firestore.FieldValue.serverTimestamp(),
                        latestOrderId: this.orderId // Link to latest order
                    };

                    if (existingCustomers.empty) {
                        // Create new customer
                        customerData.joined = firebase.firestore.FieldValue.serverTimestamp();
                        await db.collection('customers').add(customerData);
                    } else {
                        // Update existing customer
                        const customerDoc = existingCustomers.docs[0];
                        await db.collection('customers').doc(customerDoc.id).update({
                            lastOrderDate: firebase.firestore.FieldValue.serverTimestamp(),
                            latestOrderId: this.orderId, // Update with latest order
                            // Update email if provided and not already set
                            ...(this.orderData.email && {
                                email: this.orderData.email
                            })
                        });
                    }
                }
            } catch (error) {
                console.error('Error creating/updating customer:', error);
                // Don't fail the submission if customer creation fails
            }

            // Reload order data to get latest status and updated quantity
            await this.loadOrderData();

            // Force re-render of order info to show updated quantity
            if (this.orderData) {
                console.log('Order data after reload - amount:', this.orderData.amount);
                this.renderOrderInfo();
            }

            this.isSubmitted = true;
            this.showSubmittedView();
            this.showSuccess('Order submitted successfully! Thank you for your order.');
        } catch (error) {
            console.error('Error submitting order:', error);
            this.showError('Error submitting order: ' + error.message);
        }
    }

    showSubmittedView() {
        // Hide sections
        document.getElementById('jerseyFormSection').style.display = 'none';
        document.getElementById('reviewSection').style.display = 'none';
        const sizeGuideSection = document.getElementById('sizeGuideSection');
        if (sizeGuideSection) {
            sizeGuideSection.style.display = 'none';
        }

        // Show submitted section
        document.getElementById('submittedSection').style.display = 'block';

        // Keep order info section visible
        const orderInfoSection = document.getElementById('orderInfoSection');
        if (orderInfoSection) {
            orderInfoSection.style.display = 'block';
        }

        this.renderSubmittedTable();
    }

    renderSubmittedTable() {
        const tbody = document.getElementById('submittedJerseyTable');
        if (!tbody) return;

        tbody.innerHTML = this.jerseys.map((jersey, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${jersey.type || 'N/A'}</td>
                <td>${jersey.name || 'N/A'}</td>
                <td>${jersey.number || 'N/A'}</td>
                <td>${jersey.sizeCategory || 'N/A'}</td>
                <td>${jersey.size || 'N/A'}</td>
                <td>${jersey.sleeve || 'N/A'}</td>
                <td>${jersey.shorts || 'N/A'}</td>
            </tr>
        `).join('');
    }

    renderOrderInfo() {
        console.log('Rendering order info...', this.orderData);

        // Ensure DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.renderOrderInfo();
            });
            return;
        }

        const orderInfoContent = document.getElementById('orderInfoContent');
        if (!orderInfoContent) {
            console.error('Order info content element not found, retrying...');
            // Try again after a short delay
            setTimeout(() => {
                const retryElement = document.getElementById('orderInfoContent');
                if (retryElement && this.orderData) {
                    this.renderOrderInfo();
                } else {
                    console.error('Order info content element still not found after retry');
                }
            }, 300);
            return;
        }

        if (!this.orderData) {
            console.error('Order data not available');
            return;
        }

        console.log('Order data available, rendering:', this.orderData);

        const formatDate = (timestamp) => {
            if (!timestamp) return 'N/A';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        };

        const getStatusBadge = (status) => {
            const statusMap = {
                'pending': '<span class="status-badge status-pending">Pending</span>',
                'draft': '<span class="status-badge status-draft">Draft</span>',
                'submitted': '<span class="status-badge status-submitted">Submitted</span>',
                'completed': '<span class="status-badge status-completed">Completed</span>'
            };
            return statusMap[status] || `<span class="status-badge">${status || 'N/A'}</span>`;
        };

        orderInfoContent.innerHTML = `
            <div class="order-info-item">
                <label>Order ID:</label>
                <span>${this.orderData.id || 'N/A'}</span>
            </div>
            <div class="order-info-item">
                <label>Customer:</label>
                <span>${this.orderData.customer || 'N/A'}</span>
            </div>
            <div class="order-info-item">
                <label>Mobile:</label>
                <span>${this.orderData.mobile || 'N/A'}</span>
            </div>
            <div class="order-info-item">
                <label>Material:</label>
                <span>${this.orderData.product || this.orderData.material || 'N/A'}</span>
            </div>
            <div class="order-info-item">
                <label>Quantity:</label>
                <span>${this.orderData.amount || this.orderData.quantity || 0}</span>
            </div>
            <div class="order-info-item">
                <label>Status:</label>
                ${getStatusBadge(this.orderData.status)}
            </div>
            <div class="order-info-item">
                <label>Order Date:</label>
                <span>${formatDate(this.orderData.date)}</span>
            </div>
        `;

        // Verify content was set
        if (orderInfoContent.innerHTML.trim() === '') {
            console.error('Order info content is empty after rendering');
        } else {
            console.log('Order info rendered successfully');
        }
    }

    initializeSizeGuide() {
        console.log('Initializing size guide...');

        // Wait for DOM if needed
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.initializeSizeGuide(), 100);
            });
            return;
        }

        // Ensure size guide section is visible
        const sizeGuideSection = document.getElementById('sizeGuideSection');
        if (sizeGuideSection && (!this.orderData || this.orderData.status !== 'submitted')) {
            sizeGuideSection.style.display = 'block';
            sizeGuideSection.style.visibility = 'visible';
        }

        // Adults Size Guide
        const adultsGuide = document.getElementById('adultsGuide');
        if (!adultsGuide) {
            console.error('Adults guide element not found, retrying...');
            // Retry after a short delay
            setTimeout(() => {
                if (document.getElementById('adultsGuide')) {
                    this.initializeSizeGuide();
                }
            }, 200);
            return;
        }

        console.log('Found adults guide element, setting content...');
        adultsGuide.innerHTML = `
                <div class="size-guide-instructions">
                    <h3>All Measurements Are In Inches</h3>
                    <ul>
                        <li><strong>WIDTH</strong> is measured from armpit to armpit</li>
                        <li><strong>LENGTH</strong> is measured from highest point of the shoulder to bottom hem</li>
                        <li><strong>SLEEVE</strong> is measured from the center over the shoulder, down to the end of the cuff</li>
                        <li>For relaxed fit, go for a size up</li>
                        <li><strong>PRO TIP!</strong> Measure your actual T-shirt size and compare with the size guide given below</li>
                    </ul>
                </div>
                <div class="size-guide-table-wrapper">
                    <table class="size-guide-table">
                        <thead>
                            <tr>
                                <th>SIZE</th>
                                <th>2XS</th>
                                <th>XS</th>
                                <th>S</th>
                                <th>M</th>
                                <th>L</th>
                                <th>XL</th>
                                <th>2XL</th>
                                <th>3XL</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>CHEST</strong></td>
                                <td>17</td>
                                <td>18</td>
                                <td>19</td>
                                <td>20</td>
                                <td>21</td>
                                <td>22</td>
                                <td>23</td>
                                <td>24</td>
                            </tr>
                            <tr>
                                <td><strong>LENGTH</strong></td>
                                <td>24</td>
                                <td>25</td>
                                <td>26</td>
                                <td>27</td>
                                <td>28</td>
                                <td>29</td>
                                <td>30</td>
                                <td>31</td>
                            </tr>
                            <tr>
                                <td><strong>SHORT SLEEVE</strong></td>
                                <td>6.5</td>
                                <td>7</td>
                                <td>7.5</td>
                                <td>8</td>
                                <td>8.5</td>
                                <td>9</td>
                                <td>9.5</td>
                                <td>10</td>
                            </tr>
                            <tr>
                                <td><strong>LONG SLEEVE</strong></td>
                                <td>20</td>
                                <td>21</td>
                                <td>22</td>
                                <td>23</td>
                                <td>24</td>
                                <td>25</td>
                                <td>26</td>
                                <td>27</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="size-guide-note">
                    <p><em>Please note the indicated can have a tolerance +/- half inch (1.3 inches)</em></p>
                </div>
            `;
        console.log('Adults guide content set');

        // Kids Size Guide
        const kidsGuide = document.getElementById('kidsGuide');
        if (!kidsGuide) {
            console.error('Kids guide element not found');
            // Retry after a short delay
            setTimeout(() => this.initializeSizeGuide(), 100);
            return;
        }

        console.log('Found kids guide element, setting content...');
        kidsGuide.innerHTML = `
                <div class="size-guide-instructions">
                    <h3>All Measurements Are In Inches</h3>
                    <ul>
                        <li><strong>WIDTH</strong> is measured from armpit to armpit</li>
                        <li><strong>LENGTH</strong> is measured from highest point of the shoulder to bottom hem</li>
                        <li><strong>SLEEVE</strong> is measured from the center over the shoulder, down to the end of the cuff</li>
                        <li>For relaxed fit, go for a size up</li>
                        <li><strong>PRO TIP!</strong> Measure your actual T-shirt size and compare with the size guide given below</li>
                    </ul>
                </div>
                <div class="size-guide-table-wrapper">
                    <table class="size-guide-table">
                        <thead>
                            <tr>
                                <th>SIZE</th>
                                <th>3XS</th>
                                <th>2XS</th>
                                <th>XS</th>
                                <th>S</th>
                                <th>M</th>
                                <th>L</th>
                                <th>XL</th>
                                <th>2XL</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>CHEST</strong></td>
                                <td>8</td>
                                <td>10</td>
                                <td>11</td>
                                <td>12</td>
                                <td>13</td>
                                <td>14</td>
                                <td>15</td>
                                <td>16</td>
                            </tr>
                            <tr>
                                <td><strong>LENGTH</strong></td>
                                <td>13</td>
                                <td>15</td>
                                <td>16</td>
                                <td>17</td>
                                <td>18</td>
                                <td>19</td>
                                <td>20</td>
                                <td>21</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="size-guide-note">
                    <p><em>Please note the indicated can have a tolerance +/- half inch (1.3 inches)</em></p>
                </div>
            `;
        console.log('Kids guide content set');

        // Muslimah Size Guide
        const muslimahGuide = document.getElementById('muslimahGuide');
        if (!muslimahGuide) {
            console.error('Muslimah guide element not found');
            // Retry after a short delay
            setTimeout(() => this.initializeSizeGuide(), 100);
            return;
        }

        console.log('Found muslimah guide element, setting content...');
        muslimahGuide.innerHTML = `
                <div class="size-guide-instructions">
                    <h3>All Measurements Are In Inches</h3>
                    <ul>
                        <li><strong>WIDTH</strong> is measured from armpit to armpit</li>
                        <li><strong>LENGTH</strong> is measured from highest point of the shoulder to bottom hem</li>
                        <li><strong>SLEEVE</strong> is measured from the center over the shoulder, down to the end of the cuff</li>
                        <li>For relaxed fit, go for a size up</li>
                        <li><strong>PRO TIP!</strong> Measure your actual T-shirt size and compare with the size guide given below</li>
                    </ul>
                </div>
                <div class="size-guide-table-wrapper">
                    <table class="size-guide-table">
                        <thead>
                            <tr>
                                <th>SIZE</th>
                                <th>S</th>
                                <th>M</th>
                                <th>L</th>
                                <th>XL</th>
                                <th>2XL</th>
                                <th>3XL</th>
                                <th>4XL</th>
                                <th>5XL</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>CHEST</strong></td>
                                <td>19</td>
                                <td>20</td>
                                <td>21</td>
                                <td>22</td>
                                <td>23</td>
                                <td>24</td>
                                <td>25</td>
                                <td>26</td>
                            </tr>
                            <tr>
                                <td><strong>LENGTH</strong></td>
                                <td>35</td>
                                <td>36</td>
                                <td>37</td>
                                <td>38</td>
                                <td>39</td>
                                <td>40</td>
                                <td>41</td>
                                <td>42</td>
                            </tr>
                            <tr>
                                <td><strong>LONG SLEEVE</strong></td>
                                <td>20</td>
                                <td>21</td>
                                <td>22</td>
                                <td>23</td>
                                <td>24</td>
                                <td>25</td>
                                <td>26</td>
                                <td>27</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="size-guide-note">
                    <p><em>Please note the indicated can have a tolerance +/- half inch (1.3 inches)</em></p>
                </div>
            `;
        console.log('Muslimah guide content set');

        console.log('Size guide initialized successfully');
    }

    switchSizeGuideTab(tabName) {
        // Remove active class from all tabs and panels
        document.querySelectorAll('.size-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.size-guide-panel').forEach(panel => panel.classList.remove('active'));

        // Add active class to selected tab
        const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }

        // Show corresponding panel
        const panelMap = {
            'adults': 'adultsGuide',
            'kids': 'kidsGuide',
            'muslimah': 'muslimahGuide'
        };

        const panelId = panelMap[tabName];
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.add('active');
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    async updateOrderQuantity() {
        try {
            if (!window.db || !this.orderId) return;

            // Get current jersey count
            const jerseyCount = this.jerseys.length;

            // Update order quantity in Firebase
            await db.collection('orders').doc(this.orderId).update({
                amount: jerseyCount
            });
        } catch (error) {
            console.error('Error updating order quantity:', error);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Custom Alert Dialog
    async showAlert(title, message, type = 'info') {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const dialogIcon = document.getElementById('dialogIcon');
            const dialogTitle = document.getElementById('dialogTitle');
            const dialogMessage = document.getElementById('dialogMessage');
            const dialogButtons = document.getElementById('dialogButtons');

            if (!dialog || !dialogIcon || !dialogTitle || !dialogMessage || !dialogButtons) {
                console.error('Custom dialog elements not found');
                resolve();
                return;
            }

            // Set icon based on type
            const icons = {
                info: 'info-circle',
                success: 'check-circle',
                warning: 'exclamation-triangle',
                error: 'times-circle'
            };

            dialogIcon.className = `custom-dialog-icon ${type}`;
            dialogIcon.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i>`;

            dialogTitle.textContent = title;
            dialogMessage.textContent = message;

            // Clear existing buttons
            dialogButtons.innerHTML = '';

            // Add OK button
            const okBtn = document.createElement('button');
            okBtn.className = 'custom-dialog-btn gradient';
            okBtn.textContent = 'OK';
            okBtn.onclick = () => {
                dialog.classList.remove('active');
                resolve();
            };
            dialogButtons.appendChild(okBtn);

            dialog.classList.add('active');

            // Close on outside click
            dialog.onclick = (e) => {
                if (e.target === dialog) {
                    dialog.classList.remove('active');
                    resolve();
                }
            };
        });
    }

    // Custom Confirm Dialog
    async showConfirm(title, message, type = 'warning') {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const dialogIcon = document.getElementById('dialogIcon');
            const dialogTitle = document.getElementById('dialogTitle');
            const dialogMessage = document.getElementById('dialogMessage');
            const dialogButtons = document.getElementById('dialogButtons');

            if (!dialog || !dialogIcon || !dialogTitle || !dialogMessage || !dialogButtons) {
                console.error('Custom dialog elements not found');
                resolve(false);
                return;
            }

            // Set icon based on type
            const icons = {
                info: 'info-circle',
                success: 'check-circle',
                warning: 'exclamation-triangle',
                error: 'times-circle'
            };

            dialogIcon.className = `custom-dialog-icon ${type}`;
            dialogIcon.innerHTML = `<i class="fas fa-${icons[type] || 'exclamation-triangle'}"></i>`;

            dialogTitle.textContent = title;
            dialogMessage.textContent = message;

            // Clear existing buttons
            dialogButtons.innerHTML = '';

            // Add Cancel button
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'custom-dialog-btn secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = () => {
                dialog.classList.remove('active');
                resolve(false);
            };
            dialogButtons.appendChild(cancelBtn);

            // Add Confirm button
            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'custom-dialog-btn gradient';
            confirmBtn.textContent = 'Confirm';
            confirmBtn.onclick = () => {
                dialog.classList.remove('active');
                resolve(true);
            };
            dialogButtons.appendChild(confirmBtn);

            dialog.classList.add('active');

            // Close on outside click
            dialog.onclick = (e) => {
                if (e.target === dialog) {
                    dialog.classList.remove('active');
                    resolve(false);
                }
            };
        });
    }

    // Local Storage Persistence
    getStorageKey() {
        return `jersey_data_${this.orderId}_${this.token}`;
    }

    saveToLocalStorage() {
        try {
            const storageKey = this.getStorageKey();
            const dataToSave = {
                localJerseys: this.localJerseys,
                formData: this.getCurrentFormData(),
                formEnabled: this.formEnabled,
                timestamp: Date.now()
            };
            localStorage.setItem(storageKey, JSON.stringify(dataToSave));
        } catch (error) {
            console.error('Error saving to local storage:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            // Make sure orderId and token are available
            if (!this.orderId || !this.token) {
                return;
            }

            const storageKey = this.getStorageKey();
            const savedData = localStorage.getItem(storageKey);

            if (savedData) {
                const data = JSON.parse(savedData);

                // Restore local jerseys
                if (data.localJerseys && Array.isArray(data.localJerseys)) {
                    this.localJerseys = data.localJerseys;

                    // Restore preview table if there are jerseys
                    if (this.localJerseys.length > 0) {
                        this.renderPreviewTable();

                        // Show quantity field if jerseys exist
                        const quantityGroup = document.getElementById('jerseyQuantityGroup');
                        if (quantityGroup) {
                            quantityGroup.style.display = 'block';
                        }

                        // Enable form and hide enable button if form was enabled
                        if (data.formEnabled) {
                            // Make sure form exists before enabling
                            const form = document.getElementById('jerseyDetailsForm');
                            if (form) {
                                this.enableJerseyForm();
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading from local storage:', error);
        }
    }

    getCurrentFormData() {
        try {
            const jerseyTypeEl = document.getElementById('jerseyType');
            const jerseyNameEl = document.getElementById('jerseyName');
            const jerseyNumberEl = document.getElementById('jerseyNumber');
            const jerseySizeCategoryEl = document.getElementById('jerseySizeCategory');
            const jerseySizeEl = document.getElementById('jerseySize');
            const jerseySleeveEl = document.getElementById('jerseySleeve');
            const jerseyShortsEl = document.getElementById('jerseyShorts');
            const jerseyQuantityEl = document.getElementById('jerseyQuantity');

            return {
                jerseyType: jerseyTypeEl ? jerseyTypeEl.value : '',
                jerseyName: jerseyNameEl ? jerseyNameEl.value : '',
                jerseyNumber: jerseyNumberEl ? jerseyNumberEl.value : '',
                jerseySizeCategory: jerseySizeCategoryEl ? jerseySizeCategoryEl.value : '',
                jerseySize: jerseySizeEl ? jerseySizeEl.value : '',
                jerseySleeve: jerseySleeveEl ? jerseySleeveEl.value : '',
                jerseyShorts: jerseyShortsEl ? jerseyShortsEl.value : '',
                jerseyQuantity: jerseyQuantityEl ? jerseyQuantityEl.value : '1'
            };
        } catch (error) {
            return {};
        }
    }

    loadFormDataFromStorage() {
        try {
            const storageKey = this.getStorageKey();
            const savedData = localStorage.getItem(storageKey);

            if (savedData) {
                const data = JSON.parse(savedData);

                if (data.formData) {
                    // Restore form field values
                    if (data.formData.jerseyType) document.getElementById('jerseyType').value = data.formData.jerseyType;
                    if (data.formData.jerseyName) document.getElementById('jerseyName').value = data.formData.jerseyName;
                    if (data.formData.jerseyNumber) document.getElementById('jerseyNumber').value = data.formData.jerseyNumber;
                    if (data.formData.jerseySizeCategory) document.getElementById('jerseySizeCategory').value = data.formData.jerseySizeCategory;
                    if (data.formData.jerseySize) document.getElementById('jerseySize').value = data.formData.jerseySize;
                    if (data.formData.jerseySleeve) document.getElementById('jerseySleeve').value = data.formData.jerseySleeve;
                    if (data.formData.jerseyShorts) document.getElementById('jerseyShorts').value = data.formData.jerseyShorts;
                    if (data.formData.jerseyQuantity) document.getElementById('jerseyQuantity').value = data.formData.jerseyQuantity;
                }
            }
        } catch (error) {
            console.error('Error loading form data from storage:', error);
        }
    }

    clearLocalStorage() {
        try {
            const storageKey = this.getStorageKey();
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.error('Error clearing local storage:', error);
        }
    }

    setupStatusListener() {
        // Set up real-time listener for order status changes
        if (!window.db || !this.orderId) return;

        // Clean up existing listener if any
        if (this.orderStatusListener) {
            this.orderStatusListener();
        }

        this.orderStatusListener = db.collection('orders').doc(this.orderId)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const orderData = doc.data();
                    const oldStatus = (this.orderData && this.orderData.status) ? this.orderData.status : null;
                    const newStatus = orderData.status;
                    const oldAmount = (this.orderData && this.orderData.amount) ? this.orderData.amount : null;
                    const newAmount = orderData.amount;

                    // Update local order data
                    this.orderData = {
                        id: doc.id,
                        ...orderData
                    };

                    console.log('Order updated via listener - new amount:', newAmount, 'old amount:', oldAmount);

                    // Re-render order info when status or amount changes
                    if (oldStatus !== newStatus || oldAmount !== newAmount) {
                        this.renderOrderInfo();
                    }

                    // If status changed to draft, allow editing
                    if (oldStatus === 'submitted' && newStatus === 'draft') {
                        this.isSubmitted = false;
                        this.showSuccess('Order status updated to Draft. You can now edit your jersey details.');

                        // Reload jerseys in case admin made changes
                        this.loadJerseys().then(() => {
                            if (this.jerseys.length > 0) {
                                this.showReviewSection();
                            } else {
                                document.getElementById('jerseyFormSection').style.display = 'block';
                                document.getElementById('reviewSection').style.display = 'none';
                                document.getElementById('submittedSection').style.display = 'none';
                            }
                        });
                    } else if (oldStatus === 'draft' && newStatus === 'submitted') {
                        // Status changed back to submitted
                        this.isSubmitted = true;
                        this.showSubmittedView();
                    }
                }
            }, (error) => {
                console.error('Error listening to order status:', error);
            });
    }
}

// Initialize app when DOM is ready
let customerApp;

function initializeCustomerApp() {
    try {
        console.log('Initializing CustomerApp...');

        // Wait a bit for scripts to load
        setTimeout(() => {
            // Create CustomerApp instance
            customerApp = new CustomerApp();
            window.customerApp = customerApp;

            // Wait for Firebase and then initialize
            customerApp.waitForFirebase().then(() => {
                console.log('Firebase ready, calling init()...');
                return customerApp.init();
            }).catch(err => {
                console.error('Firebase initialization failed:', err);
                if (customerApp && typeof customerApp.showError === 'function') {
                    customerApp.showError('Firebase not initialized. Please refresh the page.');
                } else {
                    alert('Firebase not initialized. Please refresh the page.');
                }
            });
        }, 100);
    } catch (error) {
        console.error('Error creating CustomerApp:', error);
        alert('Error initializing application: ' + error.message);
    }
}

// Wait for all scripts to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeCustomerApp, 100);
    });
} else {
    // DOM already ready, wait a bit for scripts
    setTimeout(initializeCustomerApp, 100);
}