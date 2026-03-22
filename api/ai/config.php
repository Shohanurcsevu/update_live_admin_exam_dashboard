<?php
// Gemini API Configuration
define('GEMINI_API_KEY', 'AIzaSyBzmhM9iyq06HiRu_xpp0EtUYNdfJ5wbeU');
// Updated to the latest Gemini 3 Flash
define('GEMINI_MODEL', 'gemini-3-flash-preview');
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/' . GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY);
?>
