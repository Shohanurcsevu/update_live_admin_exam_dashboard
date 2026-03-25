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

// Allowed models for switching
$ALLOWED_MODELS = [
    'gemini-2.5-flash' => 'Gemini 2.5 Flash (Smarter)',
    'gemini-2.5-pro'   => 'Gemini 2.5 Pro (Powerhouse)',
    'gemini-2.0-flash' => 'Gemini 2.0 Flash (Balanced)',
    'gemini-3.1-flash-lite-preview' => 'Gemini 3.1 Flash Lite (Fastest)',
    'gemini-3.1-pro-preview' => 'Gemini 3.1 Pro (Experimental)',
    'gemini-3-flash-preview'  => 'Gemini 3 Flash (Next-Gen)',
];

if (!defined('GEMINI_MODEL')) {
    define('GEMINI_MODEL', 'gemini-2.5-flash');
}

function get_gemini_api_url($model = GEMINI_MODEL) {
    global $ALLOWED_MODELS;
    
    // Fallback to default if model not allowed
    if (!isset($ALLOWED_MODELS[$model])) {
        $model = GEMINI_MODEL;
    }
    
    return 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . GEMINI_API_KEY;
}

define('GEMINI_API_URL', get_gemini_api_url());
?>

