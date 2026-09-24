<?php
/**
 * api/written/upload_image.php
 * Image upload for written questions/sub-questions
 * POST with multipart/form-data, field: "image"
 */
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

$upload_dir = dirname(__DIR__, 2) . '/uploads/written/';
if (!is_dir($upload_dir)) {
    mkdir($upload_dir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success'=>false,'message'=>'POST required.']); exit;
}
if (empty($_FILES['image'])) {
    echo json_encode(['success'=>false,'message'=>'No file uploaded.']); exit;
}

$file   = $_FILES['image'];
$max_mb = 5;
$max_bytes = $max_mb * 1024 * 1024;

// Size check
if ($file['size'] > $max_bytes) {
    echo json_encode(['success'=>false,'message'=>"File too large. Max {$max_mb}MB."]); exit;
}

// Type check
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
$allowed_mimes = ['image/jpeg','image/png','image/gif','image/webp','image/svg+xml'];
if (!in_array($mime, $allowed_mimes)) {
    echo json_encode(['success'=>false,'message'=>'Invalid file type. Allowed: JPG, PNG, GIF, WebP, SVG.']); exit;
}

// Safe filename
$ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$ext_map = ['image/jpeg'=>'jpg','image/png'=>'png','image/gif'=>'gif','image/webp'=>'webp','image/svg+xml'=>'svg'];
$ext  = $ext_map[$mime] ?? $ext;
$name = 'wq_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$dest = $upload_dir . $name;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    echo json_encode(['success'=>false,'message'=>'Upload failed.']); exit;
}

$url = 'uploads/written/' . $name;
echo json_encode(['success'=>true,'path'=>$url,'message'=>'Image uploaded.']);
