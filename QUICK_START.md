# Quick Start Guide - PHP Email Setup

## If you're seeing "Server configuration issue" error:

This means PHP is not running or not accessible. Follow these steps:

## Step 1: Start a PHP Server

You have several options:

### Option A: PHP Built-in Server (Easiest - No Installation Needed)
If you have PHP installed:

1. Open Command Prompt or PowerShell
2. Navigate to your project folder:
   ```bash
   cd C:\Users\USER\Downloads\Otomono_AdminPanel\otomonoadmin
   ```
3. Start PHP server:
   ```bash
   php -S localhost:8000
   ```
4. Open browser: `http://localhost:8000`

### Option B: XAMPP (Recommended for Windows)
1. Download XAMPP from https://www.apachefriends.org/
2. Install and start Apache
3. Copy project to `C:\xampp\htdocs\otomonoadmin`
4. Open: `http://localhost/otomonoadmin`

### Option C: WAMP
1. Download WAMP from https://www.wampserver.com/
2. Install and start all services
3. Copy project to `C:\wamp64\www\otomonoadmin`
4. Open: `http://localhost/otomonoadmin`

## Step 2: Test PHP is Working

Open in browser:
```
http://localhost:8000/test-php.php
```
(Replace 8000 with your port if using XAMPP/WAMP)

You should see JSON output. If you see source code or errors, PHP is not working.

## Step 3: Install PHPMailer

In your project folder, run:
```bash
composer require phpmailer/phpmailer
```

If you don't have Composer:
1. Download from https://getcomposer.org/download/
2. Install it
3. Run the command above

## Step 4: Configure sendmail.php

Open `sendmail.php` and update:
- `$smtp_username` - Your Gmail address
- `$smtp_password` - Your Gmail App Password

## Step 5: Test Email Sending

1. Make sure you're accessing via `http://localhost` (NOT `file://`)
2. Go to Suppliers page
3. Click "Send Email"
4. Fill in the form and send

## Common Issues:

### "File not found" or "404"
- Make sure `sendmail.php` is in the same folder as `index.html`
- Check the URL path in browser console (Network tab)

### "PHP is not executing"
- Make sure you're using `http://localhost` not `file://`
- Check if PHP server is running
- Verify PHP is installed

### "PHPMailer not installed"
- Run: `composer require phpmailer/phpmailer`
- Check if `vendor/autoload.php` exists

### "Connection timeout" or "SMTP error"
- Check your Gmail App Password is correct
- Verify internet connection
- Check firewall isn't blocking port 587

## Still Having Issues?

1. Check browser console (F12) for detailed error messages
2. Check PHP error logs (location depends on your setup)
3. See `TROUBLESHOOTING.md` for more help
4. Test with `test-php.php` first to verify PHP is working

