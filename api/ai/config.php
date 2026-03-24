<?php
// Gemini API Configuration
define('GEMINI_API_KEY', 'AIzaSyBzmhM9iyq06HiRu_xpp0EtUYNdfJ5wbeU');
// Updated to Gemini 2.5 Flash based on diagnostic list (gemini-1.5-flash was missing)
define('GEMINI_MODEL', 'gemini-2.5-flash');
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/' . GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY);
?>
