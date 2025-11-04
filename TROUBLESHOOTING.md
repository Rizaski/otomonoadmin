# Email Functionality Troubleshooting Guide

## Quick Test Steps

### Step 1: Test if PHP is Working
1. Open your browser and navigate to:
   ```
   http://localhost/otomonoadmin/test-php.php
   ```
   (Replace `localhost` with your server address if different)

2. Expected result: You should see JSON output like:
   ```json
   {
       "success": true,
       "message": "PHP is working correctly!",
       "php_version": "7.4.x",
       ...
   }
   ```

3. If you see:
   - **404 Not Found**: The file path is wrong or file doesn't exist
   - **HTML error page**: PHP is not installed or not configured
   - **Source code displayed**: PHP is not executing (server treating .php as text)

### Step 2: Test sendmail.php Directly
1. Try accessing `sendmail.php` directly:
   ```
   http://localhost/otomonoadmin/sendmail.php
   ```

2. Expected result: JSON error message:
   ```json
   {
       "success": false,
       "message": "Method not allowed"
   }
   ```
   This is correct! It means PHP is executing the file.

3. If you see:
   - **404**: File doesn't exist or wrong path
   - **HTML/PHP source code**: PHP is not executing
   - **Different error**: Check the error message

## Common Issues and Solutions

### Issue 1: "Unexpected token '<'" or "Server returned an error"
**Cause**: Server is returning HTML instead of JSON

**Solutions**:
1. **PHP not installed**:
   - Install PHP on your server
   - For XAMPP/WAMP: PHP should come pre-installed
   - For production: Contact your hosting provider

2. **PHP not executing**:
   - Check if Apache/IIS is configured to handle .php files
   - Verify PHP module is enabled
   - Restart your web server

3. **Wrong file path**:
   - Ensure `sendmail.php` is in the project root directory
   - Check the fetch URL in browser console (Network tab)
   - Verify the path matches your server structure

4. **File permissions**:
   - Ensure PHP has read permissions for `sendmail.php`
   - Check file ownership

### Issue 2: "PHPMailer not installed"
**Solution**:
```bash
# Navigate to project root directory
cd /path/to/otomonoadmin

# Install PHPMailer
composer require phpmailer/phpmailer

# Verify installation
ls vendor/phpmailer/phpmailer
```

### Issue 3: "Cannot connect to server"
**Solutions**:
1. **Check if server is running**:
   - XAMPP: Start Apache service
   - WAMP: Start all services
   - MAMP: Start servers

2. **Check URL**:
   - Verify the URL in browser matches your server
   - Check if you're using `http://` vs `https://`
   - Ensure port number is correct (e.g., `:8080`)

3. **CORS issues**:
   - If accessing from `file://` protocol, use a local server
   - Ensure both files are on the same domain

### Issue 4: "SMTP authentication failed"
**Solutions**:
1. **Verify Gmail credentials** in `sendmail.php`:
   ```php
   $smtp_username = 'your_email@gmail.com';
   $smtp_password = 'your_app_password'; // NOT your regular password
   ```

2. **App Password setup**:
   - Go to Google Account > Security
   - Enable 2-Step Verification
   - Generate App Password for "Mail"
   - Use the 16-character password (spaces don't matter)

3. **Check Gmail settings**:
   - Ensure "Less secure app access" is not blocking (if applicable)
   - Verify 2-Step Verification is enabled

### Issue 5: "Connection timeout"
**Solutions**:
1. **Firewall blocking SMTP**:
   - Check if port 587 is blocked
   - Try port 465 with SSL:
     ```php
     $smtp_port = 465;
     $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
     ```

2. **Network issues**:
   - Check internet connection
   - Verify `smtp.gmail.com` is accessible
   - Some hosting providers block SMTP ports

## Debugging Steps

### 1. Check Browser Console
1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Try sending an email
4. Click on `sendmail.php` request
5. Check:
   - **Status**: Should be 200 (not 404, 500, etc.)
   - **Response**: Should be JSON (not HTML)
   - **Headers**: Content-Type should be `application/json`

### 2. Check PHP Error Logs
Location depends on your setup:
- **XAMPP**: `C:\xampp\php\logs\php_error_log`
- **WAMP**: `C:\wamp64\logs\php_error.log`
- **Linux**: `/var/log/apache2/error.log` or `/var/log/php/error.log`

Look for:
- PHP syntax errors
- Missing file errors
- Permission errors

### 3. Enable PHP Error Display (Development Only)
Add to `sendmail.php` (temporarily):
```php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
```

**⚠️ Remove this in production!**

### 4. Test PHP from Command Line
```bash
php -r "echo 'PHP is working!';"
php sendmail.php
```

## Server-Specific Setup

### XAMPP (Windows)
1. Start Apache from XAMPP Control Panel
2. Place project in `C:\xampp\htdocs\otomonoadmin`
3. Access via: `http://localhost/otomonoadmin`
4. Install Composer: Download from https://getcomposer.org

### WAMP (Windows)
1. Start all services from WAMP menu
2. Place project in `C:\wamp64\www\otomonoadmin`
3. Access via: `http://localhost/otomonoadmin`

### MAMP (Mac)
1. Start servers from MAMP
2. Place project in `/Applications/MAMP/htdocs/otomonoadmin`
3. Access via: `http://localhost:8888/otomonoadmin`

### Production Server
1. Upload files via FTP/SFTP
2. SSH into server
3. Run `composer install` in project directory
4. Ensure PHP version is 7.0+
5. Check server error logs

## Still Having Issues?

1. **Check the exact error message** in browser console
2. **Verify PHP is working** with `test-php.php`
3. **Check server logs** for detailed errors
4. **Test with a simple PHP file** first:
   ```php
   <?php echo json_encode(['test' => 'success']); ?>
   ```

If all else fails, the issue is likely:
- PHP not installed/configured
- Web server not configured to execute PHP
- File path incorrect
- Permissions issue

