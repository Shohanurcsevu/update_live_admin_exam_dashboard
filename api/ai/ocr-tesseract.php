<?php
/**
 * Tesseract OCR API Endpoint
 * Performs local OCR on uploaded images using the Tesseract engine.
 */

// Basic error handling for API
error_reporting(E_ALL);
ini_set('display_errors', 0);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

// CLI detection for local testing
$is_cli = php_sapi_name() === 'cli';

if (!$is_cli && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Only POST requests are allowed.']);
    exit;
}

// Read input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['image'])) {
    echo json_encode(['success' => false, 'message' => 'No image data provided.']);
    exit;
}

try {
    // 1. Process Image Data
    $imageData = $input['image'];
    
    // Handle base64 prefix (e.g., data:image/png;base64,...)
    if (strpos($imageData, ',') !== false) {
        $imageData = explode(',', $imageData)[1];
    }
    
    $decodedImage = base64_decode($imageData);
    if (!$decodedImage) {
        throw new Exception("Failed to decode base64 image.");
    }

    // 2. Create Temporary File
    $tempDir = __DIR__ . '/../../tmp';
    if (!is_dir($tempDir)) {
        if (!mkdir($tempDir, 0777, true)) {
            throw new Exception("Failed to create temporary directory.");
        }
    }
    
    $tempFile = $tempDir . '/ocr_task_' . uniqid() . '.png';
    if (file_put_contents($tempFile, $decodedImage) === false) {
        throw new Exception("Failed to write image to temporary file.");
    }

    // 3. Configure Tesseract
    // Note: On Windows, paths with spaces must be quoted correctly for shell_exec
    $tesseractPath = '"C:\Program Files\Tesseract-OCR\tesseract.exe"';
    $lang = isset($input['lang']) ? $input['lang'] : 'eng+ben';
    
    // 4. Execute OCR
    // Syntax: tesseract [image] stdout -l [lang]
    // Redirecting stderr (2>&1) to capture meaningful error messages
    $cmd = "$tesseractPath \"$tempFile\" stdout -l $lang 2>&1";
    
    $output = shell_exec($cmd);
    
    // 5. Cleanup
    if (file_exists($tempFile)) {
        unlink($tempFile);
    }

    if ($output === null) {
        throw new Exception("Tesseract execution failed or returned no output.");
    }

    // Check if output is an error message (Tesseract often outputs errors to stderr)
    if (strpos($output, 'Error') !== false || strpos($output, 'not recognized') !== false) {
        throw new Exception("Tesseract Error: " . trim($output));
    }

    // 6. Return Success
    echo json_encode([
        'success' => true,
        'text' => trim($output),
        'method' => 'Tesseract (Local)',
        'lang' => $lang
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
