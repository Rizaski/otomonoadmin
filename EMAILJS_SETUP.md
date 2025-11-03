# EmailJS Setup Instructions

## Overview
The admin panel now includes functionality to send order confirmation emails to customers. This feature uses EmailJS, which doesn't require an email password - only API keys.

## Setup Steps

### 1. Create EmailJS Account
1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Sign up for a free account (200 emails/month free tier)
3. Verify your email address

### 2. Add Email Service
1. In EmailJS dashboard, go to **Email Services**
2. Click **Add New Service**
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the connection steps
5. Note your **Service ID** (e.g., `service_xxxxx`)

### 3. Create Email Template
1. Go to **Email Templates**
2. Click **Create New Template**
3. Use this template structure:

**Template Name:** Order Confirmation

**Subject:** Order Confirmation - Order #{{order_id}}

**Content:**
```
Dear {{to_name}},

Thank you for your order with Otomono Jersey!

Order Details:
- Order ID: {{order_id}}
- Order Date: {{order_date}}
- Status: {{order_status}}
- Material: {{material}}
- Quantity: {{quantity}}

{{#if customer_link}}
You can view and manage your order details here: {{customer_link}}
{{/if}}

Best regards,
Otomono Jersey Team
```

4. Note your **Template ID** (e.g., `template_xxxxx`)

### 4. Get Your Public Key
1. Go to **Account** > **General**
2. Copy your **Public Key** (e.g., `xxxxxxxxxxxxxxx`)

### 5. Configure in Your Application

Add the EmailJS script and configuration to `index.html` (before `app.js`):

```html
<!-- EmailJS SDK -->
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

<!-- EmailJS Configuration -->
<script>
    // EmailJS Configuration
    window.EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY_HERE';
    window.EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID_HERE';
    window.EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID_HERE';
</script>
```

Replace:
- `YOUR_PUBLIC_KEY_HERE` with your EmailJS Public Key
- `YOUR_SERVICE_ID_HERE` with your Service ID
- `YOUR_TEMPLATE_ID_HERE` with your Template ID

### 6. Test the Feature
1. Go to the Customers page in your admin panel
2. Find a customer with an email address
3. Click the "Send Confirmation" button
4. Check the customer's email inbox

## Template Variables Available

The following variables are available in your email template:
- `{{to_email}}` - Customer's email address
- `{{to_name}}` - Customer's name
- `{{order_id}}` - Order ID
- `{{order_date}}` - Formatted order date
- `{{customer_name}}` - Customer name (same as to_name)
- `{{order_status}}` - Order status (pending, draft, submitted, completed)
- `{{material}}` - Material/product name
- `{{quantity}}` - Order quantity
- `{{customer_link}}` - Link to customer order details page (if available)

## Alternative: Use Other Email Services

If you prefer other services:

### SendGrid
- Free tier: 100 emails/day
- Uses API keys (similar setup)
- Requires backend implementation or Cloud Functions

### Mailgun
- Free tier: 5,000 emails/month
- Uses API keys
- Requires backend implementation

### AWS SES
- Very cheap (after free tier)
- Uses AWS credentials
- Requires backend/Cloud Functions

## Security Note

EmailJS Public Keys are safe to use in client-side code as they have usage limits and can be restricted. However, for production use with high volume, consider:
1. Moving email sending to Firebase Cloud Functions
2. Using environment variables for sensitive configuration
3. Implementing rate limiting

## Troubleshooting

**Email not sending?**
1. Check browser console for errors
2. Verify EmailJS configuration is correct
3. Check EmailJS dashboard for sent emails and errors
4. Ensure customer has a valid email address

**Rate limit exceeded?**
- Free tier: 200 emails/month
- Upgrade plan if needed
- Consider implementing email queuing for high volume

