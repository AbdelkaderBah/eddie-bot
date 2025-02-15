<?php

// Redis Connection Details (same as before)
$redis_host = 'redis';
$redis_port = 6379;
$hash_key = 'trades:debile';

$redis = new Redis();

try {
    $redis->connect($redis_host, $redis_port);
} catch (RedisException $e) {
    die("Could not connect to Redis: " . $e->getMessage());
}

function getSortedTradeTableHTML($redis, $hash_key) {
    $hash_data_raw = $redis->hGetAll($hash_key);
    if (empty($hash_data_raw)) {
        return ["html" => "<p>No data in hash '$hash_key' or hash does not exist.</p>", "stats" => []];
    }
    ksort($hash_data_raw); // Sort keys alphabetically

    $hash_data_processed = []; // To store processed data with parsed profits and losses
    foreach ($hash_data_raw as $key => $value_string) {
        [$profits, $losses] = explode(', ', $value_string); // Split by comma
        $profits = floatval(str_replace('Total Profits: ', '', $profits));
        $losses = floatval(str_replace('Total Losses ', '', $losses));

        $hash_data_processed[$key] = [
            'value_string' => $value_string,
            'profits' => $profits,
            'losses' => $losses,
            'total_result' => $profits - $losses,
        ];
    }

    // Calculate Stats
    $best_profit_key = null;
    $best_profit_value = -INF;
    $worst_loss_key = null;
    $worst_loss_value = INF;

    foreach ($hash_data_processed as $key => $data) {
        if ($data['total_result'] > $best_profit_value) {
            $best_profit_value = $data['total_result'];
            $best_profit_key = $key;
        }
        if ($data['total_result'] < $worst_loss_value) { // Actually, we want largest LOSS, not worst RESULT
            $worst_loss_value = $data['total_result']; // Store total result for comparison, but...
            $worst_loss_key = $key;
        }
    }
    // For "worst loss", we actually want the key with the *highest* loss value, independently of profit
    $max_loss_key = null;
    $max_loss_amount = 0;
    foreach ($hash_data_processed as $key => $data) {
        if ($data['losses'] > $max_loss_amount) {
            $max_loss_amount = $data['losses'];
            $max_loss_key = $key;
        }
    }


    $html_table = "<table border='1' class='trade-table' id='tradeDataTable'>";
    $html_table .= "<thead><tr>";
    $html_table .= "<th onclick='sortTable(0)'>Name</th>"; // Make header sortable by key (column index 0)
    $html_table .= "<th onclick='sortTable(1)'>Profit</th>"; // Make header sortable by value (column index 1)
    $html_table .= "<th onclick='sortTable(2)'>Loss</th>"; // Make header sortable by value (column index 1)
    $html_table .= "</tr></thead>";
    $html_table .= "<tbody>";

    foreach ($hash_data_processed as $key => $data) {
        $html_table .= "<tr><td>" . htmlspecialchars($key) . "</td><td>" . htmlspecialchars($data['profits']) . "</td><td>" . htmlspecialchars($data['losses']) . "</td></tr>";
    }

    $html_table .= "</tbody></table>";

    $stats = [
        'best_profit_key' => $best_profit_key,
        'best_profit_value' => number_format($best_profit_value, 2),
        'worst_loss_key' => $worst_loss_key, // Using max_loss_key for "worst loss"
        'worst_loss_value' => number_format($max_loss_amount, 2), // Display max loss amount
    ];


    return ["html" => $html_table, "stats" => $stats];
}

// Check if it's an AJAX request for table refresh
if (isset($_GET['ajax_update']) && $_GET['ajax_update'] == 1) {
    $table_data = getSortedTradeTableHTML($redis, $hash_key);
    echo $table_data["html"]; // Send back only the table HTML for AJAX update
    $redis->close();
    exit();
}

$table_data_initial = getSortedTradeTableHTML($redis, $hash_key);
$initial_table_html = $table_data_initial["html"];
$initial_stats = $table_data_initial["stats"];

$redis->close();

?>

<!DOCTYPE html>
<html>
<head>
    <title>Trades:debile Data</title>
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f7f9; color: #333; margin: 20px; }
        h1 { color: #4285f4; text-align: center; margin-bottom: 20px; }

        .stats-container {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-bottom: 20px;
        }

        .stats-card {
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            padding: 20px;
            text-align: center;
            width: 250px;
        }

        .stats-card h3 {
            color: #2e7d32; /* Green for profit, adjust color as needed */
            margin-top: 0;
            margin-bottom: 10px;
        }

        .stats-card.loss h3 {
            color: #d32f2f; /* Red for loss, adjust color as needed */
        }

        .stats-card p {
            font-size: 1.2em;
            font-weight: bold;
            color: #555;
            margin: 0;
        }


        .trade-table {
            width: 95%; /* Wider table */
            border-collapse: collapse;
            margin: 20px auto; /* Centered table */
            box-shadow: 0 6px 12px rgba(0,0,0,0.15); /* Stronger shadow */
            background-color: #fff; /* White table background */
        }
        .trade-table th, .trade-table td {
            border: 1px solid #ddd;
            padding: 12px; /* More padding in cells */
            text-align: left;
            font-size: 0.95em; /* Slightly larger font */
        }
        .trade-table th {
            background-color: #4285f4; /* Primary blue header color */
            color: white; /* White header text */
            font-weight: bold;
            cursor: pointer; /* Indicate sortable */
        }
        .trade-table th:hover {
            background-color: #3b78e7; /* Slightly darker on hover */
        }
        .trade-table tbody tr:nth-child(even) {
            background-color: #f2f2f2; /* Light grey for even rows */
        }
        .trade-table tbody tr:hover {
            background-color: #e6e6e6; /* Slightly darker on row hover */
        }
    </style>
    <script>

        function refreshTradeTable() {
            fetch('?ajax_update=1')
                .then(response => response.text())
                .then(html => {
                    document.getElementById('tradeTableContainer').innerHTML = html;
                    // Re-apply sorting if any column was sorted before refresh
                    if (currentSortColumn !== -1) {
                        sortTable(currentSortColumn); // Re-sort after update
                    }
                    updateStatsCards(); // Update stats cards on refresh
                })
                .catch(error => {
                    console.error('Error refreshing table:', error);
                });
        }

        function updateStatsCards() {
            fetch('?ajax_update=1') // Fetch again just to get updated stats - optimize later if needed
                .then(response => response.text()) // We actually don't need the HTML table again, but reusing endpoint for now
                .then(html => {
                    // Re-parse the HTML to extract stats - inefficient, but quick for this example
                    const tempTableContainer = document.createElement('div');
                    tempTableContainer.innerHTML = html;
                    const tableBody = tempTableContainer.querySelector('#tradeDataTable tbody');
                    if (tableBody) {
                        let bestProfitKey = null;
                        let bestProfitValue = 0;
                        let worstLossKey = null;
                        let worstLossValue = 0;

                        const rows = tableBody.querySelectorAll('tr');
                        rows.forEach(row => {
                            const key = row.cells[0].textContent;
                            const profits = parseFloat(row.cells[1].textContent);
                            const losses = parseFloat(row.cells[2].textContent);

                            const totalResult = profits - losses;

                            if (totalResult > bestProfitValue) {
                                bestProfitValue = totalResult;
                                bestProfitKey = key;
                            }

                            if (losses > worstLossValue) { // Find key with maximum loss
                                worstLossValue = losses;
                                worstLossKey = key;
                            }
                        });

                        document.getElementById('bestProfitKey').textContent = bestProfitKey || 'N/A';
                        document.getElementById('bestProfitValue').textContent = bestProfitValue !== -Infinity ? bestProfitValue.toFixed(2) : 'N/A';
                        document.getElementById('worstLossKey').textContent = worstLossKey || 'N/A';
                        document.getElementById('worstLossValue').textContent = worstLossValue !== Infinity ? worstLossValue.toFixed(2) : 'N/A';
                    }

                    sortTable(2);
                })
                .catch(error => {
                    console.error('Error updating stats:', error);
                });
        }


        document.addEventListener('DOMContentLoaded', function() {
            setInterval(refreshTradeTable, 15000); // Refresh every 15 seconds
            updateStatsCards(); // Initial stats update on page load

            sortTable(2);
        });


        let currentSortColumn = -1; // Track currently sorted column (-1: no sorting)
        let isAscendingSort = true;

        function sortTable(columnIndex) {
            const table = document.getElementById('tradeDataTable');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));

            if (columnIndex === currentSortColumn) {
                isAscendingSort = !isAscendingSort; // Toggle sort direction on same column click
            } else {
                currentSortColumn = columnIndex;
                isAscendingSort = true; // Default to ascending sort on new column
            }

            const sortedRows = rows.sort((rowA, rowB) => {
                const cellA = rowA.cells[columnIndex].textContent.trim().toUpperCase();
                const cellB = rowB.cells[columnIndex].textContent.trim().toUpperCase();

                let comparison = 0;
                if (cellA > cellB) {
                    comparison = 1;
                } else if (cellA < cellB) {
                    comparison = -1;
                }
                return isAscendingSort ? comparison : comparison * -1; // Apply sort direction
            });

            tbody.innerHTML = ''; // Clear table body
            sortedRows.forEach(row => tbody.appendChild(row)); // Append sorted rows
        }

    </script>
</head>
<body>
<h1>VHAKM Hash Data</h1>

<div class="stats-container">
    <div class="stats-card">
        <h3>Best BOT By Profit</h3>
        <p id="bestProfitKey"><?php echo htmlspecialchars($initial_stats['best_profit_key'] ?? 'N/A'); ?></p>
        <p>Profit: <span id="bestProfitValue"><?php echo htmlspecialchars($initial_stats['best_profit_value'] ?? 'N/A'); ?></span></p>
    </div>

    <div class="stats-card loss">
        <h3>Worst BOT By Loss</h3>
        <p id="worstLossKey"><?php echo htmlspecialchars($initial_stats['worst_loss_key'] ?? 'N/A'); ?></p>
        <p>Loss: <span id="worstLossValue"><?php echo htmlspecialchars($initial_stats['worst_loss_value'] ?? 'N/A'); ?></span></p>
    </div>
</div>


<div id="tradeTableContainer">
    <?php echo $initial_table_html; ?>
</div>
</body>
</html>