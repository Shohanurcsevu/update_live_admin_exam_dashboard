<?php
$scriptName = 'telegram_bot.php';
$wmicOutput = [];
exec('wmic process where "name=\'php.exe\'" get commandline /format:csv 2>&1', $wmicOutput);

echo "WMIC Output:\n";
print_r($wmicOutput);

$found = false;
foreach ($wmicOutput as $line) {
    if (stripos($line, $scriptName) !== false) {
        echo "FOUND: $line\n";
        $found = true;
    }
}

if (!$found) echo "NOT FOUND\n";
