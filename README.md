# Otomono Jersey - Admin Panel

A modern, fully responsive admin panel for managing jersey business operations. Built with pure HTML, CSS, and JavaScript with Firebase backend integration.

## Features

### Front-end Pages
- **Dashboard** - Overview with KPI cards, recent orders, and quick actions
- **Orders Management** - Search, filter, and manage customer orders
- **Customers Management** - Track customer information and activity
- **Materials Management** - Inventory management for jersey materials
- **Design Studio** - Create and manage jersey designs with canvas editor
- **Analytics** - Business insights and performance metrics with charts
- **Reports** - Generate and download business reports
- **Settings** - Profile and security settings

### Key Features
- ✅ Fully responsive design (mobile, tablet, desktop)
- ✅ Dark theme inspired by ASUS ROG website
- ✅ Modern UI with gradient buttons and smooth animations
- ✅ Firebase Firestore integration for backend
- ✅ Real-time data updates
- ✅ CRUD operations for orders, customers, and materials
- ✅ Search and filter functionality
- ✅ Interactive charts and analytics
- ✅ Design studio with canvas editor
- ✅ Report generation

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Firebase Firestore
- **Styling**: Custom CSS with CSS Variables
- **Icons**: Font Awesome 6.4.0
- **No Frameworks**: Pure vanilla JavaScript, no React, Bootstrap, or other frameworks

## Project Structure

```
adminpanel/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All styling (ASUS ROG inspired)
├── js/
│   ├── firebase-config.js  # Firebase configuration
│   ├── routing.js          # Routing system
│   └── app.js             # Main application logic
└── README.md            # This file
```

## Setup Instructions

1. **Clone or download the project**

2. **Open the project folder**
   ```bash
   cd adminpanel
   ```

3. **Open `index.html` in a web browser**
   - You can use any modern web browser (Chrome, Firefox, Edge, Safari)
   - Or use a local development server like Live Server (VS Code extension)

4. **Firebase Configuration**
   - The Firebase configuration is already set up in `js/firebase-config.js`
   - Firebase will automatically create collections in Firestore as you use the app
   - Collections used:
     - `orders` - Customer orders
     - `customers` - Customer data
     - `materials` - Material inventory
     - `designs` - Saved jersey designs
     - `reports` - Generated reports
     - `settings` - User settings

## Usage

### Starting the Application

Simply open `index.html` in your web browser. No build process or installation required!

### Navigation

- Use the sidebar navigation to switch between different pages
- Click on any navigation item to view the corresponding page
- The active page is highlighted in red

### Dashboard

- View key performance indicators (KPIs)
- See recent orders
- Quick actions: "New Order" and "View Analytics"

### Orders Management

- Search orders by ID, customer, or product
- Filter by status and date range
- Add, edit, or delete orders
- View order details

### Customers Management

- View all customers
- Add new customers
- Edit customer information
- Delete customers
- Track customer statistics

### Materials Management

- Manage material inventory
- Track stock levels
- View material status (Available, Low Stock, Out of Stock)
- Add, edit, or delete materials

### Design Studio

- Create jersey designs using the canvas editor
- Upload logos/images
- Customize colors
- Save designs to Firebase

### Analytics

- View business metrics
- Interactive charts
- Track revenue, conversion rates, and customer satisfaction

### Reports

- Generate various report types (Sales, Customer, Inventory, Financial)
- Set date ranges
- Download reports
- View recent reports

### Settings

- Update profile information
- Change password
- Manage account preferences

## Firebase Collections Structure

### Orders
```javascript
{
  customer: string,
  mobile: string,
  material: string,
  amount: number,
  status: 'pending' | 'processing' | 'completed' | 'cancelled',
  date: Timestamp,
  product: string
}
```

### Customers
```javascript
{
  name: string,
  email: string,
  phone: string,
  status: 'active' | 'inactive',
  joined: Timestamp
}
```

### Materials
```javascript
{
  name: string,
  type: string,
  price: number,
  stock: number,
  status: 'available' | 'low-stock' | 'out-of-stock'
}
```

### Designs
```javascript
{
  name: string,
  image: string (base64),
  created: Timestamp
}
```

### Reports
```javascript
{
  type: 'sales' | 'customer' | 'inventory' | 'financial',
  dateFrom: string,
  dateTo: string,
  generated: string
}
```

## Design Features

- **Dark Theme**: Professional dark interface inspired by ASUS ROG website
- **Red Accents**: Vibrant red (#ff003c) for active states, icons, and buttons
- **Gradient Buttons**: Eye-catching red-to-blue gradients on primary buttons
- **Smooth Animations**: Hover effects and transitions throughout
- **Responsive Layout**: Adapts to all screen sizes
- **Modern Typography**: Clean, readable fonts
- **Icon System**: Font Awesome icons for visual clarity

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Mobile Optimization

The application is fully responsive and optimized for:
- Mobile devices (320px+)
- Tablets (768px+)
- Desktop (1024px+)
- Large screens (1920px+)

## Notes

- All data is stored in Firebase Firestore
- Collections are created automatically when data is added
- The app works offline with cached data (requires initial online connection)
- No authentication is implemented in this version (add as needed)

## Future Enhancements

- User authentication and authorization
- Real-time notifications
- Advanced chart libraries (Chart.js)
- Image upload to Firebase Storage
- Export reports to PDF/Excel
- Email notifications
- Multi-language support
- Dark/Light theme toggle

## License

This project is created for the Otomono Jersey business administration.

## Support

For issues or questions, please refer to the code comments or Firebase documentation.

