<?php
// Set up environment
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'POST';

// Mock data
$payload = [
    'attempt_uuid' => 'test-orphan-' . uniqid(),
    'exam_id' => 9999, // Non-existent ID
    'answers' => ['1' => 'A'],
    'start_time' => '2026-03-18 10:00:00',
    'end_time' => '2026-03-18 10:10:00',
    'duration_used' => 600,
    'checksum' => 'dummy'
];

// Re-check if exam_id 883 exists, if not use a valid one from DB
require_once 'api/subject/db_connect.php';
$check = $conn->query("SELECT id FROM exams LIMIT 1");
if ($row = $check->fetch_assoc()) {
    $payload['exam_id'] = $row['id'];
}

$json = json_encode($payload);

// Capture output
ob_start();

// Use a custom stream wrapper to mock php://input
if (in_array('mock', stream_get_wrappers())) {
    stream_wrapper_unregister('mock');
}

class MockStream {
    private static $data;
    private $pos = 0;
    public $context;
    public static function setData($data) { self::$data = $data; }
    public function stream_open($path, $mode, $options, &$opened_path) { return true; }
    public function stream_read($count) {
        $ret = substr(self::$data, $this->pos, $count);
        $this->pos += strlen($ret);
        return $ret;
    }
    public function stream_eof() { return $this->pos >= strlen(self::$data); }
    public function stream_stat() { return []; }
}

// We can't easily unregister 'php://input', so we'll modify submit-attempt.php 
// temporarily to read from a variable if it exists, or just use another approach.
// Actually, I'll just temporarily modify submit-attempt.php to use a variable for data.

$content = file_get_contents('api/offline/submit-attempt.php');
// Fix the relative path for db_connect.php since we are running from root
$content = str_replace("require_once '../subject/db_connect.php';", "require_once 'api/subject/db_connect.php';", $content);
$content = str_replace('file_get_contents("php://input")', '$GLOBALS["MOCK_INPUT"]', $content);
$GLOBALS["MOCK_INPUT"] = $json;

try {
    eval('?>' . $content);
} catch (Throwable $t) {
    echo "CAUGHT: " . $t->getMessage() . " in " . $t->getFile() . " on line " . $t->getLine() . "\n";
}

$output = ob_get_clean();
echo "--- OUTPUT START ---\n";
echo $output;
echo "\n--- OUTPUT END ---\n";
?>
