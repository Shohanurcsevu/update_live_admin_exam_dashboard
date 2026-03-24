<?php
// Gemini API Configuration
define('GEMINI_API_KEY', 'AIzaSyBzmhM9iyq06HiRu_xpp0EtUYNdfJ5wbeU');
// Using standard alias 'gemini-flash-latest' (found via ListModels)
define('GEMINI_MODEL', 'gemini-flash-latest');
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/' . GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY);
?>
