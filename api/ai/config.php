<?php
// Gemini API Configuration

// Load local configuration if it exists
if (file_exists(__DIR__ . '/config.local.php')) {
    include_once __DIR__ . '/config.local.php';
}

// Ensure GEMINI_API_KEY is defined (even if empty) to avoid constant errors
if (!defined('GEMINI_API_KEY')) {
    define('GEMINI_API_KEY', '');
}

// Using standard alias 'gemini-flash-latest' (found via ListModels)
define('GEMINI_MODEL', 'gemini-flash-latest');
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/' . GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY);
?>

