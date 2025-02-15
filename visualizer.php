<?php

// Redis Connection Details
$redis_host = 'redis'; // Replace with your Redis host if needed
$redis_port = 6379;        // Replace with your Redis port if needed
$hash_key = 'trades:debile';

$redis = new Redis();

try {
    $redis->connect($redis_host, $redis_port);
} catch (RedisException $e) {
    die("Could not connect to Redis: " . $e->getMessage());
}

function getSortedTradeTableHTML($redis, $hash_key) {
    $hash_data = $redis->hGetAll($hash_key);
    if (empty($hash_data)) {
        return "<p>No data in hash '$hash_key' or hash does not exist.</p>";
    }
    ksort($hash_data); // Sort keys alphabetically

    $html_table = "<table border='1' class='trade-table'>";
    $html_table .= "<thead><tr><th>Key</th><th>Value</th></tr></thead>";
    $html_table .= "<tbody>";

    foreach ($hash_data as $key => $value) {
        $html_table .= "<tr><td>" . htmlspecialchars($key) . "</td><td>" . htmlspecialchars($value) . "</td></tr>";
    }

    $html_table .= "</tbody></table>";
    return $html_table;
}

// Check if it's an AJAX request for table refresh
if (isset($_GET['ajax_update']) && $_GET['ajax_update'] == 1) {
    echo getSortedTradeTableHTML($redis, $hash_key);
    $redis->close();
    exit(); // Stop further execution, just send the table HTML
}

$initial_table_html = getSortedTradeTableHTML($redis, $hash_key);
$redis->close();

?>

<!DOCTYPE html>
<html>
<head>
    <title>Trades:debile Data</title>
    <style>
        body { font-family: Arial, sans-serif; }
        h1 { color: #333; }
        .trade-table {
            width: 80%;
            border-collapse: collapse;
            margin: 20px auto;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .trade-table th, .trade-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .trade-table th {
            background-color: #f4f4f4;
            color: #333;
            font-weight: bold;
        }
        .trade-table tbody tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .trade-table tbody tr:hover {
            background-color: #e0e0e0;
        }
    </style>
    <script>
        function refreshTradeTable() {
            fetch('?ajax_update=1') // Request only the table HTML
                .then(response => response.text())
                .then(html => {
                    document.getElementById('tradeTableContainer').innerHTML = html;
                })
                .catch(error => {
                    console.error('Error refreshing table:', error);
                });
        }

        document.addEventListener('DOMContentLoaded', function() {
            setInterval(refreshTradeTable, 15000); // Refresh every 15 seconds (15000 milliseconds)
        });
    </script>
</head>
<body>
<h1>Trades:debile Hash Data</h1>
<div id="tradeTableContainer">
    <?php echo $initial_table_html; ?>
</div>
</body>
</html>