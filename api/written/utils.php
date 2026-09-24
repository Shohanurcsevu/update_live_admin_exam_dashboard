<?php
/**
 * api/written/utils.php
 * Shared helpers for Written Exam module
 */

if (!function_exists('sanitize_question_type')) {
    function sanitize_question_type($type) {
        $allowed = [
            'short_answer','broad','essay','creative_cq','fill_blank',
            'math','calculation','definition','diagram','image_based','passage','other'
        ];
        return in_array($type, $allowed) ? $type : 'short_answer';
    }
}

if (!function_exists('insert_sub_questions')) {
    function insert_sub_questions($conn, $parent_id, $sub_questions) {
        foreach ($sub_questions as $idx => $sq) {
            if (empty($sq['sub_question_text'])) continue;
            $text         = trim($sq['sub_question_text']);
            $marks        = floatval($sq['marks'] ?? 1);
            $model_answer = trim($sq['model_answer'] ?? '');
            $image_path   = trim($sq['image_path'] ?? '');
            $has_formula  = intval($sq['has_formula'] ?? 0);
            $order        = intval($sq['display_order'] ?? $idx);
            $stmt = $conn->prepare(
                "INSERT INTO written_sub_questions
                 (parent_question_id, sub_question_text, marks, model_answer, image_path, has_formula, display_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->bind_param('isdssii', $parent_id, $text, $marks, $model_answer, $image_path, $has_formula, $order);
            $stmt->execute();
            $stmt->close();
        }
    }
}

if (!function_exists('log_written_activity')) {
    function log_written_activity($conn, $type, $message) {
        $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
        if ($stmt) {
            $stmt->bind_param('ss', $type, $message);
            $stmt->execute();
            $stmt->close();
        }
    }
}

if (!function_exists('answer_space_to_lines')) {
    function answer_space_to_lines($space, $custom_lines = null) {
        switch ($space) {
            case 'small':  return 4;
            case 'medium': return 8;
            case 'large':  return 16;
            case 'custom': return max(1, intval($custom_lines ?? 8));
            default:       return 8;
        }
    }
}
