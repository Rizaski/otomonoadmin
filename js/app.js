// Main Application Logic
class App {
    constructor() {
        this.orders = [];
        this.allOrders = []; // Initialize allOrders to prevent undefined issues
        this.customers = [];
        this.materials = [];
        this.suppliers = [];
        this.designs = [];
        this.currentViewingOrderId = null;
        this.currentOrderJerseys = [];
        this.currentEditingJerseyId = null;
        this.currentOrderLink = null;
        this.currentEmailSupplierData = null;

        // Pagination state (10 records per page)
        this.pagination = {
            recentOrders: {
                currentPage: 1,
                pageSize: 10
            },
            orders: {
                currentPage: 1,
                pageSize: 10
            },
            customers: {
                currentPage: 1,
                pageSize: 10
            },
            materials: {
                currentPage: 1,
                pageSize: 10
            },
            suppliers: {
                currentPage: 1,
                pageSize: 10
            }
        };

        // Firebase listeners for real-time updates
        this.firebaseListeners = {
            orders: null,
            customers: null,
            materials: null,
            suppliers: null,
            allOrders: null,
            notifications: null
        };

        // Wait for Firebase to be ready before initializing
        this.waitForFirebase().then(() => {
            this.init();
        }).catch(err => {
            console.error('Firebase initialization failed:', err);
            if (this.showNotification) {
                this.showNotification('Firebase initialization failed. Please refresh the page.', 'error');
            }
        });
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

    init() {
        this.setupEventListeners();
        this.setupModals();
        this.loadData();
        this.setupRealtimeListeners(); // Set up real-time Firebase listeners
        this.initializeCharts();
        this.setupSidebarToggle();
        this.loadNotifications(); // Load notifications on init
        this.loadProfileData(); // Load profile data on init

        // Listen for page changes
        window.addEventListener('pagechange', (e) => {
            if (this.onPageChange) {
                this.onPageChange(e.detail.page);
            }
        });
    }

    setupRealtimeListeners() {
        if (!window.db) {
            console.warn('Firebase not initialized, skipping real-time listeners');
            return;
        }

        try {
            // Real-time listener for orders (for dashboard)
            if (!this.firebaseListeners.orders) {
                this.firebaseListeners.orders = db.collection('orders')
                    .orderBy('date', 'desc')
                    .limit(10)
                    .onSnapshot((snapshot) => {
                        this.orders = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        this.renderRecentOrders();
                        this.updateKPIs();
                    }, (error) => {
                        console.error('Error in orders listener:', error);
                    });
            }

            // Real-time listener for all orders (for orders page)
            if (!this.firebaseListeners.allOrders) {
                this.firebaseListeners.allOrders = db.collection('orders')
                    .orderBy('date', 'desc')
                    .onSnapshot((snapshot) => {
                        this.allOrders = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        // Only render if we're on the orders page
                        const ordersPage = document.getElementById('orders');
                        if (ordersPage && ordersPage.classList.contains('active')) {
                            this.renderOrders();
                        }
                        this.updateKPIs();
                        this.updateCharts();
                    }, (error) => {
                        console.error('Error in allOrders listener:', error);
                    });
            }

            // Real-time listener for customers
            if (!this.firebaseListeners.customers) {
                this.firebaseListeners.customers = db.collection('customers')
                    .onSnapshot((snapshot) => {
                        this.customers = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        // Only render if we're on the customers page
                        const customersPage = document.getElementById('customers');
                        if (customersPage && customersPage.classList.contains('active')) {
                            this.renderCustomers();
                        }
                        this.updateKPIs();
                    }, (error) => {
                        console.error('Error in customers listener:', error);
                    });
            }

            // Real-time listener for materials
            if (!this.firebaseListeners.materials) {
                this.firebaseListeners.materials = db.collection('materials')
                    .onSnapshot((snapshot) => {
                        this.materials = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        // Only render if we're on the materials page
                        const materialsPage = document.getElementById('materials');
                        if (materialsPage && materialsPage.classList.contains('active')) {
                            this.renderMaterials();
                        }
                        // Update order form dropdown if modal is open
                        const orderModal = document.getElementById('orderModal');
                        if (orderModal && orderModal.classList.contains('active')) {
                            const materialSelect = document.getElementById('orderMaterial');
                            if (materialSelect && this.materials.length > 0) {
                                const currentValue = materialSelect.value;
                                materialSelect.innerHTML = '<option value="">Select Material</option>' +
                                    this.materials.map(m =>
                                        `<option value="${m.id}" data-price="${m.price || 0}" data-stock="${m.stock || 0}">${m.name} - $${(m.price || 0).toFixed(2)} (Stock: ${m.stock || 0})</option>`
                                    ).join('');
                                if (currentValue) {
                                    materialSelect.value = currentValue;
                                }
                            }
                        }
                        this.updateKPIs();
                    }, (error) => {
                        console.error('Error in materials listener:', error);
                    });
            }

            // Real-time listener for suppliers
            if (!this.firebaseListeners.suppliers) {
                this.firebaseListeners.suppliers = db.collection('suppliers')
                    .onSnapshot((snapshot) => {
                        this.suppliers = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        // Only render if we're on the suppliers page
                        const suppliersPage = document.getElementById('suppliers');
                        if (suppliersPage && suppliersPage.classList.contains('active')) {
                            this.renderSuppliers();
                        }
                        // Update order form dropdown if modal is open
                        const orderModal = document.getElementById('orderModal');
                        if (orderModal && orderModal.classList.contains('active')) {
                            const supplierSelect = document.getElementById('orderSupplier');
                            if (supplierSelect && this.suppliers.length > 0) {
                                const currentValue = supplierSelect.value;
                                supplierSelect.innerHTML = '<option value="">-- Select Supplier --</option>' +
                                    this.suppliers.filter(s => s.status === 'active').map(s =>
                                        `<option value="${s.id}">${s.name} (${s.location})</option>`
                                    ).join('');
                                if (currentValue) {
                                    supplierSelect.value = currentValue;
                                }
                            }
                        }
                        this.updateKPIs();
                    }, (error) => {
                        console.error('Error in suppliers listener:', error);
                    });
            }

            // Real-time listener for notifications
            if (!this.firebaseListeners.notifications) {
                this.firebaseListeners.notifications = db.collection('notifications')
                    .orderBy('timestamp', 'desc')
                    .limit(20)
                    .onSnapshot((snapshot) => {
                        this.notifications = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        this.renderNotifications();
                        this.updateNotificationBadge();

                        // Show toast notification for new unread notifications
                        snapshot.docChanges().forEach(change => {
                            if (change.type === 'added' && !change.doc.data().read) {
                                const notifData = change.doc.data();
                                // Show toast notification with title and message
                                this.showNotification(
                                    `${notifData.title || 'New Notification'}: ${notifData.message || ''}`,
                                    notifData.type || 'info'
                                );

                                // Optional: Request notification permission and show desktop notification
                                if ('Notification' in window && Notification.permission === 'granted') {
                                    try {
                                        new Notification(notifData.title || 'New Notification', {
                                            body: notifData.message || '',
                                            icon: 'Public/logo.png',
                                            badge: 'Public/logo.png',
                                            tag: `notification-${change.doc.id}`
                                        });
                                    } catch (err) {
                                        // Desktop notifications might not be available
                                        console.debug('Desktop notification not available:', err);
                                    }
                                }
                            }
                        });
                    }, (error) => {
                        console.error('Error in notifications listener:', error);
                        // Fallback to loading notifications manually
                        this.loadNotifications();
                    });
            }
        } catch (error) {
            console.error('Error setting up real-time listeners:', error);
        }
    }

    cleanupRealtimeListeners() {
        // Clean up all Firebase listeners to prevent memory leaks
        Object.keys(this.firebaseListeners).forEach(key => {
            if (this.firebaseListeners[key]) {
                this.firebaseListeners[key]();
                this.firebaseListeners[key] = null;
            }
        });
    }

    setupSidebarToggle() {
        // Mobile sidebar toggle
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const sidebar = document.querySelector('.sidebar');

        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => {
                if (sidebar) {
                    sidebar.classList.toggle('active');
                }
            });
        }

        // Close sidebar when clicking outside on mobile
        if (window.innerWidth <= 1024) {
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.sidebar') && !e.target.closest('.mobile-menu-toggle') && !e.target.closest('.nav-item')) {
                    if (sidebar) {
                        sidebar.classList.remove('active');
                    }
                }
            });
        }

        // Close sidebar when clicking nav items on mobile
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    if (sidebar) {
                        sidebar.classList.remove('active');
                    }
                }
            });
        });
    }

    setupEventListeners() {
        // Helper function to safely attach event listeners
        const attachListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
                console.log(`✓ Event listener attached for: ${id}`);
            } else {
                console.warn(`⚠ Element with id "${id}" not found`);
            }
        };

        // Header buttons
        attachListener('refreshBtn', 'click', () => this.refreshData());
        attachListener('notificationsBtn', 'click', (e) => this.toggleNotifications(e));
        attachListener('profileBtn', 'click', (e) => this.toggleProfile(e));

        // Notification center
        attachListener('markAllReadBtn', 'click', () => this.markAllNotificationsRead());
        attachListener('clearAllNotificationsBtn', 'click', () => this.clearAllNotifications());

        // Profile dropdown
        attachListener('settingsMenuItem', 'click', (e) => {
            e.preventDefault();
            this.closeProfileDropdown();
            if (window.router) router.navigate('settings');
        });
        attachListener('profileMenuItem', 'click', (e) => {
            e.preventDefault();
            this.closeProfileDropdown();
            if (window.router) router.navigate('settings');
        });
        attachListener('accountMenuItem', 'click', (e) => {
            e.preventDefault();
            this.closeProfileDropdown();
            if (window.router) router.navigate('settings');
        });
        attachListener('logoutMenuItem', 'click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Handle profile menu items with data-page attribute
        document.querySelectorAll('.profile-menu-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                this.closeProfileDropdown();
                if (window.router) router.navigate(page);
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-wrapper')) {
                this.closeNotificationDropdown();
            }
            if (!e.target.closest('.profile-wrapper')) {
                this.closeProfileDropdown();
            }
        });

        // Dashboard actions
        attachListener('newOrderBtn', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('New Order button clicked');
            this.openOrderModal();
        });
        attachListener('viewAnalyticsBtn', 'click', () => {
            if (window.router) router.navigate('analytics');
        });

        // Orders page
        attachListener('addOrderBtn', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Add Order button clicked');
            this.openOrderModal();
        });
        attachListener('filterOrdersBtn', 'click', () => this.filterOrders());
        attachListener('orderSearch', 'input', (e) => this.searchOrders(e.target.value));

        // Customers page
        attachListener('addCustomerBtn', 'click', () => this.openCustomerModal());

        // Materials page
        attachListener('addMaterialBtn', 'click', () => this.openMaterialModal());

        // Suppliers
        attachListener('addSupplierBtn', 'click', () => this.openSupplierModal());

        // Design Studio
        attachListener('newDesignBtn', 'click', () => this.newDesign());
        attachListener('saveDesignBtn', 'click', () => this.saveDesign());
        attachListener('clearDesignBtn', 'click', () => this.clearDesign());
        attachListener('jerseyColor', 'input', (e) => this.updateJerseyColor(e.target.value));
        attachListener('textColor', 'input', (e) => this.updateTextColor(e.target.value));
        attachListener('logoUpload', 'change', (e) => this.handleLogoUpload(e));

        // Reports
        attachListener('generateReportBtn', 'click', () => this.generateReport());

        // Settings
        attachListener('updateProfileBtn', 'click', () => this.updateProfile());
        attachListener('changePasswordBtn', 'click', () => this.changePassword());

        // Forms
        attachListener('orderForm', 'submit', (e) => {
            e.preventDefault();
            this.handleOrderSubmit(e);
        });
        attachListener('customerForm', 'submit', (e) => {
            e.preventDefault();
            this.handleCustomerSubmit(e);
        });
        attachListener('materialForm', 'submit', (e) => {
            e.preventDefault();
            this.handleMaterialSubmit(e);
        });
        attachListener('supplierForm', 'submit', (e) => {
            e.preventDefault();
            this.handleSupplierSubmit(e);
        });
        attachListener('adminJerseyForm', 'submit', (e) => {
            e.preventDefault();
            this.handleAdminJerseySubmit(e);
        });
        attachListener('exportJerseysBtn', 'click', () => this.exportJerseys());
        attachListener('addJerseyAdminBtn', 'click', () => {
            this.openAdminJerseyModal();
        });
        attachListener('copyCustomerLinkBtn', 'click', async () => {
            await this.copyCustomerLink();
        });
        attachListener('closeOrderDetailsBtn', 'click', () => {
            const modal = document.getElementById('orderDetailsModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        });
        attachListener('cancelAdminJerseyBtn', 'click', () => {
            const modal = document.getElementById('adminJerseyModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        });

        // Modal cancel buttons
        attachListener('cancelOrderBtn', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const modal = document.getElementById('orderModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        });
        attachListener('cancelCustomerBtn', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const modal = document.getElementById('customerModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        });
        attachListener('cancelMaterialBtn', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const modal = document.getElementById('materialModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        });
        attachListener('cancelSupplierBtn', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const modal = document.getElementById('supplierModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        });


        // Email Supplier Form
        attachListener('emailSupplierForm', 'submit', (e) => {
            e.preventDefault();
            this.handleEmailSupplierSubmit(e);
        });
        attachListener('cancelEmailSupplierBtn', 'click', () => {
            const modal = document.getElementById('emailSupplierModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        });

        // Handle report card buttons with data-report-type attribute
        document.querySelectorAll('button[data-report-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                const reportType = btn.getAttribute('data-report-type');
                const reportTypeEl = document.getElementById('reportType');
                if (reportTypeEl) {
                    reportTypeEl.value = reportType;
                }
                this.generateReport(reportType);
            });
        });

        // Use event delegation for dynamically created buttons
        document.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-action]');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();

                const action = btn.getAttribute('data-action');
                const id = btn.getAttribute('data-id');
                const type = btn.getAttribute('data-type');

                // Handle pagination separately (doesn't have data-type)
                if (action === 'page') {
                    const pageKey = btn.getAttribute('data-key');
                    const pageNum = btn.getAttribute('data-page');
                    if (pageKey && pageNum && !btn.disabled) {
                        this.handlePagination(pageKey, pageNum);
                    }
                    return;
                }

                switch (type) {
                    case 'order':
                        if (action === 'view') {
                            this.viewOrder(id);
                        } else if (action === 'edit') {
                            this.editOrder(id);
                        } else if (action === 'delete') {
                            this.deleteOrder(id);
                        }
                        break;
                    case 'customer':
                        if (action === 'view') this.viewCustomer(id);
                        else if (action === 'edit') this.editCustomer(id);
                        else if (action === 'delete') this.deleteCustomer(id);
                        break;
                    case 'customer-order':
                        if (action === 'view-order') this.viewOrder(id);
                        break;
                    case 'material':
                        if (action === 'edit') this.editMaterial(id);
                        else if (action === 'delete') this.deleteMaterial(id);
                        break;
                    case 'supplier':
                        if (action === 'edit') this.editSupplier(id);
                        else if (action === 'send-email') {
                            const email = btn.getAttribute('data-email');
                            this.openEmailSupplierModal(id, email);
                        } else if (action === 'delete') this.deleteSupplier(id);
                        break;
                    case 'design':
                        if (action === 'delete') this.deleteDesign(id);
                        break;
                    case 'report':
                        if (action === 'download') this.downloadReport(id);
                        else if (action === 'delete') this.deleteReport(id);
                        break;
                    case 'notification':
                        if (action === 'read') {
                            const notifItem = e.target.closest('.notification-item');
                            if (notifItem) {
                                const notifId = notifItem.getAttribute('data-id');
                                this.markNotificationRead(notifId);
                            }
                        } else if (action === 'delete') {
                            this.deleteNotification(id);
                        }
                        break;
                    case 'jersey-admin':
                        if (action === 'edit-jersey') this.openAdminJerseyModal(id);
                        else if (action === 'delete-jersey') this.deleteAdminJersey(id);
                        break;
                }
            }
        });

        console.log('Event listeners attached successfully');
    }

    setupModals() {
        // Close modals on X click
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const modal = closeBtn.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                    modal.style.display = 'none';
                }
            });
        });

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                // Only close if clicking directly on the modal backdrop, not on modal-content
                if (e.target === modal && !e.target.closest('.modal-content')) {
                    modal.classList.remove('active');
                    modal.style.display = 'none';
                }
            });
        });

        // Close order details modal when clicking X or close button
        const orderDetailsModal = document.getElementById('orderDetailsModal');
        if (orderDetailsModal) {
            const closeBtns = orderDetailsModal.querySelectorAll('.close, #closeOrderDetailsBtn');
            closeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    orderDetailsModal.classList.remove('active');
                    orderDetailsModal.style.display = 'none';
                });
            });
        }

        // Close admin jersey modal when clicking X or cancel button
        const adminJerseyModal = document.getElementById('adminJerseyModal');
        if (adminJerseyModal) {
            const closeBtns = adminJerseyModal.querySelectorAll('.close, #cancelAdminJerseyBtn');
            closeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    adminJerseyModal.classList.remove('active');
                    adminJerseyModal.style.display = 'none';
                    const form = document.getElementById('adminJerseyForm');
                    if (form) {
                        form.reset();
                        delete form.dataset.jerseyId;
                    }
                });
            });
        }
    }

    async loadData() {
        if (!window.db) {
            console.error('Firebase not initialized');
            this.showNotification('Firebase not initialized. Please refresh the page.', 'error');
            return;
        }

        try {
            // Load orders (if listener is not set up yet)
            if (!this.firebaseListeners.orders) {
                const ordersSnapshot = await db.collection('orders').orderBy('date', 'desc').limit(10).get();
                this.orders = ordersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderRecentOrders();
            }

            // Load customers (if listener is not set up yet)
            if (!this.firebaseListeners.customers) {
                const customersSnapshot = await db.collection('customers').get();
                this.customers = customersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderCustomers();
            }

            // Load materials (if listener is not set up yet)
            if (!this.firebaseListeners.materials) {
                const materialsSnapshot = await db.collection('materials').get();
                this.materials = materialsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderMaterials();
            }

            // Load suppliers (if listener is not set up yet)
            if (!this.firebaseListeners.suppliers) {
                const suppliersSnapshot = await db.collection('suppliers').get();
                this.suppliers = suppliersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderSuppliers();
            }

            // Load all orders for orders page and analytics (if listener is not set up yet)
            if (!this.firebaseListeners.allOrders) {
                const allOrdersSnapshot = await db.collection('orders').orderBy('date', 'desc').get();
                this.allOrders = allOrdersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderOrders();
            }

            // Update KPIs (use allOrders for accurate calculations)
            this.updateKPIs();

        } catch (error) {
            console.error('Error loading data:', error);
            const errorMessage = error.message || 'Unknown error occurred';
            this.showNotification(`Error loading data: ${errorMessage}. Please check your connection.`, 'error');
        }
    }

    updateKPIs() {
        // Use allOrders for accurate KPI calculations
        const allOrders = this.allOrders || this.orders || [];
        const totalOrders = allOrders.length;
        const totalCustomers = this.customers.length || 0;
        const pendingOrders = allOrders.filter(o => o.status === 'pending').length;
        const completedOrders = allOrders.filter(o => o.status === 'completed').length;

        // Update Dashboard KPIs
        const totalOrdersEl = document.getElementById('totalOrders');
        if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;

        const activeCustomersEl = document.getElementById('activeCustomers');
        if (activeCustomersEl) activeCustomersEl.textContent = totalCustomers;

        const pendingOrdersEl = document.getElementById('pendingOrders');
        if (pendingOrdersEl) pendingOrdersEl.textContent = pendingOrders;

        const completedOrdersEl = document.getElementById('completedOrders');
        if (completedOrdersEl) completedOrdersEl.textContent = completedOrders;

        // Update Customers page KPIs
        const totalCustomersEl = document.getElementById('totalCustomers');
        if (totalCustomersEl) totalCustomersEl.textContent = totalCustomers;

        const activeCustomersCountEl = document.getElementById('activeCustomersCount');
        if (activeCustomersCountEl) activeCustomersCountEl.textContent = this.customers.filter(c => c.status === 'active').length;

        const newCustomersEl = document.getElementById('newCustomers');
        if (newCustomersEl) {
            newCustomersEl.textContent = this.customers.filter(c => {
                const joined = (c.joined && c.joined.toDate) ? c.joined.toDate() : new Date(c.joined || Date.now());
                const now = new Date();
                return joined.getMonth() === now.getMonth() && joined.getFullYear() === now.getFullYear();
            }).length;
        }

        // Materials KPIs
        const totalMaterialsEl = document.getElementById('totalMaterials');
        if (totalMaterialsEl) totalMaterialsEl.textContent = this.materials.length || 0;

        const availableMaterialsEl = document.getElementById('availableMaterials');
        if (availableMaterialsEl) availableMaterialsEl.textContent = this.materials.filter(m => m.stock > 0 && m.status === 'available').length;

        const lowStockEl = document.getElementById('lowStock');
        if (lowStockEl) lowStockEl.textContent = this.materials.filter(m => m.stock > 0 && m.stock < 10).length;

        const outOfStockEl = document.getElementById('outOfStock');
        if (outOfStockEl) outOfStockEl.textContent = this.materials.filter(m => m.stock === 0 || m.status === 'out-of-stock').length;

        // Suppliers KPIs
        const totalSuppliersEl = document.getElementById('totalSuppliers');
        if (totalSuppliersEl) totalSuppliersEl.textContent = this.suppliers.length || 0;

        const activeSuppliersEl = document.getElementById('activeSuppliers');
        if (activeSuppliersEl) activeSuppliersEl.textContent = this.suppliers.filter(s => s.status === 'active').length;

        const pendingSuppliersEl = document.getElementById('pendingSuppliers');
        if (pendingSuppliersEl) pendingSuppliersEl.textContent = this.suppliers.filter(s => s.status === 'pending').length;

        const discontinuedSuppliersEl = document.getElementById('discontinuedSuppliers');
        if (discontinuedSuppliersEl) discontinuedSuppliersEl.textContent = this.suppliers.filter(s => s.status === 'discontinued').length;

        // Analytics KPIs - Use allOrders for accurate revenue calculation
        const totalRevenue = allOrders.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        const totalRevenueEl = document.getElementById('totalRevenue');
        if (totalRevenueEl) totalRevenueEl.textContent = totalRevenue.toFixed(2);

        const avgOrderValueEl = document.getElementById('avgOrderValue');
        if (avgOrderValueEl) avgOrderValueEl.textContent = avgOrderValue.toFixed(2);

        // Calculate conversion rate (placeholder - would need actual data)
        const conversionRateEl = document.getElementById('conversionRate');
        if (conversionRateEl) conversionRateEl.textContent = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : '0';

        // Customer satisfaction (placeholder - would need actual data)
        const customerSatisfactionEl = document.getElementById('customerSatisfaction');
        if (customerSatisfactionEl) customerSatisfactionEl.textContent = '95'; // Placeholder
    }

    renderRecentOrders() {
        const tbody = document.getElementById('recentOrdersTable');
        if (!tbody) return;

        if (this.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No orders yet</td></tr>';
            this.renderPagination('recentOrders', [], 'recentOrdersPagination');
            return;
        }

        const pagination = this.pagination.recentOrders;
        const totalPages = Math.ceil(this.orders.length / pagination.pageSize);
        const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const paginatedOrders = this.orders.slice(startIndex, endIndex);

        // Always show quantity column, but set to 0 for pending/draft orders
        tbody.innerHTML = paginatedOrders.map(order => {
            const status = order.status || 'pending';
            // For pending/draft orders, show 0, otherwise show actual quantity
            const quantity = (status === 'pending' || status === 'draft') ? 0 : parseInt(order.amount || 0);
            return `
            <tr>
                <td>${order.id.substring(0, 8)}</td>
                <td>${order.customer || 'N/A'}</td>
                <td>${order.product || 'N/A'}</td>
                <td><span class="status-badge status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                <td>${quantity}</td>
                <td>${this.formatDate(order.date)}</td>
                <td>
                    <button class="action-btn" data-action="view" data-id="${order.id}" data-type="order">View</button>
                    <button class="action-btn delete" data-action="delete" data-id="${order.id}" data-type="order">Delete</button>
                </td>
            </tr>
        `;
        }).join('');

        this.renderPagination('recentOrders', this.orders, 'recentOrdersPagination');
    }

    renderOrders() {
        const tbody = document.getElementById('ordersTable');
        if (!tbody) return;

        const orders = this.allOrders || this.orders;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No orders found</td></tr>';
            this.renderPagination('orders', [], 'ordersPagination');
            return;
        }

        const pagination = this.pagination.orders;
        const totalPages = Math.ceil(orders.length / pagination.pageSize);
        const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const paginatedOrders = orders.slice(startIndex, endIndex);

        // Always show quantity column, but set to 0 for pending/draft orders
        tbody.innerHTML = paginatedOrders.map(order => {
            const status = order.status || 'pending';
            // For pending/draft orders, show 0, otherwise show actual quantity
            const quantity = (status === 'pending' || status === 'draft') ? 0 : parseInt(order.amount || 0);
            return `
            <tr>
                <td>${order.id.substring(0, 8)}</td>
                <td>${order.customer || 'N/A'}</td>
                <td>${order.email || 'N/A'}</td>
                <td>${order.mobile || 'N/A'}</td>
                <td>${order.material || 'N/A'}</td>
                <td><span class="status-badge status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                <td>${quantity}</td>
                <td>${this.formatDate(order.date)}</td>
                <td>
                    <button class="action-btn" data-action="edit" data-id="${order.id}" data-type="order">Edit</button>
                    <button class="action-btn delete" data-action="delete" data-id="${order.id}" data-type="order">Delete</button>
                </td>
            </tr>
        `;
        }).join('');

        this.renderPagination('orders', orders, 'ordersPagination');
    }

    renderCustomers() {
        const tbody = document.getElementById('customersTable');
        if (!tbody) return;

        if (this.customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No customers found</td></tr>';
            this.renderPagination('customers', [], 'customersPagination');
            return;
        }

        const pagination = this.pagination.customers;
        const totalPages = Math.ceil(this.customers.length / pagination.pageSize);
        const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const paginatedCustomers = this.customers.slice(startIndex, endIndex);

        tbody.innerHTML = paginatedCustomers.map(customer => {
            // Get orders for this customer from allOrders (match by name and phone)
            const customerOrders = (this.allOrders || this.orders || []).filter(o =>
                (o.customer === customer.name || o.customer === customer.name.trim()) &&
                (o.mobile === customer.phone || o.mobile === customer.phone.trim())
            );
            const ordersCount = customerOrders.length;
            // Use customer's latestOrderId if available, otherwise use most recent order
            const latestOrderId = customer.latestOrderId || (customerOrders.length > 0 ? customerOrders[0].id : null);

            return `
                <tr>
                    <td>${customer.name || 'N/A'}</td>
                    <td>${customer.email || 'N/A'}</td>
                    <td>${customer.phone || 'N/A'}</td>
                    <td>
                        ${ordersCount > 0 && latestOrderId ? `
                            <button class="action-btn" data-action="view-order" data-id="${latestOrderId}" data-type="customer-order" title="View Order Details">
                                <i class="fas fa-shopping-cart"></i> ${ordersCount}
                            </button>
                        ` : ordersCount}
                    </td>
                    <td><span class="status-badge status-${customer.status || 'active'}">${(customer.status || 'active').charAt(0).toUpperCase() + (customer.status || 'active').slice(1)}</span></td>
                    <td>${this.formatDate(customer.joined)}</td>
                    <td>
                        <button class="action-btn" data-action="view" data-id="${customer.id}" data-type="customer">View</button>
                        <button class="action-btn" data-action="edit" data-id="${customer.id}" data-type="customer">Edit</button>
                        <button class="action-btn delete" data-action="delete" data-id="${customer.id}" data-type="customer">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

        this.renderPagination('customers', this.customers, 'customersPagination');
    }

    renderMaterials() {
        const tbody = document.getElementById('materialsTable');
        if (!tbody) return;

        if (this.materials.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No materials found</td></tr>';
            this.renderPagination('materials', [], 'materialsPagination');
            return;
        }

        const pagination = this.pagination.materials;
        const totalPages = Math.ceil(this.materials.length / pagination.pageSize);
        const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const paginatedMaterials = this.materials.slice(startIndex, endIndex);

        tbody.innerHTML = paginatedMaterials.map(material => {
            let status = 'available';
            if (material.stock === 0) status = 'out-of-stock';
            else if (material.stock < 10) status = 'low-stock';

            return `
                <tr>
                    <td>${material.name || 'N/A'}</td>
                    <td>${material.type || 'N/A'}</td>
                    <td>$${parseFloat(material.price || 0).toFixed(2)}</td>
                    <td>${material.stock || 0}</td>
                    <td><span class="status-badge status-${status}">${status.replace('-', ' ')}</span></td>
                    <td>
                        <button class="action-btn" data-action="edit" data-id="${material.id}" data-type="material">Edit</button>
                        <button class="action-btn delete" data-action="delete" data-id="${material.id}" data-type="material">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

        this.renderPagination('materials', this.materials, 'materialsPagination');

        // Populate material dropdown in order form (will be populated when modal opens)
    }

    renderSuppliers() {
        const tbody = document.getElementById('suppliersTable');
        if (!tbody) return;

        if (this.suppliers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">No suppliers found</td></tr>';
            this.renderPagination('suppliers', [], 'suppliersPagination');
            return;
        }

        const pagination = this.pagination.suppliers;
        const totalPages = Math.ceil(this.suppliers.length / pagination.pageSize);
        const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const paginatedSuppliers = this.suppliers.slice(startIndex, endIndex);

        tbody.innerHTML = paginatedSuppliers.map(supplier => {
            return `
                <tr>
                    <td>${supplier.name || 'N/A'}</td>
                    <td>${supplier.email || 'N/A'}</td>
                    <td><span class="status-badge status-${supplier.status || 'active'}">${(supplier.status || 'active').charAt(0).toUpperCase() + (supplier.status || 'active').slice(1)}</span></td>
                    <td>${supplier.location || 'N/A'}</td>
                    <td>
                        ${supplier.email && supplier.email !== 'N/A' ? `
                            <button class="action-btn" data-action="send-email" data-id="${supplier.id}" data-email="${supplier.email}" data-type="supplier" title="Send Email">
                                <i class="fas fa-envelope"></i> Send Email
                            </button>
                        ` : ''}
                        <button class="action-btn" data-action="edit" data-id="${supplier.id}" data-type="supplier">Edit</button>
                        <button class="action-btn delete" data-action="delete" data-id="${supplier.id}" data-type="supplier">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

        this.renderPagination('suppliers', this.suppliers, 'suppliersPagination');
    }

    // Order Management
    async openOrderModal(orderId = null) {
        console.log('openOrderModal called', orderId);
        const modal = document.getElementById('orderModal');
        if (!modal) {
            console.error('Order modal not found!');
            return;
        }

        const form = document.getElementById('orderForm');
        const title = document.getElementById('modalTitle');

        if (!form || !title) {
            console.error('Order form elements not found!');
            return;
        }

        const subtitle = modal.querySelector('.modal-subtitle');

        // Load suppliers if not already loaded
        if (!this.suppliers || this.suppliers.length === 0) {
            await this.loadSuppliersData();
        }

        // Load materials if not already loaded
        if (!this.materials || this.materials.length === 0) {
            await this.loadMaterialsData();
        }

        // Populate supplier dropdown
        const supplierSelect = document.getElementById('orderSupplier');
        if (supplierSelect) {
            supplierSelect.innerHTML = '<option value="">-- Select Supplier --</option>';
            if (this.suppliers && this.suppliers.length > 0) {
                this.suppliers.filter(s => s.status === 'active').forEach(s => {
                    const option = document.createElement('option');
                    option.value = s.id;
                    option.textContent = `${s.name} (${s.location})`;
                    supplierSelect.appendChild(option);
                });
            }
        }

        // Populate material dropdown
        const materialSelect = document.getElementById('orderMaterial');
        if (materialSelect) {
            materialSelect.innerHTML = '<option value="">-- Select Material --</option>';
            if (this.materials && this.materials.length > 0) {
                this.materials.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.name;
                    option.textContent = `${m.name} - $${parseFloat(m.price || 0).toFixed(2)} (Stock: ${m.stock || 0})`;
                    materialSelect.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No materials available - Please add materials first';
                option.disabled = true;
                materialSelect.appendChild(option);
            }
        }

        if (orderId) {
            const order = (this.allOrders || this.orders || []).find(o => o.id === orderId);
            if (order) {
                if (title) title.textContent = 'Edit Order';
                if (subtitle) subtitle.textContent = 'Update order details below';
                const customerInput = document.getElementById('orderCustomer');
                const mobileInput = document.getElementById('orderMobile');
                const emailInput = document.getElementById('orderEmail');
                const supplierInput = document.getElementById('orderSupplier');
                const materialInput = document.getElementById('orderMaterial');
                const amountInput = document.getElementById('orderAmount');
                const statusInput = document.getElementById('orderStatus');

                if (customerInput) customerInput.value = order.customer || '';
                if (mobileInput) mobileInput.value = order.mobile || '';
                if (emailInput) emailInput.value = order.email || '';
                if (supplierInput && order.supplierId) supplierInput.value = order.supplierId || '';
                if (materialInput) materialInput.value = order.material || '';
                if (amountInput) amountInput.value = order.amount || '';
                if (statusInput) statusInput.value = order.status || 'pending';
                if (form) form.dataset.orderId = orderId;
            }
        } else {
            if (title) title.textContent = 'Add New Order';
            if (subtitle) subtitle.textContent = 'Fill in the order details below';
            if (form) {
                form.reset();
                delete form.dataset.orderId;
                // Set default quantity to 1
                const quantityInput = document.getElementById('orderAmount');
                if (quantityInput) quantityInput.value = '1';
            }
        }

        if (modal) {
            modal.classList.add('active');
            console.log('Modal active class added, modal should be visible now');

            // Force display in case CSS is not applying
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
        } else {
            console.error('Modal element is null!');
        }
    }

    async handleOrderSubmit(e) {
        e.preventDefault();
        if (!window.db) {
            this.showNotification('Firebase not initialized', 'error');
            return;
        }

        const form = e.target;
        let orderId = form.dataset.orderId;

        // Form validation
        const customer = document.getElementById('orderCustomer').value.trim();
        const mobile = document.getElementById('orderMobile').value.trim();
        const email = document.getElementById('orderEmail') ? document.getElementById('orderEmail').value.trim() : '';
        const supplierId = document.getElementById('orderSupplier') ? document.getElementById('orderSupplier').value : '';
        const material = document.getElementById('orderMaterial').value;
        const amount = parseInt(document.getElementById('orderAmount').value);

        if (!customer || !mobile || !material || !amount || amount <= 0 || isNaN(amount)) {
            this.showNotification('Please fill in all required fields with valid values', 'error');
            return;
        }

        // Get selected material details for price validation
        const selectedMaterial = this.materials.find(m => m.name === material);
        const orderData = {
            customer,
            mobile,
            email: email || null,
            supplierId: supplierId || null,
            material,
            amount,
            status: document.getElementById('orderStatus').value,
            date: orderId ? firebase.firestore.FieldValue.serverTimestamp() : firebase.firestore.Timestamp.now(),
            product: material,
            materialPrice: selectedMaterial ? selectedMaterial.price : null,
            materialId: selectedMaterial ? selectedMaterial.id : null
        };

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            let savedOrderRef;
            const orderModal = document.getElementById('orderModal');

            if (orderId) {
                // Editing existing order
                await db.collection('orders').doc(orderId).update(orderData);
                savedOrderRef = db.collection('orders').doc(orderId);

                // Close modal
                if (orderModal) {
                    orderModal.classList.remove('active');
                    orderModal.style.display = 'none';
                }
                await this.loadData();
                this.showNotification('Order updated successfully!', 'success');
            } else {
                // Creating new order
                savedOrderRef = await db.collection('orders').add(orderData);
                orderId = savedOrderRef.id;

                // Generate unique link token
                const linkToken = this.generateUniqueToken();
                const customerLink = `${window.location.origin}/customer.html?orderId=${orderId}&token=${linkToken}`;

                // Update order with link and token
                await savedOrderRef.update({
                    customerLink: customerLink,
                    linkToken: linkToken,
                    status: 'pending' // Initial status
                });

                // Close modal first before showing alert
                if (orderModal) {
                    orderModal.classList.remove('active');
                    orderModal.style.display = 'none';
                }
                await this.loadData();

                // Show link to admin
                const linkMessage = `Order created! Share this link with your customer:`;
                await this.showAlertWithCopy('Order Created Successfully!', linkMessage, customerLink);

                // Reset form
                form.reset();
                // Reset quantity to default 1
                const quantityInput = document.getElementById('orderAmount');
                if (quantityInput) quantityInput.value = '1';
            }
        } catch (error) {
            console.error('Error saving order:', error);
            this.showNotification('Error saving order: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    filterOrders() {
        const status = document.getElementById('statusFilter').value;
        const date = document.getElementById('dateRange').value;

        let filtered = this.allOrders || this.orders;

        if (status !== 'all') {
            filtered = filtered.filter(o => o.status === status);
        }

        if (date) {
            const filterDate = new Date(date);
            filtered = filtered.filter(o => {
                const orderDate = (o.date && o.date.toDate) ? o.date.toDate() : new Date(o.date);
                return orderDate.toDateString() === filterDate.toDateString();
            });
        }

        const tbody = document.getElementById('ordersTable');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No orders found</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(order => `
            <tr>
                <td>${order.id.substring(0, 8)}</td>
                <td>${order.customer || 'N/A'}</td>
                <td>${order.mobile || 'N/A'}</td>
                <td>${order.material || 'N/A'}</td>
                <td><span class="status-badge status-${order.status || 'pending'}">${(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}</span></td>
                <td>${parseInt(order.amount || 0)}</td>
                <td>${this.formatDate(order.date)}</td>
                <td>
                    <button class="action-btn" data-action="view" data-id="${order.id}" data-type="order">View</button>
                    <button class="action-btn" data-action="edit" data-id="${order.id}" data-type="order">Edit</button>
                    <button class="action-btn delete" data-action="delete" data-id="${order.id}" data-type="order">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    searchOrders(query) {
        const filtered = (this.allOrders || this.orders).filter(order => {
            const searchText = query.toLowerCase();
            return (
                order.id.toLowerCase().includes(searchText) ||
                (order.customer || '').toLowerCase().includes(searchText) ||
                (order.product || '').toLowerCase().includes(searchText) ||
                (order.material || '').toLowerCase().includes(searchText)
            );
        });

        const tbody = document.getElementById('ordersTable');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No orders found</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(order => `
            <tr>
                <td>${order.id.substring(0, 8)}</td>
                <td>${order.customer || 'N/A'}</td>
                <td>${order.mobile || 'N/A'}</td>
                <td>${order.material || 'N/A'}</td>
                <td><span class="status-badge status-${order.status || 'pending'}">${(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}</span></td>
                <td>${parseInt(order.amount || 0)}</td>
                <td>${this.formatDate(order.date)}</td>
                <td>
                    <button class="action-btn" data-action="view" data-id="${order.id}" data-type="order">View</button>
                    <button class="action-btn" data-action="edit" data-id="${order.id}" data-type="order">Edit</button>
                    <button class="action-btn delete" data-action="delete" data-id="${order.id}" data-type="order">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    async deleteOrder(orderId) {
        const confirmed = await this.showConfirm(
            'Delete Order',
            'Are you sure you want to delete this order? This action cannot be undone.',
            'warning'
        );

        if (confirmed) {
            try {
                await db.collection('orders').doc(orderId).delete();
                await this.loadData();
                this.showNotification('Order deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting order:', error);
                this.showNotification('Error deleting order: ' + error.message, 'error');
            }
        }
    }

    editOrder(orderId) {
        this.openOrderModal(orderId);
    }

    async viewOrder(orderId) {
        try {
            if (!window.db) {
                this.showNotification('Firebase not initialized', 'error');
                return;
            }

            // Ensure allOrders is initialized
            if (!this.allOrders) {
                this.allOrders = [];
            }

            // If allOrders is empty, try to load data first (in case page just loaded)
            if (this.allOrders.length === 0) {
                // Check if orders table has data in DOM
                const tbody = document.getElementById('ordersTable');
                if (tbody && tbody.querySelectorAll('tr').length > 0) {
                    // Table has data, wait a bit for async loadData to complete
                    await new Promise(resolve => setTimeout(resolve, 300));
                } else {
                    // No data in table, load it now
                    await this.loadOrdersData();
                }
            }

            // Preserve existing orders data to prevent table from disappearing
            const previousOrders = [...this.allOrders];

            // Only navigate if we're NOT on the orders page
            const ordersPage = document.getElementById('orders');
            if (ordersPage && !ordersPage.classList.contains('active')) {
                // Switch to orders page if not already there
                if (window.router) {
                    window.router.navigate('orders');
                    // Wait for page to switch and data to load
                    await new Promise(resolve => setTimeout(resolve, 200));
                    // Ensure orders are loaded after navigation
                    if (!this.allOrders || this.allOrders.length === 0) {
                        await this.loadOrdersData();
                        // Update previousOrders with newly loaded data
                        previousOrders.length = 0;
                        previousOrders.push(...this.allOrders);
                    }
                }
            }

            // Set current viewing order
            this.currentViewingOrderId = orderId;

            // Fetch order directly from Firebase to ensure we have latest data
            const orderDoc = await db.collection('orders').doc(orderId).get();

            if (!orderDoc.exists) {
                this.showNotification('Order not found', 'error');
                // Restore previous data if order not found
                if (previousOrders.length > 0 && (!this.allOrders || this.allOrders.length === 0)) {
                    this.allOrders = previousOrders;
                    this.renderOrders();
                }
                return;
            }

            const order = {
                id: orderDoc.id,
                ...orderDoc.data()
            };

            // Populate order info
            const customerElement = document.getElementById('orderDetailCustomer');
            const emailElement = document.getElementById('orderDetailEmail');
            const mobileElement = document.getElementById('orderDetailMobile');
            const materialElement = document.getElementById('orderDetailMaterial');
            const quantityElement = document.getElementById('orderDetailQuantity');
            const statusElement = document.getElementById('orderDetailStatus');
            const dateElement = document.getElementById('orderDetailDate');

            if (customerElement) {
                customerElement.textContent = order.customer || 'N/A';
            }
            if (emailElement) {
                emailElement.textContent = order.email || 'N/A';
            }
            if (mobileElement) {
                mobileElement.textContent = order.mobile || 'N/A';
            }
            if (materialElement) {
                // Try material, product, or both
                materialElement.textContent = order.material || order.product || order.materialName || 'N/A';
            }
            if (quantityElement) {
                const status = order.status || 'pending';
                // For pending/draft orders, show 0, otherwise show actual quantity
                const quantity = (status === 'pending' || status === 'draft') ? 0 : (order.amount || order.quantity || 0);
                // Always show quantity div
                const quantityDiv = quantityElement.closest('div');
                if (quantityDiv) {
                    quantityDiv.style.display = '';
                }
                quantityElement.textContent = quantity;
            }
            if (statusElement) {
                const status = order.status || 'pending';
                const statusBadge = `<span class="status-badge status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
                statusElement.innerHTML = statusBadge;
            }
            if (dateElement) {
                dateElement.textContent = this.formatDate(order.date);
            }

            // Populate customer link
            const customerLink = order.customerLink || '';
            const linkElement = document.getElementById('orderDetailLink');
            if (linkElement) {
                if (customerLink) {
                    linkElement.textContent = customerLink;
                    linkElement.style.color = 'var(--accent-red)';
                } else {
                    linkElement.textContent = 'Link not available';
                    linkElement.style.color = 'var(--text-secondary)';
                }
            }

            // Store link for copying
            this.currentOrderLink = customerLink;

            // Load and display jerseys
            await this.loadOrderJerseys(orderId);

            // Open modal - ensure it doesn't affect the page
            const modal = document.getElementById('orderDetailsModal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
                // Ensure orders page stays active
                if (ordersPage) {
                    ordersPage.classList.add('active');
                }
            } else {
                console.error('Order details modal not found');
            }

            // Ensure orders table is still visible after modal opens
            if (previousOrders.length > 0 && (!this.allOrders || this.allOrders.length === 0)) {
                this.allOrders = previousOrders;
                this.renderOrders();
            }
        } catch (error) {
            console.error('Error viewing order:', error);
            this.showNotification('Error loading order details: ' + error.message, 'error');
            // Restore orders table if error occurred
            if (this.allOrders && this.allOrders.length > 0) {
                this.renderOrders();
            } else {
                // Reload orders if needed
                await this.loadOrdersData();
            }
        }
    }

    async loadOrderJerseys(orderId) {
        try {
            if (!window.db) return;

            const jerseysSnapshot = await db.collection('orders').doc(orderId)
                .collection('jerseys').orderBy('created', 'asc').get();

            const jerseys = jerseysSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            this.currentOrderJerseys = jerseys;
            this.renderAdminJerseysTable(jerseys);
        } catch (error) {
            console.error('Error loading jerseys:', error);
            this.showNotification('Error loading jersey details', 'error');
        }
    }

    renderAdminJerseysTable(jerseys) {
        const tbody = document.getElementById('adminJerseyTable');
        if (!tbody) return;

        if (jerseys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data">No jersey details available</td></tr>';
            return;
        }

        tbody.innerHTML = jerseys.map((jersey, index) => `
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
                    <button class="action-btn" data-action="edit-jersey" data-id="${jersey.id}" data-type="jersey-admin">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn delete" data-action="delete-jersey" data-id="${jersey.id}" data-type="jersey-admin">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    exportJerseys() {
        if (!this.currentOrderJerseys || this.currentOrderJerseys.length === 0) {
            this.showNotification('No jersey details to export', 'warning');
            return;
        }

        try {
            // Get order information for the filename
            const orderInfo = this.orders.find(o => o.id === this.currentViewingOrderId) || {};
            const orderId = orderInfo.id || 'order';
            const customerName = (orderInfo.customer || 'customer').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `jersey_details_${customerName}_${orderId}_${new Date().toISOString().split('T')[0]}.csv`;

            // CSV Headers
            const headers = ['#', 'Type', 'Name', 'Number', 'Size Category', 'Size', 'Sleeve', 'Shorts'];

            // Convert data to CSV format
            const csvRows = [
                headers.join(','),
                ...this.currentOrderJerseys.map((jersey, index) => {
                    return [
                        index + 1,
                        `"${(jersey.type || 'N/A').toString().replace(/"/g, '""')}"`,
                        `"${(jersey.name || 'N/A').toString().replace(/"/g, '""')}"`,
                        `"${(jersey.number || 'N/A').toString().replace(/"/g, '""')}"`,
                        `"${(jersey.sizeCategory || 'N/A').toString().replace(/"/g, '""')}"`,
                        `"${(jersey.size || 'N/A').toString().replace(/"/g, '""')}"`,
                        `"${(jersey.sleeve || 'N/A').toString().replace(/"/g, '""')}"`,
                        `"${(jersey.shorts || 'N/A').toString().replace(/"/g, '""')}"`
                    ].join(',');
                })
            ];

            const csvContent = csvRows.join('\n');

            // Create BOM for UTF-8 (helps Excel open the file correctly)
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], {
                type: 'text/csv;charset=utf-8;'
            });

            // Create download link
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.showNotification(`Exported ${this.currentOrderJerseys.length} jersey details successfully`, 'success');
        } catch (error) {
            console.error('Error exporting jerseys:', error);
            this.showNotification('Error exporting jersey details', 'error');
        }
    }

    openEmailSupplierModal(supplierId, supplierEmail) {
        const modal = document.getElementById('emailSupplierModal');
        if (!modal) {
            this.showNotification('Email modal not found', 'error');
            return;
        }

        // Get supplier data
        const supplier = this.suppliers.find(s => s.id === supplierId);
        if (!supplier) {
            this.showNotification('Supplier not found', 'error');
            return;
        }

        // Get supplier's orders for context
        const supplierOrders = (this.allOrders || this.orders || []).filter(order =>
            order.supplierId === supplierId
        );

        // Set recipient email
        const emailToInput = document.getElementById('supplierEmailTo');
        if (emailToInput) {
            emailToInput.value = supplierEmail || supplier.email || '';
        }

        // Clear other fields
        document.getElementById('supplierEmailFrom').value = '';
        document.getElementById('supplierEmailFromAddress').value = '';
        document.getElementById('supplierEmailSubject').value = '';

        // Pre-fill message with order details if available
        let messageContent = `Dear ${supplier.name},\n\n`;
        if (supplierOrders.length > 0) {
            messageContent += `Here is a summary of orders assigned to you:\n\n`;
            supplierOrders.forEach(order => {
                const orderDate = this.formatDate(order.date);
                messageContent += `Order ID: ${order.id}\n`;
                messageContent += `Customer: ${order.customer || 'N/A'}\n`;
                messageContent += `Order Date: ${orderDate}\n`;
                messageContent += `Status: ${order.status || 'N/A'}\n`;
                messageContent += `Material: ${order.product || order.material || 'N/A'}\n`;
                messageContent += `Quantity: ${order.amount || order.quantity || 0}\n`;
                messageContent += `---\n\n`;
            });
            messageContent += `Total Orders: ${supplierOrders.length}\n\n`;
        }
        messageContent += `Best regards,\nOtomono Jersey Team`;

        document.getElementById('supplierEmailMessage').value = messageContent;

        // Store supplier data for later use
        this.currentEmailSupplierData = {
            supplierId,
            supplierEmail: supplierEmail || supplier.email,
            supplierName: supplier.name,
            supplierOrders
        };

        // Open modal
        modal.classList.add('active');
        modal.style.display = 'flex';
    }

    async handleEmailSupplierSubmit(e) {
        e.preventDefault();

        const to = document.getElementById('supplierEmailTo').value.trim();
        const fromName = document.getElementById('supplierEmailFrom').value.trim();
        const fromEmail = document.getElementById('supplierEmailFromAddress').value.trim();
        const subject = document.getElementById('supplierEmailSubject').value.trim();
        const message = document.getElementById('supplierEmailMessage').value.trim();

        if (!to || !fromName || !fromEmail || !subject || !message) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to) || !emailRegex.test(fromEmail)) {
            this.showNotification('Please enter valid email addresses', 'error');
            return;
        }

        const sendBtn = document.getElementById('sendEmailSupplierBtn');
        const originalText = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        try {
            // Send email via PHP backend
            const formData = new FormData();
            formData.append('name', fromName);
            formData.append('email', fromEmail);
            formData.append('to', to);
            formData.append('subject', subject);
            formData.append('message', message);

            const response = await fetch('sendmail.php', {
                method: 'POST',
                body: formData
            });

            // Get response text first to check what we received
            const responseText = await response.text();
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            console.log('Response text (first 500 chars):', responseText.substring(0, 500));

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            let result;

            if (contentType && contentType.includes('application/json')) {
                try {
                    result = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('JSON parse error:', parseError);
                    throw new Error('Server returned invalid JSON. Response: ' + responseText.substring(0, 200));
                }
            } else {
                // Response is not JSON (likely HTML error page or PHP error)
                console.error('Non-JSON response. Content-Type:', contentType);
                console.error('Full response:', responseText);

                // Try to extract error message from HTML if possible
                let errorHint = '';
                if (responseText.includes('404')) {
                    errorHint = 'File not found. Check if sendmail.php exists in the project root.';
                } else if (responseText.includes('500')) {
                    errorHint = 'Server error. Check PHP error logs.';
                } else if (responseText.includes('Fatal error') || responseText.includes('Parse error')) {
                    errorHint = 'PHP syntax error. Check sendmail.php for errors.';
                } else if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
                    errorHint = 'PHP is not executing. Server may be serving PHP as static files.';
                } else {
                    errorHint = 'Unexpected response format.';
                }

                throw new Error(`Server configuration issue: ${errorHint} Please ensure PHP is running and sendmail.php is accessible.`);
            }

            if (response.ok && result.success) {
                this.showNotification(`Email sent successfully to ${to}`, 'success');
                // Close modal
                const modal = document.getElementById('emailSupplierModal');
                if (modal) {
                    modal.classList.remove('active');
                    modal.style.display = 'none';
                }
                // Reset form
                e.target.reset();
            } else {
                throw new Error(result.message || 'Failed to send email');
            }
        } catch (error) {
            console.error('Error sending email:', error);
            let errorMessage = 'Error sending email: ';

            if (error.message.includes('JSON')) {
                errorMessage += 'Server configuration error. Please ensure PHP is running and sendmail.php is accessible.';
            } else if (error.message.includes('fetch')) {
                errorMessage += 'Cannot connect to server. Please check if PHP server is running.';
            } else {
                errorMessage += error.message || 'Please check your PHP configuration';
            }

            this.showNotification(errorMessage, 'error');
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
        }
    }

    async openAdminJerseyModal(jerseyId = null) {
        const modal = document.getElementById('adminJerseyModal');
        const form = document.getElementById('adminJerseyForm');
        const title = document.getElementById('adminJerseyModalTitle');

        if (!modal || !form || !title) return;

        // Set current editing jersey
        this.currentEditingJerseyId = jerseyId;

        if (jerseyId) {
            const jersey = this.currentOrderJerseys.find(j => j.id === jerseyId);
            if (jersey) {
                title.textContent = 'Edit Jersey Details';
                document.getElementById('adminJerseyType').value = jersey.type || '';
                document.getElementById('adminJerseyName').value = jersey.name || '';
                document.getElementById('adminJerseyNumber').value = jersey.number || '';
                document.getElementById('adminJerseySizeCategory').value = jersey.sizeCategory || '';
                document.getElementById('adminJerseySize').value = jersey.size || '';
                document.getElementById('adminJerseySleeve').value = jersey.sleeve || '';
                document.getElementById('adminJerseyShorts').value = jersey.shorts || '';
                form.dataset.jerseyId = jerseyId;
            }
        } else {
            title.textContent = 'Add Jersey Details';
            form.reset();
            delete form.dataset.jerseyId;
        }

        modal.classList.add('active');
        modal.style.display = 'flex';
    }

    async handleAdminJerseySubmit(e) {
        e.preventDefault();
        if (!window.db || !this.currentViewingOrderId) return;

        const form = e.target;
        const jerseyId = form.dataset.jerseyId;

        const jerseyData = {
            type: document.getElementById('adminJerseyType').value,
            name: document.getElementById('adminJerseyName').value.trim(),
            number: document.getElementById('adminJerseyNumber').value.trim(),
            sizeCategory: document.getElementById('adminJerseySizeCategory').value,
            size: document.getElementById('adminJerseySize').value,
            sleeve: document.getElementById('adminJerseySleeve').value,
            shorts: document.getElementById('adminJerseyShorts').value
        };

        if (!jerseyData.type || !jerseyData.name || !jerseyData.number || !jerseyData.sizeCategory || !jerseyData.size || !jerseyData.sleeve || !jerseyData.shorts) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Validate jersey number is numeric only
        if (!/^[0-9]+$/.test(jerseyData.number)) {
            this.showNotification('Jersey number must contain numbers only', 'error');
            return;
        }

        try {
            if (jerseyId) {
                // Update existing jersey
                await db.collection('orders').doc(this.currentViewingOrderId)
                    .collection('jerseys').doc(jerseyId).update(jerseyData);
                this.showNotification('Jersey updated successfully!', 'success');
            } else {
                // Add new jersey
                await db.collection('orders').doc(this.currentViewingOrderId)
                    .collection('jerseys').add({
                        ...jerseyData,
                        created: firebase.firestore.FieldValue.serverTimestamp()
                    });
                this.showNotification('Jersey added successfully!', 'success');
            }

            // Update order status to Draft when admin modifies
            await this.updateOrderStatusToDraft(this.currentViewingOrderId);

            // Reload jerseys
            await this.loadOrderJerseys(this.currentViewingOrderId);

            // Update order quantity to match number of jerseys
            await this.updateAdminOrderQuantity(this.currentViewingOrderId);

            // Close modal
            const modal = document.getElementById('adminJerseyModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }

            form.reset();
            delete form.dataset.jerseyId;
        } catch (error) {
            console.error('Error saving jersey:', error);
            this.showNotification('Error saving jersey: ' + error.message, 'error');
        }
    }

    async deleteAdminJersey(jerseyId) {
        if (!window.db || !this.currentViewingOrderId) return;

        const confirmed = await this.showConfirm(
            'Delete Jersey',
            'Are you sure you want to delete this jersey entry? This will change the order status to Draft.',
            'warning'
        );

        if (!confirmed) return;

        try {
            await db.collection('orders').doc(this.currentViewingOrderId)
                .collection('jerseys').doc(jerseyId).delete();

            // Update order status to Draft when admin modifies
            await this.updateOrderStatusToDraft(this.currentViewingOrderId);

            // Reload jerseys
            await this.loadOrderJerseys(this.currentViewingOrderId);

            // Update order quantity to match number of jerseys
            await this.updateAdminOrderQuantity(this.currentViewingOrderId);

            this.showNotification('Jersey deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting jersey:', error);
            this.showNotification('Error deleting jersey: ' + error.message, 'error');
        }
    }

    async updateOrderStatusToDraft(orderId) {
        if (!window.db) {
            this.showNotification('Firebase not initialized', 'error');
            return;
        }

        try {
            await db.collection('orders').doc(orderId).update({
                status: 'draft',
                adminModified: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Real-time listeners will automatically update the UI
            this.showNotification('Order status updated to Draft', 'success');
        } catch (error) {
            console.error('Error updating order status:', error);
            this.showNotification('Error updating order status: ' + error.message, 'error');
        }
    }

    async updateAdminOrderQuantity(orderId) {
        if (!window.db || !orderId) {
            console.error('Firebase not initialized or orderId missing');
            return;
        }

        try {
            // Get current jersey count
            const jerseysSnapshot = await db.collection('orders').doc(orderId)
                .collection('jerseys').get();
            const jerseyCount = jerseysSnapshot.size;

            // Update order quantity in Firebase
            await db.collection('orders').doc(orderId).update({
                amount: jerseyCount
            });

            // Update the displayed quantity in the modal
            const quantityElement = document.getElementById('orderDetailQuantity');
            if (quantityElement) {
                // Get order status to determine quantity value
                const orderDoc = await db.collection('orders').doc(orderId).get();
                if (orderDoc.exists) {
                    const orderData = orderDoc.data();
                    const status = orderData.status || 'pending';
                    // For pending/draft orders, show 0, otherwise show actual jersey count
                    const quantity = (status === 'pending' || status === 'draft') ? 0 : jerseyCount;
                    // Always show quantity div
                    const quantityDiv = quantityElement.closest('div');
                    if (quantityDiv) {
                        quantityDiv.style.display = '';
                    }
                    quantityElement.textContent = quantity;
                } else {
                    quantityElement.textContent = jerseyCount;
                }
            }

            // Real-time listeners will automatically update the UI
        } catch (error) {
            console.error('Error updating order quantity:', error);
            this.showNotification('Error updating order quantity: ' + error.message, 'error');
        }
    }

    async copyCustomerLink() {
        const link = this.currentOrderLink;
        if (!link) {
            this.showNotification('Customer link not available', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(link);
            const copyBtn = document.getElementById('copyCustomerLinkBtn');
            if (copyBtn) {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.disabled = true;
                this.showNotification('Customer link copied to clipboard!', 'success');

                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.disabled = false;
                }, 2000);
            }
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = link;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            const copyBtn = document.getElementById('copyCustomerLinkBtn');
            if (copyBtn) {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.disabled = true;
                this.showNotification('Customer link copied to clipboard!', 'success');

                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.disabled = false;
                }, 2000);
            }
        }
    }

    // Customer Management
    openCustomerModal(customerId = null) {
        const modal = document.getElementById('customerModal');
        const form = document.getElementById('customerForm');
        const title = document.getElementById('customerModalTitle');
        const subtitle = modal.querySelector('.modal-subtitle');

        if (customerId) {
            const customer = this.customers.find(c => c.id === customerId);
            if (customer) {
                title.textContent = 'Edit Customer';
                if (subtitle) subtitle.textContent = 'Update customer information below';
                document.getElementById('customerName').value = customer.name || '';
                document.getElementById('customerEmail').value = customer.email || '';
                document.getElementById('customerPhone').value = customer.phone || '';
                form.dataset.customerId = customerId;
            }
        } else {
            title.textContent = 'Add New Customer';
            if (subtitle) subtitle.textContent = 'Enter customer information below';
            form.reset();
            delete form.dataset.customerId;
        }

        modal.classList.add('active');
    }

    async handleCustomerSubmit(e) {
        e.preventDefault();
        if (!window.db) {
            this.showNotification('Firebase not initialized', 'error');
            return;
        }

        const form = e.target;
        const customerId = form.dataset.customerId;

        // Form validation
        const name = document.getElementById('customerName').value.trim();
        const email = document.getElementById('customerEmail').value.trim();
        const phone = document.getElementById('customerPhone').value.trim();

        if (!name || !email || !phone) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showNotification('Please enter a valid email address', 'error');
            return;
        }

        const customerData = {
            name,
            email,
            phone,
            status: 'active',
            joined: customerId ? firebase.firestore.FieldValue.serverTimestamp() : firebase.firestore.Timestamp.now()
        };

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            if (customerId) {
                await db.collection('customers').doc(customerId).update(customerData);
            } else {
                await db.collection('customers').add(customerData);
            }
            document.getElementById('customerModal').classList.remove('active');
            await this.loadData();
            this.showNotification('Customer saved successfully!', 'success');
            form.reset();
        } catch (error) {
            console.error('Error saving customer:', error);
            this.showNotification('Error saving customer: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async deleteCustomer(customerId) {
        const confirmed = await this.showConfirm(
            'Delete Customer',
            'Are you sure you want to delete this customer? This action cannot be undone.',
            'warning'
        );

        if (confirmed) {
            try {
                await db.collection('customers').doc(customerId).delete();
                await this.loadData();
                this.showNotification('Customer deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting customer:', error);
                this.showNotification('Error deleting customer: ' + error.message, 'error');
            }
        }
    }

    editCustomer(customerId) {
        this.openCustomerModal(customerId);
    }

    async viewCustomer(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (customer) {
            await this.showAlert(
                'Customer Details',
                `Name: ${customer.name}\nEmail: ${customer.email}\nPhone: ${customer.phone}`,
                'info'
            );
        }
    }

    // Material Management
    async openMaterialModal(materialId = null) {
        const modal = document.getElementById('materialModal');
        const form = document.getElementById('materialForm');
        const title = document.getElementById('materialModalTitle');
        const subtitle = modal.querySelector('.modal-subtitle');
        const materialTypeSelect = document.getElementById('materialType');

        // Load materials to ensure list is up to date
        if (!this.materials || this.materials.length === 0) {
            await this.loadMaterialsData();
        }

        if (materialId) {
            const material = this.materials.find(m => m.id === materialId);
            if (material) {
                title.textContent = 'Edit Material';
                if (subtitle) subtitle.textContent = 'Update material details below';
                document.getElementById('materialName').value = material.name || '';

                // Set type - check if it exists in dropdown, otherwise add it
                if (materialTypeSelect) {
                    const existingOption = Array.from(materialTypeSelect.options).find(opt => opt.value === material.type);
                    if (existingOption) {
                        materialTypeSelect.value = material.type;
                    } else {
                        // Add custom type option
                        const option = document.createElement('option');
                        option.value = material.type;
                        option.textContent = material.type;
                        materialTypeSelect.appendChild(option);
                        materialTypeSelect.value = material.type;
                    }
                }

                document.getElementById('materialPrice').value = material.price || '';
                document.getElementById('materialStock').value = material.stock || '';
                form.dataset.materialId = materialId;
            }
        } else {
            title.textContent = 'Add New Material';
            if (subtitle) subtitle.textContent = 'Enter material details below';
            form.reset();
            if (materialTypeSelect) {
                materialTypeSelect.innerHTML = `
                    <option value="">-- Select Type --</option>
                    <option value="Waffle">Waffle</option>
                    <option value="Combweb">Combweb</option>
                    <option value="Vortex Jacquard">Vortex Jacquard</option>
                    <option value="Mesh">Mesh</option>
                    <option value="Iceburg">Iceburg</option>
                    <option value="Nano Check">Nano Check</option>
                    <option value="Closehole">Closehole</option>
                    <option value="Drytec">Drytec</option>
                    <option value="Wetlook">Wetlook</option>
                    <option value="Baby Pk">Baby Pk</option>
                    <option value="Cool Tech">Cool Tech</option>
                    <option value="Net">Net</option>
                `;
            }
            delete form.dataset.materialId;
        }

        modal.classList.add('active');
    }

    async handleMaterialSubmit(e) {
        e.preventDefault();
        if (!window.db) {
            this.showNotification('Firebase not initialized', 'error');
            return;
        }

        const form = e.target;
        const materialId = form.dataset.materialId;

        // Form validation
        const name = document.getElementById('materialName').value.trim();
        const type = document.getElementById('materialType').value.trim();
        const price = parseFloat(document.getElementById('materialPrice').value);
        const stock = parseInt(document.getElementById('materialStock').value);

        if (!name || !type || !price || price <= 0 || isNaN(stock) || stock < 0) {
            this.showNotification('Please fill in all required fields with valid values', 'error');
            return;
        }

        const materialData = {
            name,
            type,
            price,
            stock,
            status: stock > 0 ? 'available' : 'out-of-stock'
        };

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            if (materialId) {
                await db.collection('materials').doc(materialId).update(materialData);
            } else {
                await db.collection('materials').add(materialData);
            }
            document.getElementById('materialModal').classList.remove('active');
            await this.loadMaterialsData();
            this.showNotification('Material saved successfully!', 'success');

            // Refresh order form dropdown if modal is open
            const orderModal = document.getElementById('orderModal');
            if (orderModal && orderModal.classList.contains('active')) {
                const materialSelect = document.getElementById('orderMaterial');
                if (materialSelect) {
                    materialSelect.innerHTML = '<option value="">-- Select Material --</option>';
                    if (this.materials && this.materials.length > 0) {
                        this.materials.forEach(m => {
                            const option = document.createElement('option');
                            option.value = m.name;
                            option.textContent = `${m.name} - $${parseFloat(m.price || 0).toFixed(2)} (Stock: ${m.stock || 0})`;
                            materialSelect.appendChild(option);
                        });
                    }
                }
            }
            form.reset();
        } catch (error) {
            console.error('Error saving material:', error);
            this.showNotification('Error saving material: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async deleteMaterial(materialId) {
        const confirmed = await this.showConfirm(
            'Delete Material',
            'Are you sure you want to delete this material? This action cannot be undone.',
            'warning'
        );

        if (confirmed) {
            try {
                await db.collection('materials').doc(materialId).delete();
                await this.loadData();
                await this.loadMaterialsData();
                this.showNotification('Material deleted successfully!', 'success');

                // Refresh order form dropdown if modal is open
                const orderModal = document.getElementById('orderModal');
                if (orderModal && orderModal.classList.contains('active')) {
                    const materialSelect = document.getElementById('orderMaterial');
                    if (materialSelect) {
                        materialSelect.innerHTML = '<option value="">-- Select Material --</option>';
                        if (this.materials && this.materials.length > 0) {
                            this.materials.forEach(m => {
                                const option = document.createElement('option');
                                option.value = m.name;
                                option.textContent = `${m.name} - $${parseFloat(m.price || 0).toFixed(2)} (Stock: ${m.stock || 0})`;
                                materialSelect.appendChild(option);
                            });
                        } else {
                            const option = document.createElement('option');
                            option.value = '';
                            option.textContent = 'No materials available - Please add materials first';
                            option.disabled = true;
                            materialSelect.appendChild(option);
                        }
                    }
                }
            } catch (error) {
                console.error('Error deleting material:', error);
                this.showNotification('Error deleting material: ' + error.message, 'error');
            }
        }
    }

    editMaterial(materialId) {
        this.openMaterialModal(materialId);
    }

    // Supplier Management
    async openSupplierModal(supplierId = null) {
        const modal = document.getElementById('supplierModal');
        const form = document.getElementById('supplierForm');
        const title = document.getElementById('supplierModalTitle');

        if (!modal || !form || !title) {
            console.error('Supplier modal elements not found!');
            return;
        }

        const subtitle = modal.querySelector('.modal-subtitle');

        if (supplierId) {
            const supplier = this.suppliers.find(s => s.id === supplierId);
            if (supplier) {
                title.textContent = 'Edit Supplier';
                if (subtitle) subtitle.textContent = 'Update supplier details below';
                document.getElementById('supplierName').value = supplier.name || '';
                document.getElementById('supplierEmail').value = supplier.email || '';
                document.getElementById('supplierStatus').value = supplier.status || 'active';
                document.getElementById('supplierLocation').value = supplier.location || '';
                form.dataset.supplierId = supplierId;
            }
        } else {
            title.textContent = 'Add New Supplier';
            if (subtitle) subtitle.textContent = 'Enter supplier information below';
            form.reset();
            delete form.dataset.supplierId;
        }

        modal.classList.add('active');
        modal.style.display = 'flex';
    }

    async handleSupplierSubmit(e) {
        e.preventDefault();
        if (!window.db) {
            this.showNotification('Firebase not initialized', 'error');
            return;
        }

        const form = e.target;
        const supplierId = form.dataset.supplierId;

        // Form validation
        const name = document.getElementById('supplierName').value.trim();
        const email = document.getElementById('supplierEmail').value.trim();
        const status = document.getElementById('supplierStatus').value;
        const location = document.getElementById('supplierLocation').value;

        if (!name || !email || !status || !location) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showNotification('Please enter a valid email address', 'error');
            return;
        }

        const supplierData = {
            name,
            email,
            status,
            location
        };

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            if (supplierId) {
                await db.collection('suppliers').doc(supplierId).update(supplierData);
            } else {
                await db.collection('suppliers').add(supplierData);
            }
            const supplierModal = document.getElementById('supplierModal');
            if (supplierModal) {
                supplierModal.classList.remove('active');
                supplierModal.style.display = 'none';
            }
            form.reset();
            this.showNotification('Supplier saved successfully!', 'success');
            await this.loadData();
            this.updateKPIs();

            // Refresh order form dropdown if modal is open
            const orderModal = document.getElementById('orderModal');
            if (orderModal && orderModal.classList.contains('active')) {
                const supplierSelect = document.getElementById('orderSupplier');
                if (supplierSelect && this.suppliers && this.suppliers.length > 0) {
                    const currentValue = supplierSelect.value;
                    supplierSelect.innerHTML = '<option value="">-- Select Supplier --</option>' +
                        this.suppliers.filter(s => s.status === 'active').map(s =>
                            `<option value="${s.id}">${s.name} (${s.location})</option>`
                        ).join('');
                    if (currentValue) {
                        supplierSelect.value = currentValue;
                    }
                }
            }
        } catch (error) {
            console.error('Error saving supplier:', error);
            this.showNotification('Error saving supplier: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async deleteSupplier(supplierId) {
        const confirmed = await this.showConfirm(
            'Delete Supplier',
            'Are you sure you want to delete this supplier? This action cannot be undone.',
            'warning'
        );
        if (!confirmed) return;

        try {
            await db.collection('suppliers').doc(supplierId).delete();
            await this.loadData();
            this.showNotification('Supplier deleted successfully!', 'success');
            this.updateKPIs();
        } catch (error) {
            console.error('Error deleting supplier:', error);
            this.showNotification('Error deleting supplier: ' + error.message, 'error');
        }
    }

    editSupplier(supplierId) {
        this.openSupplierModal(supplierId);
    }

    // Design Studio
    newDesign() {
        const canvas = document.getElementById('jerseyCanvas');
        if (canvas) {
            canvas.width = 400;
            canvas.height = 500;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    updateJerseyColor(color) {
        const canvas = document.getElementById('jerseyCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    updateTextColor(color) {
        const canvas = document.getElementById('jerseyCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.font = '30px Arial';
            ctx.fillText('JERSEY', canvas.width / 2 - 60, canvas.height / 2);
        }
    }

    handleLogoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.getElementById('jerseyCanvas');
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, canvas.width / 2 - 50, canvas.height / 2 - 50, 100, 100);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    clearDesign() {
        const canvas = document.getElementById('jerseyCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    async saveDesign() {
        const canvas = document.getElementById('jerseyCanvas');
        const designName = document.getElementById('designName').value;

        if (!designName) {
            this.showNotification('Please enter a design name', 'error');
            return;
        }

        const designData = {
            name: designName,
            image: canvas.toDataURL(),
            created: firebase.firestore.Timestamp.now()
        };

        try {
            await db.collection('designs').add(designData);
            this.showNotification('Design saved successfully!', 'success');
            this.loadDesigns();
            document.getElementById('designName').value = '';
        } catch (error) {
            console.error('Error saving design:', error);
            this.showNotification('Error saving design', 'error');
        }
    }

    async loadDesigns() {
        try {
            const designsSnapshot = await db.collection('designs').orderBy('created', 'desc').get();
            this.designs = designsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const grid = document.getElementById('designsGrid');
            if (grid) {
                if (this.designs.length === 0) {
                    grid.innerHTML = '<div class="no-data">No designs saved yet</div>';
                    return;
                }

                grid.innerHTML = this.designs.map(design => `
                    <div class="design-item">
                        <img src="${design.image}" alt="${design.name}" style="width: 100%; border-radius: 8px; margin-bottom: 10px;">
                        <h4>${design.name}</h4>
                        <button class="btn-gradient btn-small" data-action="delete" data-id="${design.id}" data-type="design">Delete</button>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading designs:', error);
        }
    }

    async deleteDesign(designId) {
        const confirmed = await this.showConfirm(
            'Delete Design',
            'Are you sure you want to delete this design? This action cannot be undone.',
            'warning'
        );

        if (confirmed) {
            try {
                await db.collection('designs').doc(designId).delete();
                this.loadDesigns();
                this.showNotification('Design deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting design:', error);
                this.showNotification('Error deleting design: ' + error.message, 'error');
            }
        }
    }

    // Reports
    async generateReport(reportType = null) {
        if (!reportType) {
            const reportTypeEl = document.getElementById('reportType');
            reportType = (reportTypeEl && reportTypeEl.value) || 'sales';
        }

        const dateFromEl = document.getElementById('reportDateFrom');
        const dateToEl = document.getElementById('reportDateTo');
        const dateFrom = dateFromEl ? dateFromEl.value : null;
        const dateTo = dateToEl ? dateToEl.value : null;

        try {
            // Generate the report based on type
            let reportContent = '';
            let fileName = '';
            let reportSize = 0;

            switch (reportType) {
                case 'sales':
                    const salesReport = this.generateSalesReport(dateFrom, dateTo);
                    reportContent = salesReport.content;
                    fileName = `Sales_Report_${new Date().toISOString().split('T')[0]}.csv`;
                    reportSize = salesReport.size;
                    break;
                case 'customer':
                    const customerReport = this.generateCustomerReport(dateFrom, dateTo);
                    reportContent = customerReport.content;
                    fileName = `Customer_Report_${new Date().toISOString().split('T')[0]}.csv`;
                    reportSize = customerReport.size;
                    break;
                case 'inventory':
                    const inventoryReport = this.generateInventoryReport();
                    reportContent = inventoryReport.content;
                    fileName = `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`;
                    reportSize = inventoryReport.size;
                    break;
                case 'financial':
                    const financialReport = this.generateFinancialReport(dateFrom, dateTo);
                    reportContent = financialReport.content;
                    fileName = `Financial_Report_${new Date().toISOString().split('T')[0]}.csv`;
                    reportSize = financialReport.size;
                    break;
                default:
                    throw new Error('Invalid report type');
            }

            // Download the report
            this.downloadCSV(reportContent, fileName);

            // Save to Firebase
            const reportData = {
                type: reportType,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                fileName: fileName,
                size: reportSize,
                generated: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('reports').add(reportData);
            this.loadRecentReports();
            this.showNotification('Report generated and downloaded successfully!', 'success');
        } catch (error) {
            console.error('Error generating report:', error);
            this.showNotification('Error generating report: ' + error.message, 'error');
        }
    }

    generateSalesReport(dateFrom, dateTo) {
        let orders = this.allOrders || this.orders || [];

        // Filter by date range if provided
        if (dateFrom || dateTo) {
            orders = orders.filter(order => {
                const orderDate = (order.date && order.date.toDate) ? order.date.toDate() : new Date(order.date || Date.now());
                if (dateFrom) {
                    const fromDate = new Date(dateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    if (orderDate < fromDate) return false;
                }
                if (dateTo) {
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (orderDate > toDate) return false;
                }
                return true;
            });
        }

        // Generate CSV content
        let csv = 'Order ID,Customer Name,Mobile,Material,Quantity,Status,Date,Revenue\n';

        let totalRevenue = 0;
        orders.forEach(order => {
            const orderDate = (order.date && order.date.toDate) ? order.date.toDate() : new Date(order.date || Date.now());
            const quantity = parseInt(order.amount || 0);
            const price = parseFloat(order.materialPrice || 0);
            const revenue = quantity * price;
            totalRevenue += revenue;

            csv += `${order.id || 'N/A'},`;
            csv += `${this.escapeCSV(order.customer || 'N/A')},`;
            csv += `${this.escapeCSV(order.mobile || 'N/A')},`;
            csv += `${this.escapeCSV(order.material || 'N/A')},`;
            csv += `${quantity},`;
            csv += `${order.status || 'pending'},`;
            csv += `${orderDate.toLocaleDateString()},`;
            csv += `$${revenue.toFixed(2)}\n`;
        });

        // Add summary
        csv += `\nSummary\n`;
        csv += `Total Orders,${orders.length}\n`;
        csv += `Total Revenue,$${totalRevenue.toFixed(2)}\n`;
        csv += `Average Order Value,$${orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : '0.00'}\n`;

        const sizeKB = (new Blob([csv]).size / 1024).toFixed(2);
        return {
            content: csv,
            size: parseFloat(sizeKB)
        };
    }

    generateCustomerReport(dateFrom, dateTo) {
        let customers = this.customers || [];

        // Filter by date range if provided (based on joined date)
        if (dateFrom || dateTo) {
            customers = customers.filter(customer => {
                if (!customer.joined) return false;
                const joinDate = (customer.joined && customer.joined.toDate) ? customer.joined.toDate() : new Date(customer.joined);
                if (dateFrom) {
                    const fromDate = new Date(dateFrom);
                    if (joinDate < fromDate) return false;
                }
                if (dateTo) {
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (joinDate > toDate) return false;
                }
                return true;
            });
        }

        let csv = 'Customer Name,Email,Phone,Status,Joined Date,Total Orders\n';

        const orders = this.allOrders || this.orders || [];
        customers.forEach(customer => {
            const joinDate = (customer.joined && customer.joined.toDate) ? customer.joined.toDate() : new Date(customer.joined);
            const orderCount = orders.filter(o =>
                o.customer === customer.name && o.mobile === customer.phone
            ).length;

            csv += `${this.escapeCSV(customer.name || 'N/A')},`;
            csv += `${this.escapeCSV(customer.email || 'N/A')},`;
            csv += `${this.escapeCSV(customer.phone || 'N/A')},`;
            csv += `${customer.status || 'active'},`;
            csv += `${joinDate.toLocaleDateString()},`;
            csv += `${orderCount}\n`;
        });

        // Add summary
        csv += `\nSummary\n`;
        csv += `Total Customers,${customers.length}\n`;
        csv += `Active Customers,${customers.filter(c => c.status === 'active').length}\n`;

        const sizeKB = (new Blob([csv]).size / 1024).toFixed(2);
        return {
            content: csv,
            size: parseFloat(sizeKB)
        };
    }

    generateInventoryReport() {
        const materials = this.materials || [];

        let csv = 'Material Name,Type,Stock,Price,Status,Low Stock Alert\n';

        materials.forEach(material => {
            const lowStock = material.stock < 10 && material.stock > 0;
            const outOfStock = material.stock === 0;

            csv += `${this.escapeCSV(material.name || 'N/A')},`;
            csv += `${this.escapeCSV(material.type || 'N/A')},`;
            csv += `${material.stock || 0},`;
            csv += `$${(material.price || 0).toFixed(2)},`;
            csv += `${outOfStock ? 'Out of Stock' : (lowStock ? 'Low Stock' : 'Available')},`;
            csv += `${lowStock || outOfStock ? 'Yes' : 'No'}\n`;
        });

        // Add summary
        csv += `\nSummary\n`;
        csv += `Total Materials,${materials.length}\n`;
        csv += `Available,${materials.filter(m => m.stock > 0 && m.status === 'available').length}\n`;
        csv += `Low Stock,${materials.filter(m => m.stock > 0 && m.stock < 10).length}\n`;
        csv += `Out of Stock,${materials.filter(m => m.stock === 0 || m.status === 'out-of-stock').length}\n`;
        csv += `Total Value,$${materials.reduce((sum, m) => sum + (m.stock * (m.price || 0)), 0).toFixed(2)}\n`;

        const sizeKB = (new Blob([csv]).size / 1024).toFixed(2);
        return {
            content: csv,
            size: parseFloat(sizeKB)
        };
    }

    generateFinancialReport(dateFrom, dateTo) {
        let orders = this.allOrders || this.orders || [];

        // Filter by date range if provided
        if (dateFrom || dateTo) {
            orders = orders.filter(order => {
                const orderDate = (order.date && order.date.toDate) ? order.date.toDate() : new Date(order.date || Date.now());
                if (dateFrom) {
                    const fromDate = new Date(dateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    if (orderDate < fromDate) return false;
                }
                if (dateTo) {
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (orderDate > toDate) return false;
                }
                return true;
            });
        }

        // Calculate financial metrics
        let totalRevenue = 0;
        let totalOrders = orders.length;
        let totalQuantity = 0;

        orders.forEach(order => {
            const quantity = parseInt(order.amount || 0);
            const price = parseFloat(order.materialPrice || 0);
            totalRevenue += quantity * price;
            totalQuantity += quantity;
        });

        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const avgQuantity = totalOrders > 0 ? totalQuantity / totalOrders : 0;

        // Group by status
        const statusCounts = {};
        orders.forEach(order => {
            statusCounts[order.status || 'pending'] = (statusCounts[order.status || 'pending'] || 0) + 1;
        });

        // Generate CSV
        let csv = 'Financial Summary Report\n';
        csv += `Generated: ${new Date().toLocaleString()}\n`;
        if (dateFrom) csv += `Date From: ${dateFrom}\n`;
        if (dateTo) csv += `Date To: ${dateTo}\n`;
        csv += `\n`;

        csv += 'Metrics,Value\n';
        csv += `Total Revenue,$${totalRevenue.toFixed(2)}\n`;
        csv += `Total Orders,${totalOrders}\n`;
        csv += `Total Quantity,${totalQuantity}\n`;
        csv += `Average Order Value,$${avgOrderValue.toFixed(2)}\n`;
        csv += `Average Quantity per Order,${avgQuantity.toFixed(2)}\n`;
        csv += `\n`;

        csv += 'Order Status Breakdown\n';
        csv += 'Status,Count\n';
        Object.keys(statusCounts).forEach(status => {
            csv += `${status},${statusCounts[status]}\n`;
        });

        const sizeKB = (new Blob([csv]).size / 1024).toFixed(2);
        return {
            content: csv,
            size: parseFloat(sizeKB)
        };
    }

    escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    downloadCSV(content, fileName) {
        const blob = new Blob([content], {
            type: 'text/csv;charset=utf-8;'
        });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    async loadRecentReports() {
        try {
            const reportsSnapshot = await db.collection('reports').orderBy('generated', 'desc').limit(10).get();
            const reports = reportsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const tbody = document.getElementById('reportsTable');
            if (tbody) {
                if (reports.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="no-data">No reports generated yet</td></tr>';
                    return;
                }

                tbody.innerHTML = reports.map(report => {
                    const reportSize = report.size ? `${report.size.toFixed(2)} KB` : 'N/A';
                    return `
                        <tr>
                            <td>${report.type ? (report.type.charAt(0).toUpperCase() + report.type.slice(1)) : 'Unknown'} Report</td>
                            <td>${report.type || 'N/A'}</td>
                            <td>${this.formatDate(report.generated)}</td>
                            <td>${reportSize}</td>
                            <td>
                                <button class="action-btn" data-action="download" data-id="${report.id}" data-type="report">Download</button>
                                <button class="action-btn delete" data-action="delete" data-id="${report.id}" data-type="report">Delete</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Error loading reports:', error);
        }
    }

    async downloadReport(reportId) {
        try {
            const reportDoc = await db.collection('reports').doc(reportId).get();
            if (!reportDoc.exists) {
                this.showNotification('Report not found', 'error');
                return;
            }

            const report = {
                id: reportDoc.id,
                ...reportDoc.data()
            };

            // Regenerate the report with saved parameters
            await this.generateReport(report.type);
        } catch (error) {
            console.error('Error downloading report:', error);
            this.showNotification('Error downloading report: ' + error.message, 'error');
        }
    }

    async deleteReport(reportId) {
        const confirmed = await this.showConfirm(
            'Delete Report',
            'Are you sure you want to delete this report? This action cannot be undone.',
            'warning'
        );

        if (confirmed) {
            try {
                await db.collection('reports').doc(reportId).delete();
                this.loadRecentReports();
                this.showNotification('Report deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting report:', error);
                this.showNotification('Error deleting report: ' + error.message, 'error');
            }
        }
    }

    // Settings
    async updateProfile() {
        if (!window.db) {
            this.showNotification('Firebase not initialized', 'error');
            return;
        }

        const fullNameEl = document.getElementById('fullName');
        const emailEl = document.getElementById('userEmail');
        const phoneEl = document.getElementById('userPhone');

        if (!fullNameEl || !emailEl || !phoneEl) {
            this.showNotification('Profile form elements not found', 'error');
            return;
        }

        const fullName = fullNameEl.value.trim();
        let email = emailEl.value.trim();
        const phone = phoneEl.value.trim();

        // Get authenticated user email from Firebase Auth (primary source)
        if (window.auth && window.auth.currentUser) {
            const authEmail = window.auth.currentUser.email || '';
            // Use Firebase Auth email as the source of truth
            if (authEmail && email !== authEmail) {
                // Email doesn't match Auth email, use Auth email instead
                email = authEmail;
                emailEl.value = email;
            } else if (!email) {
                email = authEmail;
                emailEl.value = email;
            }
        }

        // Validation
        if (!fullName) {
            this.showNotification('Full name is required', 'error');
            return;
        }

        if (!email) {
            this.showNotification('Email is required', 'error');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showNotification('Please enter a valid email address', 'error');
            return;
        }

        // Show loading state
        const updateBtn = document.getElementById('updateProfileBtn');
        const originalText = updateBtn ? updateBtn.textContent : 'Update Profile';
        if (updateBtn) {
            updateBtn.disabled = true;
            updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        }

        try {
            await db.collection('settings').doc('profile').set({
                fullName,
                email,
                phone,
                updated: firebase.firestore.FieldValue.serverTimestamp()
            }, {
                merge: true
            });

            // Update profile dropdown immediately
            await this.loadProfileData();

            // Also update settings form fields to reflect saved values
            if (fullNameEl) fullNameEl.value = fullName;
            if (emailEl) emailEl.value = email;
            if (phoneEl) phoneEl.value = phone;

            this.showNotification('Profile updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showNotification('Error updating profile: ' + error.message, 'error');
        } finally {
            // Restore button state
            if (updateBtn) {
                updateBtn.disabled = false;
                updateBtn.textContent = originalText;
            }
        }
    }

    async changePassword() {
        if (!window.auth) {
            this.showNotification('Firebase Auth not initialized', 'error');
            return;
        }

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showNotification('Please fill in all password fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 8) {
            this.showNotification('Password must be at least 8 characters', 'error');
            return;
        }

        // Check password requirements
        const hasUpper = /[A-Z]/.test(newPassword);
        const hasLower = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);

        if (!hasUpper || !hasLower || !hasNumber) {
            this.showNotification('Password must contain uppercase, lowercase letters, and at least one number', 'error');
            return;
        }

        try {
            const user = auth.currentUser;
            if (!user) {
                // If no user is logged in, just show success (demo mode)
                this.showNotification('Password change simulated (no user logged in)', 'success');
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                return;
            }

            // Re-authenticate user
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
            await user.reauthenticateWithCredential(credential);

            // Update password
            await user.updatePassword(newPassword);

            this.showNotification('Password changed successfully!', 'success');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } catch (error) {
            console.error('Error changing password:', error);

            let errorMessage = 'Error changing password';
            if (error.code === 'auth/wrong-password') {
                errorMessage = 'Current password is incorrect';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'New password is too weak';
            } else if (error.code === 'auth/requires-recent-login') {
                errorMessage = 'Please log out and log in again to change your password';
            } else {
                errorMessage = error.message || 'Unknown error occurred';
            }

            this.showNotification(errorMessage, 'error');
        }
    }

    // Charts
    initializeCharts() {
        // Initialize Chart.js if available, otherwise use simple canvas charts
        this.updateCharts();
    }

    updateCharts() {
        // Update charts with real data
        this.drawSalesChart();
        this.drawStatusChart();
        this.drawRevenueChart();
        this.drawGrowthChart();
    }

    drawSalesChart() {
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const containerWidth = canvas.parentElement.clientWidth || 400;
        canvas.width = containerWidth;
        canvas.height = 300;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Get orders from last 7 days
        const orders = this.allOrders || this.orders || [];
        const today = new Date();
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            last7Days.push(date);
        }

        const salesData = last7Days.map(date => {
            return orders.filter(order => {
                const orderDate = (order.date && order.date.toDate) ? order.date.toDate() : new Date(order.date || Date.now());
                orderDate.setHours(0, 0, 0, 0);
                return orderDate.getTime() === date.getTime();
            }).length;
        });

        const maxSales = Math.max(...salesData, 1);
        const padding = 50;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        const stepX = chartWidth / 6;
        const maxValue = maxSales || 1;

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
        }

        // Draw line chart
        ctx.strokeStyle = '#ff003c';
        ctx.lineWidth = 3;
        ctx.beginPath();

        salesData.forEach((value, index) => {
            const x = padding + index * stepX;
            const y = padding + chartHeight - (value / maxValue) * chartHeight;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw points
        ctx.fillStyle = '#ff003c';
        salesData.forEach((value, index) => {
            const x = padding + index * stepX;
            const y = padding + chartHeight - (value / maxValue) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Draw labels
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('Orders', 10, 20);

        // Day labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Arial';
        last7Days.forEach((date, index) => {
            const dayName = date.toLocaleDateString('en-US', {
                weekday: 'short'
            });
            const x = padding + index * stepX;
            ctx.textAlign = 'center';
            ctx.fillText(dayName, x, canvas.height - 10);
        });

        // Value labels
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        salesData.forEach((value, index) => {
            const x = padding + index * stepX;
            const y = padding + chartHeight - (value / maxValue) * chartHeight;
            ctx.fillText(value.toString(), x + 8, y - 5);
        });
    }

    drawStatusChart() {
        const canvas = document.getElementById('statusChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const containerWidth = canvas.parentElement.clientWidth || 400;
        canvas.width = containerWidth;
        canvas.height = 300;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const orders = this.allOrders || this.orders || [];
        const statusMap = {
            'pending': {
                label: 'Pending',
                color: '#ff8800'
            },
            'submitted': {
                label: 'Submitted',
                color: '#0099ff'
            },
            'completed': {
                label: 'Completed',
                color: '#00ff88'
            },
            'draft': {
                label: 'Draft',
                color: '#ffd700'
            },
            'processing': {
                label: 'Processing',
                color: '#9966ff'
            }
        };

        const statusCounts = {};
        Object.keys(statusMap).forEach(status => {
            statusCounts[status] = orders.filter(o => o.status === status).length;
        });

        const total = orders.length || 1;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX - 60, centerY - 60, 80);

        let startAngle = -Math.PI / 2; // Start from top

        // Draw pie slices
        Object.keys(statusMap).forEach((status, i) => {
            const count = statusCounts[status];
            if (count === 0) return;

            const sliceAngle = (count / total) * 2 * Math.PI;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = statusMap[status].color;
            ctx.fill();
            ctx.strokeStyle = '#1a1a2e';
            ctx.lineWidth = 2;
            ctx.stroke();

            startAngle += sliceAngle;
        });

        // Draw legend
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        let legendY = 30;
        let legendX = 20;

        Object.keys(statusMap).forEach((status, i) => {
            const count = statusCounts[status];
            if (count === 0) return;

            ctx.fillStyle = statusMap[status].color;
            ctx.fillRect(legendX, legendY - 10, 15, 15);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${statusMap[status].label}: ${count}`, legendX + 20, legendY);
            legendY += 20;
        });
    }

    drawRevenueChart() {
        const canvas = document.getElementById('revenueChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const containerWidth = canvas.parentElement.clientWidth || 400;
        canvas.width = containerWidth;
        canvas.height = 300;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const orders = this.allOrders || this.orders || [];
        const today = new Date();
        const last12Months = [];

        for (let i = 11; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            last12Months.push(date);
        }

        const monthlyRevenue = last12Months.map(monthStart => {
            return orders.filter(order => {
                const orderDate = (order.date && order.date.toDate) ? order.date.toDate() : new Date(order.date || Date.now());
                return orderDate.getMonth() === monthStart.getMonth() &&
                    orderDate.getFullYear() === monthStart.getFullYear();
            }).reduce((sum, order) => {
                // Calculate revenue: quantity * material price
                const quantity = parseInt(order.amount || 0);
                const price = parseFloat(order.materialPrice || 0);
                return sum + (quantity * price);
            }, 0);
        });

        const maxRevenue = Math.max(...monthlyRevenue, 1);
        const padding = 50;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        const barWidth = (chartWidth / 12) - 5;

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
        }

        // Draw bars
        monthlyRevenue.forEach((revenue, index) => {
            const barHeight = (revenue / maxRevenue) * chartHeight;
            const x = padding + index * (chartWidth / 12) + 2;
            const y = padding + chartHeight - barHeight;

            ctx.fillStyle = '#ff003c';
            ctx.fillRect(x, y, barWidth, barHeight);

            // Draw value label
            if (revenue > 0) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('$' + revenue.toFixed(0), x + barWidth / 2, y - 5);
            }
        });

        // Month labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Arial';
        last12Months.forEach((date, index) => {
            const monthName = date.toLocaleDateString('en-US', {
                month: 'short'
            });
            const x = padding + index * (chartWidth / 12) + barWidth / 2;
            ctx.textAlign = 'center';
            ctx.fillText(monthName, x, canvas.height - 10);
        });

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('Revenue ($)', 10, 20);
    }

    drawGrowthChart() {
        const canvas = document.getElementById('growthChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const containerWidth = canvas.parentElement.clientWidth || 400;
        canvas.width = containerWidth;
        canvas.height = 300;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const customers = this.customers || [];
        const today = new Date();
        const last6Months = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            last6Months.push(date);
        }

        const monthlyCustomers = last6Months.map(monthStart => {
            return customers.filter(customer => {
                if (!customer.joined) return false;
                const joinDate = (customer.joined && customer.joined.toDate) ? customer.joined.toDate() : new Date(customer.joined);
                return joinDate.getMonth() === monthStart.getMonth() &&
                    joinDate.getFullYear() === monthStart.getFullYear();
            }).length;
        });

        // Cumulative growth
        let cumulative = 0;
        const growthData = monthlyCustomers.map(count => {
            cumulative += count;
            return cumulative;
        });

        const maxGrowth = Math.max(...growthData, 1);
        const padding = 50;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        const stepX = chartWidth / 5;

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
        }

        // Draw line
        ctx.strokeStyle = '#0099ff';
        ctx.lineWidth = 3;
        ctx.beginPath();

        growthData.forEach((value, index) => {
            const x = padding + index * stepX;
            const y = padding + chartHeight - (value / maxGrowth) * chartHeight;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw points
        ctx.fillStyle = '#0099ff';
        growthData.forEach((value, index) => {
            const x = padding + index * stepX;
            const y = padding + chartHeight - (value / maxGrowth) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Labels
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('Total Customers', 10, 20);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Arial';
        last6Months.forEach((date, index) => {
            const monthName = date.toLocaleDateString('en-US', {
                month: 'short'
            });
            const x = padding + index * stepX;
            ctx.textAlign = 'center';
            ctx.fillText(monthName, x, canvas.height - 10);
        });

        // Value labels
        ctx.textAlign = 'left';
        growthData.forEach((value, index) => {
            const x = padding + index * stepX;
            const y = padding + chartHeight - (value / maxGrowth) * chartHeight;
            ctx.fillText(value.toString(), x + 8, y - 5);
        });
    }

    // Utility Functions
    generateUniqueToken() {
        // Generate a unique token for the customer link
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    async showAlertWithCopy(title, message, link) {
        return new Promise((resolve) => {
            // Create a custom dialog for showing the link with copy button
            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog active';
            dialog.innerHTML = `
                <div class="custom-dialog-content">
                    <div class="custom-dialog-header">
                        <div class="custom-dialog-icon success">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <h3 class="custom-dialog-title">${title}</h3>
                    </div>
                    <div class="custom-dialog-message">
                        <p>${message}</p>
                        <div style="margin-top: 15px; padding: 10px; background: rgba(255, 0, 60, 0.1); border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 12px;">
                            ${link}
                        </div>
                    </div>
                    <div class="custom-dialog-buttons">
                        <button class="custom-dialog-btn primary" id="copyLinkBtn">
                            <i class="fas fa-copy"></i> Copy Link
                        </button>
                        <button class="custom-dialog-btn secondary" id="closeLinkDialog">
                            Close
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);

            const copyBtn = document.getElementById('copyLinkBtn');
            const closeBtn = document.getElementById('closeLinkDialog');

            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(link);
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    copyBtn.disabled = true;
                    setTimeout(() => {
                        document.body.removeChild(dialog);
                        resolve(true);
                    }, 1000);
                } catch (err) {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = link;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        document.body.removeChild(dialog);
                        resolve(true);
                    }, 1000);
                }
            });

            closeBtn.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve(false);
            });
        });
    }

    renderPagination(key, data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const pagination = this.pagination[key];
        const totalPages = Math.ceil(data.length / pagination.pageSize);

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        const startRecord = data.length === 0 ? 0 : (pagination.currentPage - 1) * pagination.pageSize + 1;
        const endRecord = Math.min(pagination.currentPage * pagination.pageSize, data.length);

        let html = `
            <button class="pagination-btn" data-action="page" data-key="${key}" data-page="${pagination.currentPage - 1}" ${pagination.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Show page numbers (max 5 visible)
        const maxVisible = 5;
        let startPage = Math.max(1, pagination.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<button class="pagination-btn" data-action="page" data-key="${key}" data-page="1">1</button>`;
            if (startPage > 2) html += `<span class="pagination-info">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="pagination-btn ${i === pagination.currentPage ? 'active' : ''}" data-action="page" data-key="${key}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="pagination-info">...</span>`;
            html += `<button class="pagination-btn" data-action="page" data-key="${key}" data-page="${totalPages}">${totalPages}</button>`;
        }

        html += `
            <button class="pagination-btn" data-action="page" data-key="${key}" data-page="${pagination.currentPage + 1}" ${pagination.currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
            <span class="pagination-info">Showing ${startRecord}-${endRecord} of ${data.length}</span>
        `;

        container.innerHTML = html;
    }

    handlePagination(key, page) {
        if (this.pagination[key]) {
            this.pagination[key].currentPage = parseInt(page);

            // Re-render the appropriate table
            switch (key) {
                case 'recentOrders':
                    this.renderRecentOrders();
                    break;
                case 'orders':
                    this.renderOrders();
                    break;
                case 'customers':
                    this.renderCustomers();
                    break;
                case 'materials':
                    this.renderMaterials();
                    break;
                case 'suppliers':
                    this.renderSuppliers();
                    break;
            }
        }
    }

    formatDate(date) {
        if (!date) return 'N/A';
        const d = (date && date.toDate) ? date.toDate() : new Date(date);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    showNotification(message, type = 'info') {
        // Enhanced notification system with ASUS ROG theme
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;

        const icons = {
            success: 'check-circle',
            error: 'times-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };

        notification.innerHTML = `
            <div class="notification-toast-header">
                <i class="fas fa-${icons[type] || 'info-circle'}"></i>
                <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
            </div>
            <div class="notification-toast-message">${message}</div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Custom Alert Dialog
    showAlert(title, message, type = 'info') {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const dialogIcon = document.getElementById('dialogIcon');
            const dialogTitle = document.getElementById('dialogTitle');
            const dialogMessage = document.getElementById('dialogMessage');
            const dialogButtons = document.getElementById('dialogButtons');
            const dialogConfirm = document.getElementById('dialogConfirm');

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
                resolve(true);
            };
            dialogButtons.appendChild(okBtn);

            dialog.classList.add('active');

            // Close on outside click
            dialog.onclick = (e) => {
                if (e.target === dialog) {
                    dialog.classList.remove('active');
                    resolve(true);
                }
            };
        });
    }

    // Custom Confirm Dialog
    showConfirm(title, message, type = 'warning') {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const dialogIcon = document.getElementById('dialogIcon');
            const dialogTitle = document.getElementById('dialogTitle');
            const dialogMessage = document.getElementById('dialogMessage');
            const dialogButtons = document.getElementById('dialogButtons');

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

    // Notification Center
    notifications = [];

    toggleNotifications(e) {
        e.stopPropagation();
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) {
            if (dropdown.classList.contains('active')) {
                this.closeNotificationDropdown();
            } else {
                this.closeProfileDropdown();
                dropdown.classList.add('active');
                this.loadNotifications();
            }
        }
    }

    closeNotificationDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    }

    async loadNotifications() {
        if (!window.db) {
            console.warn('Firebase not initialized, using default notifications');
            this.notifications = this.getDefaultNotifications();
            this.renderNotifications();
            this.updateNotificationBadge();
            return;
        }

        try {
            // Only load if real-time listener is not set up
            if (!this.firebaseListeners.notifications) {
                // Load notifications from Firebase
                const notificationsSnapshot = await db.collection('notifications')
                    .orderBy('timestamp', 'desc')
                    .limit(20)
                    .get();

                this.notifications = notificationsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                this.renderNotifications();
                this.updateNotificationBadge();
            }
            // If listener is active, it will automatically update the notifications
        } catch (error) {
            console.error('Error loading notifications:', error);
            // Use default notifications if Firebase fails
            this.notifications = this.getDefaultNotifications();
            this.renderNotifications();
            this.updateNotificationBadge();
        }
    }

    getDefaultNotifications() {
        return [{
                id: '1',
                type: 'info',
                title: 'Welcome to Otomono Jersey',
                message: 'Your admin panel is ready to use. Start managing your orders and customers.',
                timestamp: firebase.firestore.Timestamp.now(),
                read: false
            },
            {
                id: '2',
                type: 'success',
                title: 'New Order Received',
                message: 'You have a new order from a customer. Check the Orders page for details.',
                timestamp: firebase.firestore.Timestamp.fromDate(new Date(Date.now() - 3600000)),
                read: false
            }
        ];
    }

    renderNotifications() {
        const list = document.getElementById('notificationList');
        if (!list) return;

        if (this.notifications.length === 0) {
            list.innerHTML = '<div class="no-notifications">No new notifications</div>';
            return;
        }

        list.innerHTML = this.notifications.map(notif => {
            const time = (notif.timestamp && notif.timestamp.toDate) ? notif.timestamp.toDate() : new Date(notif.timestamp || Date.now());
            const timeAgo = this.getTimeAgo(time);
            const unreadClass = !notif.read ? 'unread' : '';

            return `
                <div class="notification-item ${unreadClass}" data-id="${notif.id}">
                    <div class="notification-icon ${notif.type || 'info'}">
                        <i class="fas fa-${this.getNotificationIcon(notif.type)}"></i>
                    </div>
                    <div class="notification-content" data-action="read" data-id="${notif.id}" data-type="notification">
                        <div class="notification-title">${notif.title || 'Notification'}</div>
                        <div class="notification-message">${notif.message || ''}</div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                    <button class="notification-delete" data-action="delete" data-id="${notif.id}" data-type="notification" title="Delete notification">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    getNotificationIcon(type) {
        const icons = {
            info: 'info-circle',
            success: 'check-circle',
            warning: 'exclamation-triangle',
            error: 'times-circle'
        };
        return icons[type] || 'info-circle';
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            const unreadCount = this.notifications.filter(n => !n.read).length;
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    async markNotificationRead(notificationId) {
        try {
            await db.collection('notifications').doc(notificationId).update({
                read: true
            });
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
            }
            this.renderNotifications();
            this.updateNotificationBadge();
        } catch (error) {
            console.error('Error marking notification as read:', error);
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
            }
            this.renderNotifications();
            this.updateNotificationBadge();
        }
    }

    async markAllNotificationsRead() {
        if (!window.db) {
            this.showNotification('Firebase not initialized', 'error');
            return;
        }

        try {
            const unreadNotifications = this.notifications.filter(n => !n.read);
            if (unreadNotifications.length === 0) {
                this.showNotification('All notifications are already read', 'info');
                return;
            }

            const batch = db.batch();

            unreadNotifications.forEach(notif => {
                const ref = db.collection('notifications').doc(notif.id);
                batch.update(ref, {
                    read: true
                });
                notif.read = true;
            });

            await batch.commit();
            this.renderNotifications();
            this.updateNotificationBadge();
            this.showNotification('All notifications marked as read', 'success');
        } catch (error) {
            console.error('Error marking all as read:', error);
            this.showNotification('Error marking notifications as read: ' + error.message, 'error');
        }
    }

    async clearAllNotifications() {
        if (!window.db) {
            this.showNotification('Firebase not initialized', 'error');
            return;
        }

        const confirmed = await this.showConfirm(
            'Clear All Notifications',
            'Are you sure you want to delete all notifications? This action cannot be undone.',
            'warning'
        );

        if (!confirmed) {
            return;
        }

        try {
            if (this.notifications.length === 0) {
                this.showNotification('No notifications to clear', 'info');
                return;
            }

            const batch = db.batch();

            this.notifications.forEach(notif => {
                const ref = db.collection('notifications').doc(notif.id);
                batch.delete(ref);
            });

            await batch.commit();
            this.notifications = [];
            this.renderNotifications();
            this.updateNotificationBadge();
            this.showNotification('All notifications cleared successfully', 'success');
        } catch (error) {
            console.error('Error clearing notifications:', error);
            this.showNotification('Error clearing notifications: ' + error.message, 'error');
        }
    }

    async deleteNotification(notificationId) {
        if (!window.db) {
            this.showNotification('Firebase not initialized', 'error');
            return;
        }

        const confirmed = await this.showConfirm(
            'Delete Notification',
            'Are you sure you want to delete this notification?',
            'warning'
        );

        if (!confirmed) {
            return;
        }

        try {
            await db.collection('notifications').doc(notificationId).delete();

            // Remove from local array
            this.notifications = this.notifications.filter(n => n.id !== notificationId);

            this.renderNotifications();
            this.updateNotificationBadge();
            this.showNotification('Notification deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting notification:', error);
            this.showNotification('Error deleting notification: ' + error.message, 'error');
        }
    }

    async addNotification(type, title, message) {
        try {
            const notification = {
                type: type || 'info',
                title,
                message,
                read: false,
                timestamp: firebase.firestore.Timestamp.now()
            };

            await db.collection('notifications').add(notification);
            await this.loadNotifications();
        } catch (error) {
            console.error('Error adding notification:', error);
        }
    }

    // Profile Dropdown
    toggleProfile(e) {
        e.stopPropagation();
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) {
            if (dropdown.classList.contains('active')) {
                this.closeProfileDropdown();
            } else {
                this.closeNotificationDropdown();
                dropdown.classList.add('active');
                this.loadProfileData();
            }
        }
    }

    closeProfileDropdown() {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    }

    async loadProfileData() {
        const nameEl = document.getElementById('profileName');
        const emailEl = document.getElementById('profileEmail');

        // First, get the current authenticated user from Firebase Auth
        let currentUser = null;
        if (window.auth) {
            currentUser = window.auth.currentUser;

            // If no current user, wait for auth state to be determined
            if (!currentUser) {
                return new Promise((resolve) => {
                    const unsubscribe = window.auth.onAuthStateChanged((user) => {
                        unsubscribe(); // Unsubscribe after first check
                        if (user) {
                            // User is authenticated, use their email
                            if (emailEl) {
                                emailEl.textContent = user.email || 'admin@otomono.com';
                            }
                            if (nameEl) {
                                // Try to get display name from Auth, or use email prefix
                                const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Admin User');
                                nameEl.textContent = displayName;
                            }
                            resolve();
                        } else {
                            // Not authenticated, but we shouldn't reach here if checkAuth worked
                            if (emailEl) emailEl.textContent = 'Not logged in';
                            if (nameEl) nameEl.textContent = 'Guest';
                            resolve();
                        }
                    });
                });
            }
        }

        // If we have a current user, use their email from Auth
        if (currentUser) {
            if (emailEl) {
                emailEl.textContent = currentUser.email || 'admin@otomono.com';
            }
            if (nameEl) {
                // Try to get name from Firestore settings, or use Auth display name, or email prefix
                if (window.db) {
                    try {
                        const settingsDoc = await db.collection('settings').doc('profile').get();
                        if (settingsDoc.exists()) {
                            const data = settingsDoc.data();
                            if (data.fullName) {
                                nameEl.textContent = data.fullName;
                            } else {
                                // Fallback to Auth display name or email prefix
                                nameEl.textContent = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Admin User');
                            }
                        } else {
                            // No Firestore profile, use Auth data
                            nameEl.textContent = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Admin User');
                        }
                    } catch (error) {
                        console.error('Error loading profile name from Firestore:', error);
                        // Fallback to Auth data
                        nameEl.textContent = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Admin User');
                    }
                } else {
                    // No Firestore, use Auth data
                    nameEl.textContent = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Admin User');
                }
            }

            console.log('Profile dropdown updated from Auth:', {
                email: currentUser.email,
                displayName: currentUser.displayName
            });
        } else {
            // Fallback if no auth
            if (nameEl) nameEl.textContent = 'Admin User';
            if (emailEl) emailEl.textContent = 'admin@otomono.com';
        }
    }

    async logout() {
        const confirmed = await this.showConfirm(
            'Logout',
            'Are you sure you want to logout?',
            'warning'
        );

        if (confirmed) {
            try {
                // Sign out from Firebase
                if (window.auth) {
                    await window.auth.signOut();
                }

                this.showNotification('Logged out successfully', 'info');
                this.closeProfileDropdown();

                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 500);
            } catch (error) {
                console.error('Logout error:', error);
                this.showNotification('Error logging out: ' + error.message, 'error');
                this.closeProfileDropdown();
            }
        }
    }

    // Refresh Data
    async refreshData() {
        const refreshBtn = document.getElementById('refreshBtn');
        const icon = refreshBtn ? refreshBtn.querySelector('i') : null;

        if (refreshBtn && icon) {
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;

            try {
                await this.loadData();
                this.showNotification('Data refreshed successfully', 'success');

                // Refresh notifications badge if needed
                if (this.notifications.length > 0) {
                    await this.loadNotifications();
                }
            } catch (error) {
                console.error('Error refreshing data:', error);
                this.showNotification('Error refreshing data', 'error');
            } finally {
                setTimeout(() => {
                    if (refreshBtn) {
                        refreshBtn.classList.remove('loading');
                        refreshBtn.disabled = false;
                    }
                }, 500);
            }
        }
    }

    onPageChange(page) {
        // Wait a bit for DOM to be ready
        setTimeout(() => {
            if (page === 'suppliers') {
                this.renderSuppliers();
                this.updateKPIs();
            } else if (page === 'analytics') {
                this.updateCharts();
                // Recalculate KPIs with latest data
                this.updateKPIs();
            } else if (page === 'reports') {
                this.loadRecentReports();
            } else if (page === 'design-studio') {
                // Design Studio opens externally - no action needed
                return;
            } else if (page === 'settings') {
                this.loadSettingsData();
            } else if (page === 'orders') {
                // Ensure allOrders is initialized
                if (!this.allOrders) {
                    this.allOrders = [];
                }

                // Only reload if data is not already loaded
                if (this.allOrders.length === 0) {
                    // Check if loadData() is still running (initial load)
                    // Wait a bit and check again before loading
                    setTimeout(async () => {
                        if (!this.allOrders || this.allOrders.length === 0) {
                            await this.loadOrdersData();
                        } else {
                            this.renderOrders();
                        }
                    }, 150);
                } else {
                    // Just ensure table is rendered with existing data
                    this.renderOrders();
                }
            } else if (page === 'customers') {
                // Reload customers data
                this.loadCustomersData();
            } else if (page === 'materials') {
                // Reload materials data
                this.loadMaterialsData();
            }
        }, 100);
    }

    async loadOrdersData() {
        if (!window.db) return;
        try {
            // Ensure allOrders is initialized
            if (!this.allOrders) {
                this.allOrders = [];
            }

            // Preserve current orders to prevent table from disappearing
            const currentOrders = [...this.allOrders];

            const ordersSnapshot = await db.collection('orders').orderBy('date', 'desc').get();
            this.allOrders = ordersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Only render if we have a tbody element
            const tbody = document.getElementById('ordersTable');
            if (tbody) {
                this.renderOrders();
            } else {
                // If tbody doesn't exist yet, store data for later rendering
                console.log('Orders table tbody not found, data loaded but not rendered yet');
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            // If error occurred, try to restore previous data
            if (currentOrders && currentOrders.length > 0) {
                this.allOrders = currentOrders;
                this.renderOrders();
            }
        }
    }

    async loadCustomersData() {
        if (!window.db) return;
        try {
            const customersSnapshot = await db.collection('customers').get();
            this.customers = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.renderCustomers();
            this.updateKPIs();
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    }

    async loadMaterialsData() {
        if (!window.db) return;
        try {
            const materialsSnapshot = await db.collection('materials').get();
            this.materials = materialsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.renderMaterials();
            this.updateKPIs();
        } catch (error) {
            console.error('Error loading materials:', error);
        }
    }

    async loadSuppliersData() {
        if (!window.db) return;
        try {
            const suppliersSnapshot = await db.collection('suppliers').get();
            this.suppliers = suppliersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.renderSuppliers();
            this.updateKPIs();
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
    }

    async loadSettingsData() {
        if (!window.db) return;
        try {
            const fullNameEl = document.getElementById('fullName');
            const emailEl = document.getElementById('userEmail');
            const phoneEl = document.getElementById('userPhone');

            // Get authenticated user email from Firebase Auth (primary source)
            let authEmail = '';
            if (window.auth && window.auth.currentUser) {
                authEmail = window.auth.currentUser.email || '';
            }

            // Try to load from Firestore settings
            const settingsDoc = await db.collection('settings').doc('profile').get();
            if (settingsDoc.exists()) {
                const data = settingsDoc.data();
                if (fullNameEl) fullNameEl.value = data.fullName || '';
                // Use Firebase Auth email if available, otherwise use saved email
                if (emailEl) emailEl.value = authEmail || data.email || '';
                if (phoneEl) phoneEl.value = data.phone || '';
            } else {
                // If no profile data exists, use Firebase Auth email and defaults
                if (fullNameEl) {
                    // Try to get name from Auth displayName or email prefix
                    if (window.auth && window.auth.currentUser) {
                        const displayName = window.auth.currentUser.displayName ||
                            (window.auth.currentUser.email ? window.auth.currentUser.email.split('@')[0] : '');
                        fullNameEl.value = displayName || 'Admin User';
                    } else {
                        fullNameEl.value = 'Admin User';
                    }
                }
                if (emailEl) emailEl.value = authEmail || 'admin@otomono.com';
                if (phoneEl) phoneEl.value = '';
            }

            // Also update profile dropdown when settings page loads
            await this.loadProfileData();
        } catch (error) {
            console.error('Error loading settings data:', error);
        }
    }
}

// Initialize app when DOM is ready
let app;

async function checkAuth() {
    // Wait for Firebase Auth to be initialized
    const maxWait = 10000;
    const startTime = Date.now();

    while (!window.auth && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!window.auth) {
        console.warn('Firebase Auth not available, redirecting to login');
        window.location.href = 'login.html';
        return false;
    }

    return new Promise((resolve) => {
        // Check current user first (synchronous check)
        const currentUser = window.auth.currentUser;

        if (currentUser) {
            // User is authenticated
            console.log('✓ User authenticated:', currentUser.email);

            // Also set up auth state listener for changes (e.g., logout in another tab)
            window.auth.onAuthStateChanged((user) => {
                if (!user) {
                    // User logged out, redirect to login
                    console.log('✗ User logged out, redirecting to login');
                    window.location.href = 'login.html';
                }
            });

            resolve(true);
            return;
        }

        // No current user, wait for auth state to be determined
        const unsubscribe = window.auth.onAuthStateChanged((user) => {
            unsubscribe(); // Unsubscribe after first check
            if (user) {
                // User is authenticated
                console.log('✓ User authenticated:', user.email);
                resolve(true);
            } else {
                // User is not authenticated, redirect to login
                console.log('✗ User not authenticated, redirecting to login');
                window.location.href = 'login.html';
                resolve(false);
            }
        });

        // Timeout fallback - if auth state doesn't change within 3 seconds, redirect
        setTimeout(() => {
            if (!window.auth.currentUser) {
                console.log('✗ Auth state check timeout, redirecting to login');
                unsubscribe();
                window.location.href = 'login.html';
                resolve(false);
            }
        }, 3000);
    });
}

function initializeApp() {
    // Ensure DOM is ready and router is initialized
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
        return;
    }

    // Check authentication before initializing app
    checkAuth().then((isAuthenticated) => {
        if (!isAuthenticated) {
            return; // Redirected to login page
        }

        // Wait for router to be initialized
        if (!window.router) {
            setTimeout(initializeApp, 50);
            return;
        }

        try {
            app = new App();
            window.app = app;
            console.log('✓ App initialized successfully');
            console.log('✓ All event listeners attached');
        } catch (error) {
            console.error('✗ Error initializing app:', error);
        }
    }).catch((error) => {
        console.error('✗ Authentication check failed:', error);
        window.location.href = 'login.html';
    });
}

// Start initialization
initializeApp();