<?php
$files = [
    'api/backup/import.php',
    'api/backup/import-chunk.php',
    'api/backup/stats.php',
    'api/backup/export.php',
    'api/backup/export-chunk.php',
    'api/backup/auto-backup.php'
];

foreach ($files as $file) {
    if (!file_exists($file)) {
        echo "MISSING: $file\n";
        continue;
    }
    $output = [];
    $retval = 0;
    exec("php -l \"$file\"", $output, $retval);
    if ($retval !== 0) {
        echo implode("\n", $output) . "\n";
    } else {
        echo "OK: $file\n";
    }
}
