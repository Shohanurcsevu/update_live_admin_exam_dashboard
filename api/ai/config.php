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

// Rate Limits per model (RPM: Requests Per Minute, TPM: Tokens Per Minute, RPD: Requests Per Day)
$MODEL_LIMITS = [
    'gemini-2.5-flash' => ['rpm' => 5, 'tpm' => 250000, 'rpd' => 20],
    'gemini-2.5-pro'   => ['rpm' => 2, 'tpm' => 32000,  'rpd' => 50], // Estimating Pro limits if not provided
    'gemini-2.0-flash' => ['rpm' => 10, 'tpm' => 4000000, 'rpd' => 1500],
    'gemini-3.1-flash-lite-preview' => ['rpm' => 15, 'tpm' => 250000, 'rpd' => 500],
    'gemini-3.1-pro-preview' => ['rpm' => 2, 'tpm' => 32000, 'rpd' => 50],
    'gemini-3-flash-preview' => ['rpm' => 5, 'tpm' => 250000, 'rpd' => 20],
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

