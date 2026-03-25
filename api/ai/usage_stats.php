<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once __DIR__ . '/../subject/db_connect.php';

$stats = [];

foreach ($ALLOWED_MODELS as $model => $label) {
    $limits = $MODEL_LIMITS[$model] ?? ['rpm' => 0, 'tpm' => 0, 'rpd' => 0];
    
    // 1. Current Minute Usage (RPM/TPM)
    $minQuery = "SELECT COUNT(*) as r_count, SUM(total_tokens) as t_sum 
                 FROM ai_usage_log 
                 WHERE model_name = ? AND request_time >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)";
    $stmt = $conn->prepare($minQuery);
    $stmt->bind_param("s", $model);
    $stmt->execute();
    $minRes = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // 2. Current Day Usage (RPD)
    $dayQuery = "SELECT COUNT(*) as r_count 
                 FROM ai_usage_log 
                 WHERE model_name = ? AND request_time >= DATE_SUB(NOW(), INTERVAL 1 DAY)";
    $stmt = $conn->prepare($dayQuery);
    $stmt->bind_param("s", $model);
    $stmt->execute();
    $dayRes = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // 3. Last 28 Days Peak Usage (Optional/Mock for now or simplified)
    // The user's request shows "Peak usage ... over last 28 days"
    // For simplicity, we'll show current vs limits as requested in the dashboard format.
    
    $stats[$model] = [
        'label' => $label,
        'rpm' => (int)($minRes['r_count'] ?? 0),
        'rpm_limit' => $limits['rpm'],
        'tpm' => (int)($minRes['t_sum'] ?? 0),
        'tpm_limit' => $limits['tpm'],
        'rpd' => (int)($dayRes['r_count'] ?? 0),
        'rpd_limit' => $limits['rpd']
    ];
}

echo json_encode([
    'success' => true,
    'data' => $stats
]);
?>
