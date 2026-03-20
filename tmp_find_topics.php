<?php
$c = new mysqli('localhost', 'root', '', 'admin_examtaking');
$res = $c->query('SELECT topic_id, COUNT(*) as count FROM questions WHERE topic_id IS NOT NULL AND is_deleted = 0 GROUP BY topic_id ORDER BY count DESC LIMIT 5');
if ($res) {
    while($r = $res->fetch_assoc()) {
        echo "Topic ID: " . $r['topic_id'] . " (" . $r['count'] . " questions)\n";
    }
} else {
    echo "Error: " . $c->error . "\n";
}
