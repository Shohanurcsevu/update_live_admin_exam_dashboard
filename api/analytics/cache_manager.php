<?php
// FILE: api/analytics/cache_manager.php

class CacheManager {
    private $cache_dir;

    public function __construct() {
        $this->cache_dir = __DIR__ . '/cache/';
        if (!file_exists($this->cache_dir)) {
            mkdir($this->cache_dir, 0777, true);
        }
    }

    public function get($key) {
        $file = $this->cache_dir . md5($key) . '.json';
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            if ($data['expires_at'] > time()) {
                return $data['payload'];
            } else {
                unlink($file); // Expired
            }
        }
        return null;
    }

    public function set($key, $payload, $ttl_seconds) {
        $file = $this->cache_dir . md5($key) . '.json';
        $data = [
            'expires_at' => time() + $ttl_seconds,
            'payload' => $payload
        ];
        file_put_contents($file, json_encode($data));
    }
    
    public function clear($key) {
        $file = $this->cache_dir . md5($key) . '.json';
         if (file_exists($file)) {
            unlink($file);
        }
    }
}
?>
