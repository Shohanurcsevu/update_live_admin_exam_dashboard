<?php
// Gemini API Configuration
define('GEMINI_API_KEY', '[GCP_API_KEY]');
define('GEMINI_MODEL', 'gemini-2.0-flash');
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/' . GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY);
?>
