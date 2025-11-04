# PHP Email Setup Instructions

## Overview
This application uses PHP with PHPMailer to send emails to suppliers. The email functionality requires a PHP server with PHPMailer installed.

## Prerequisites

1. **PHP Server**: You need a web server with PHP installed (PHP 7.0 or higher)
2. **Composer**: Required to install PHPMailer
3. **Gmail Account**: With App Password enabled

## Setup Steps

### 1. Install Composer (if not already installed)

Download and install Composer from: https://getcomposer.org/download/

### 2. Install PHPMailer

Navigate to your project root directory and run:

```bash
composer require phpmailer/phpmailer
```

This will create a `vendor` folder with PHPMailer dependencies.

### 3. Configure Gmail App Password

1. Go to your [Google Account](https://myaccount.google.com/)
2. Navigate to **Security** section
3. Under "2-Step Verification", ensure 2-Step Verification is enabled
4. Scroll down to "App passwords"
5. Click **App passwords**
6. Select app: **Mail**
7. Select device: **Other (Custom name)**
8. Enter name: "Otomono Admin Panel"
9. Click **Generate**
10. Copy the 16-character app password (you'll only see it once)

### 4. Configure sendmail.php

Open `sendmail.php` and update these values:

```php
$smtp_username = 'otomono.orders@gmail.com'; // Your Gmail address
$smtp_password = 'twxh arxj dcdr zpxr'; // The 16-character app password
$smtp_from_name = 'Otomono Admin Panel'; // Sender name
$admin_email = 'otomono.orders@gmail.com'; // Optional: Where to receive copies
```

### 5. Test the Setup

1. Make sure your PHP server is running
2. Open the admin panel in your browser
3. Go to Suppliers page
4. Click "Send Email" on any supplier
5. Fill in the form and send a test email

## Server Configuration

### Local Development (XAMPP/WAMP/MAMP)

1. Copy your project to the `htdocs` (or `www`) folder
2. Run Composer install in the project directory
3. Start Apache server
4. Access via `http://localhost/otomonoadmin`

### Production Deployment

1. Upload all files to your web server
2. SSH into your server
3. Navigate to project directory
4. Run `composer install`
5. Update `sendmail.php` with production credentials
6. Ensure PHP has write permissions

## Troubleshooting

### Error: "PHPMailer not installed"
- Run `composer require phpmailer/phpmailer` in the project root
- Ensure `vendor/autoload.php` exists

### Error: "SMTP authentication failed"
- Verify your Gmail App Password is correct (not your regular password)
- Ensure 2-Step Verification is enabled
- Check that the Gmail address matches the one used to generate the app password

### Error: "Connection timeout"
- Check firewall settings
- Verify SMTP port 587 is not blocked
- Try using port 465 with `$smtp_port = 465` and `$mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;`

### Error: "Cannot connect to SMTP server"
- Check your internet connection
- Verify `smtp.gmail.com` is accessible
- Some hosting providers block SMTP ports - contact your hosting support

## Security Notes

1. **Never commit credentials to version control**
2. Use environment variables for sensitive data in production
3. Consider using a dedicated email service for production (SendGrid, Mailgun, etc.)
4. Enable HTTPS on your server for secure form submission

## Alternative: Environment Variables

For better security, you can use environment variables instead of hardcoding credentials:

```php
$smtp_username = getenv('SMTP_USERNAME') ?: 'your_email@gmail.com';
$smtp_password = getenv('SMTP_PASSWORD') ?: 'your_app_password';
```

Then set these in your server's environment or `.env` file (if using a library like `vlucas/phpdotenv`).

