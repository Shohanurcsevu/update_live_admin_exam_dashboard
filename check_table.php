<?php
$c = new mysqli('localhost', 'root', '', 'admin_examtaking');
$r = $c->query("SHOW TABLES LIKE 'trivia_snapshots'");
echo $r->num_rows > 0 ? 'Exists' : 'Does not exist';
?>
