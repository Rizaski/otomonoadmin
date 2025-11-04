<?php
/**
 * Email Sending Script using PHPMailer
 * 
 * Setup Instructions:
 * 1. Install PHPMailer via Composer:
 *    composer require phpmailer/phpmailer
 * 
 * 2. Configure your Gmail credentials below:
 *    - $smtp_username: Your Gmail address
 *    - $smtp_password: Your Gmail App Password (not your regular password)
 *    - $admin_email: Where to receive form submissions (optional)
 * 
 * 3. To get Gmail App Password:
 *    - Go to Google Account > Security
 *    - Enable 2-Step Verification
 *    - Go to App Passwords
 *    - Generate password for "Mail"
 * 
 * 4. Make sure your server supports PHP mail() or SMTP
 */

// Suppress all output except JSON
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Set headers first
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Function to safely return JSON response
function sendJsonResponse($success, $message, $httpCode = 200) {
    // Clear any previous output
    if (ob_get_length()) {
        ob_clean();
    }
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => $success,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Only allow POST requests
if ($_SERVER["REQUEST_METHOD"] != "POST") {
    sendJsonResponse(false, 'Method not allowed', 405);
}

// Check if PHPMailer is available
$phpmailer_path = __DIR__ . '/vendor/autoload.php';
if (!file_exists($phpmailer_path)) {
    // Try alternative path
    $phpmailer_path = __DIR__ . '/../vendor/autoload.php';
}

if (!file_exists($phpmailer_path)) {
    sendJsonResponse(false, 'PHPMailer not installed. Run: composer require phpmailer/phpmailer', 500);
}

try {
    require $phpmailer_path;
} catch (Exception $e) {
    sendJsonResponse(false, 'Error loading PHPMailer: ' . $e->getMessage(), 500);
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ==========================================
// CONFIGURATION - EDIT THESE VALUES
// ==========================================
$smtp_host = 'smtp.gmail.com';
$smtp_port = 587;
$smtp_username = 'otomono.orders@gmail.com'; // Your Gmail address
$smtp_password = 'twxh arxj dcdr zpxr'; // Your Gmail App Password
$smtp_from_name = 'Otomono Admin Panel';
$admin_email = 'otomono.orders@gmail.com'; // Optional: Where to receive notifications

// ==========================================
// VALIDATE INPUT
// ==========================================
$name = isset($_POST['name']) ? trim($_POST['name']) : '';
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$to = isset($_POST['to']) ? trim($_POST['to']) : '';
$subject = isset($_POST['subject']) ? trim($_POST['subject']) : '';
$message = isset($_POST['message']) ? trim($_POST['message']) : '';

// Validate required fields
if (empty($name) || empty($email) || empty($to) || empty($subject) || empty($message)) {
    sendJsonResponse(false, 'All fields are required', 400);
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    sendJsonResponse(false, 'Invalid email address', 400);
}

// ==========================================
// SEND EMAIL
// ==========================================
$mail = new PHPMailer(true);

try {
    // Server settings
    $mail->isSMTP();
    $mail->Host = $smtp_host;
    $mail->SMTPAuth = true;
    $mail->Username = $smtp_username;
    $mail->Password = $smtp_password;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = $smtp_port;
    $mail->CharSet = 'UTF-8';

    // Enable verbose debug output (set to 0 for production)
    // $mail->SMTPDebug = 2;
    
    // Recipients
    $mail->setFrom($smtp_username, $smtp_from_name);
    $mail->addAddress($to); // Supplier email
    $mail->addReplyTo($email, $name); // Reply to sender
    
    // Optional: Send copy to admin
    if (!empty($admin_email) && filter_var($admin_email, FILTER_VALIDATE_EMAIL)) {
        $mail->addCC($admin_email);
    }

    // Content
    $mail->isHTML(true);
    $mail->Subject = $subject;
    
    // Convert plain text to HTML
    $htmlMessage = nl2br(htmlspecialchars($message));
    $mail->Body = "
        <html>
        <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
            <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                <h2 style='color: #FF003C;'>$subject</h2>
                <p><strong>From:</strong> $name &lt;$email&gt;</p>
                <hr style='border: 1px solid #ddd; margin: 20px 0;'>
                <div style='background: #f5f5f5; padding: 15px; border-radius: 5px;'>
                    $htmlMessage
                </div>
                <hr style='border: 1px solid #ddd; margin: 20px 0;'>
                <p style='font-size: 12px; color: #666;'>
                    This email was sent from Otomono Admin Panel
                </p>
            </div>
        </body>
        </html>
    ";
    
    // Plain text version
    $mail->AltBody = $message;

    $mail->send();
    
    sendJsonResponse(true, 'Email sent successfully to ' . $to, 200);
    
} catch (Exception $e) {
    $errorMsg = 'Email sending failed';
    if (isset($mail) && !empty($mail->ErrorInfo)) {
        $errorMsg .= ': ' . $mail->ErrorInfo;
    } else {
        $errorMsg .= ': ' . $e->getMessage();
    }
    sendJsonResponse(false, $errorMsg, 500);
} catch (Error $e) {
    sendJsonResponse(false, 'PHP Error: ' . $e->getMessage(), 500);
}