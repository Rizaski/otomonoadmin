<?php
/**
 * Simple PHP Test Script
 * Access this file directly in your browser to verify PHP is working
 * Example: http://localhost/otomonoadmin/test-php.php
 */

header('Content-Type: application/json; charset=utf-8');

$response = [
    'success' => true,
    'message' => 'PHP is working correctly!',
    'php_version' => phpversion(),
    'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    'method' => $_SERVER['REQUEST_METHOD'] ?? 'Unknown',
    'timestamp' => date('Y-m-d H:i:s')
];

echo json_encode($response, JSON_PRETTY_PRINT);
?>

