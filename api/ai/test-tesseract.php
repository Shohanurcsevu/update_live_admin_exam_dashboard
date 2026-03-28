<?php
/**
 * Tesseract OCR Test Script
 * Saves extracted text to 'tmp/ocr_test_results.txt' for verification.
 */

// 1. Configuration
$tesseractPath = '"C:\Program Files\Tesseract-OCR\tesseract.exe"';
$tempDir = __DIR__ . '/../../tmp';
$outputFile = $tempDir . '/ocr_test_results.txt';

// Check if an image is provided via GET, otherwise look for last OCR task in tmp
$imageToTest = isset($_GET['image']) ? $_GET['image'] : '';

if (!$imageToTest) {
    // Fallback: Find the most recent image in tmp/
    $files = glob($tempDir . '/ocr_task_*.png');
    if ($files) {
        usort($files, function($a, $b) {
            return filemtime($b) - filemtime($a);
        });
        $imageToTest = $files[0];
    }
}

echo "--- Tesseract Diagnostic Test ---\n";

if (!file_exists($imageToTest)) {
    echo "Error: No test image found. Please upload an image via the AI Scan first or provide a path via ?image=path/to/img.png\n";
    exit;
}

echo "Testing image: " . realpath($imageToTest) . "\n";

// 2. Run Tesseract
$cmd = "$tesseractPath \"$imageToTest\" stdout -l eng+ben 2>&1";
echo "Command: $cmd\n";

$output = shell_exec($cmd);

if ($output === null) {
    echo "Error: Tesseract failed to execute.\n";
    exit;
}

// 3. Save to TXT
if (file_put_contents($outputFile, $output) !== false) {
    echo "Success! Extracted text saved to: " . realpath($outputFile) . "\n";
    echo "--- Preview (First 500 chars) ---\n";
    echo substr($output, 0, 500) . (strlen($output) > 500 ? "..." : "") . "\n";
} else {
    echo "Error: Failed to write to output file.\n";
}
?>
