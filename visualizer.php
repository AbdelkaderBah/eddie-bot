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
        return ["html" => "<p class='no-data'>No data available in hash '$hash_key'</p>", "stats" => []];
    }
    ksort($hash_data_raw); // Sort keys alphabetically

    $hash_data_processed = []; // To store processed data with parsed profits and losses
    foreach ($hash_data_raw as $key => $value_string) {
        [$profits, $losses] = explode(', ', $value_string); // Split by comma
        $profits = floatval(str_replace('Total Profits: ', '', $profits));
        $losses = floatval(str_replace('Total Losses ', '', $losses));

        $hash_data_processed[$key] = [
            'name' => $key,
            'value_string' => $value_string,
            'profits' => $profits,
            'losses' => $losses,
            'total_result' => $profits - $losses,
        ];
    }

    // Calculate Stats
    $best_profit_key = null;
    $best_profit_value = 0;
    $worst_loss_key = null;
    $worst_loss_value = 0;

    foreach ($hash_data_processed as $key => $data) {
        if ($data['total_result'] > $best_profit_value) {
            $best_profit_value = $data['total_result'];
            $best_profit_key = $key;
        }

        if ($worst_loss_value > $data['total_result']) { // Find key with maximum loss
            $worst_loss_value = $data['total_result'];
            $worst_loss_key = $key;
        }
    }

    // Sort descending by total result
    usort($hash_data_processed, function ($a, $b) {
        return $b['total_result'] <=> $a['total_result'];
    });


    $html_table = "<table class='trade-table' id='tradeDataTable'>";
    $html_table .= "<thead class='table-header'><tr>";
    $html_table .= "<th onclick='sortTable(0)'>Name</th>";
    $html_table .= "<th onclick='sortTable(1)'>Net profits</th>";
    $html_table .= "<th onclick='sortTable(2)'>Profit</th>";
    $html_table .= "<th onclick='sortTable(3)'>Loss</th>";
    $html_table .= "</tr></thead>";
    $html_table .= "<tbody>";

    foreach ($hash_data_processed as $key => $data) {
        $html_table .= "<tr><td>" . htmlspecialchars($data['name']) . "</td><td>" . htmlspecialchars(number_format($data['total_result'], 3)) . "</td><td>" . htmlspecialchars(number_format($data['profits'], 3)) . "</td><td>" . htmlspecialchars(number_format($data['losses'], 3)) . "</td></tr>";
    }

    $html_table .= "</tbody></table>";

    $stats = [
        'best_profit_key' => $best_profit_key,
        'best_profit_value' => number_format($best_profit_value, 2),
        'worst_loss_key' => $worst_loss_key,
        'worst_loss_value' => number_format($worst_loss_value, 2),
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
    <title>VHAKM Trades Data</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        #tradeTableContainer {
            width: 90%;
        }

        body {
            font-family: 'Roboto', sans-serif;
            background-color: #f8f9fa;
            color: #343a40;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        h1 {
            color: black;
            text-align: center;
            margin-bottom: 30px;
            font-weight: 700;
            font-size: 50px;
            letter-spacing: 0.5px;
        }

        .stats-container {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-bottom: 30px;
            width: 100%;
            max-width: 1200px;
        }

        .stats-card {
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.08);
            padding: 30px;
            text-align: center;
            flex: 1;
            min-width: 200px;
            transition: transform 0.2s ease-in-out;
            border: 1px solid #e9ecef;
        }

        .stats-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .stats-card h3 {
            color: #1e8e3e; /* Profit color - vibrant green */
            margin-top: 0;
            margin-bottom: 15px;
            font-weight: 500;
            font-size: 1.5em;
        }

        .stats-card.loss h3 {
            color: #dc3545; /* Loss color - strong red */
        }

        .stats-card p {
            font-size: 2em;
            font-weight: bold;
            color: #495057;
            margin: 0;
            line-height: 1.2;
        }

        .trade-table {
            width: 100%;
            max-width: 1200px;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
            border-radius: 12px 12px 0 0;
            overflow: hidden; /* For rounded corners on header */
        }

        .table-header th {
            background-color: #007bff; /* Bootstrap primary blue */
            color: white;
            font-weight: 500;
            text-align: left;
            padding: 18px 20px;
            border-bottom: 2px solid #0056b3;
            cursor: pointer;
            user-select: none; /* Prevent text selection during click */
        }

        .trade-table th:first-child { border-top-left-radius: 12px; }
        .trade-table th:last-child { border-top-right-radius: 12px; }

        .trade-table th:hover {
            background-color: #0056b3;
        }

        .trade-table td {
            padding: 15px 20px;
            border-bottom: 1px solid #e9ecef;
            font-size: 0.9rem;
        }

        .trade-table tbody tr:last-child td {
            border-bottom: none;
        }

        .trade-table tbody tr:nth-child(even) {
            background-color: #f8f9fa;
        }

        .trade-table tbody tr:hover {
            background-color: #e0f7fa; /* Light teal hover for rows */
            transition: background-color 0.3s ease;
        }

        .no-data {
            text-align: center;
            padding: 20px;
            font-style: italic;
            color: #6c757d;
        }

        .sorted-column {
            background-color: #0056b3 !important; /* Keep hover color or slightly darker when sorted */
            color: white !important;
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
                        // sortTable(currentSortColumn); // Re-sort after update
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
                        let bestProfitKey = document.getElementById('bestProfitKey').textContent;
                        let bestProfitValue = document.getElementById('bestProfitValue').textContent;
                        let worstLossKey = document.getElementById('worstLossKey').textContent;
                        let worstLossValue = document.getElementById('worstLossValue').textContent;

                        document.getElementById('bestProfitKey').textContent = bestProfitKey || 'N/A';
                        document.getElementById('bestProfitValue').textContent = bestProfitValue !== -Infinity ? bestProfitValue.toFixed(2) : 'N/A';
                        document.getElementById('worstLossKey').textContent = worstLossKey || 'N/A';
                        document.getElementById('worstLossValue').textContent = worstLossValue !== Infinity ? worstLossValue.toFixed(2) : 'N/A';
                    }
                })
                .catch(error => {
                    console.error('Error updating stats:', error);
                });
        }


        document.addEventListener('DOMContentLoaded', function() {
            setInterval(refreshTradeTable, 15000); // Refresh every 15 seconds
            updateStatsCards(); // Initial stats update on page load
        });


        let currentSortColumn = 1; // Track currently sorted column (-1: no sorting)
        let isAscendingSort = false;

        function sortTable(columnIndex) {
            return;
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
                let cellA, cellB;
                if (columnIndex === 1 || columnIndex === 2) { // For Profit and Loss columns, sort numerically
                    cellA = parseFloat(rowA.cells[3].textContent.trim());
                    cellB = parseFloat(rowB.cells[2].textContent.trim());
                } else { // For Name column (columnIndex === 0), sort alphabetically
                    cellA = rowA.cells[3].textContent.trim().toUpperCase();
                    cellB = rowB.cells[2].textContent.trim().toUpperCase();
                }


                let comparison = 0;
                if (cellA > cellB) {
                    comparison = 1;
                } else if (cellB > cellA) {
                    comparison = -1;
                }
                return isAscendingSort ? comparison : comparison * -1; // Apply sort direction
            });

            tbody.innerHTML = ''; // Clear table body
            sortedRows.forEach(row => tbody.appendChild(row)); // Append sorted rows

            //Highlight the sorted column header
            highlightSortColumn(columnIndex);
        }

        function highlightSortColumn(columnIndex) {
            const headers = document.querySelectorAll('#tradeDataTable th');
            headers.forEach((header, index) => {
                if (index === columnIndex) {
                    header.classList.add('sorted-column'); // Add class to highlight
                } else {
                    header.classList.remove('sorted-column'); // Remove from others
                }
            });
        }


    </script>
</head>
<body>
<h1>VHAKM Trades Data</h1>

<div class="stats-container">
    <div class="stats-card">
        <h3>Best performing bot</h3>
        <p id="bestProfitKey"><?php echo htmlspecialchars($initial_stats['best_profit_key'] ?? 'N/A'); ?></p>
        <p><span id="bestProfitValue"><?php echo htmlspecialchars($initial_stats['best_profit_value'] ?? 'N/A'); ?></span></p>
    </div>

    <div class="stats-card loss">
        <h3>Worst performing bot</h3>
        <p id="worstLossKey"><?php echo htmlspecialchars($initial_stats['worst_loss_key'] ?? 'N/A'); ?></p>
        <p><span id="worstLossValue"><?php echo htmlspecialchars($initial_stats['worst_loss_value'] ?? 'N/A'); ?></span></p>
    </div>
</div>


<div id="tradeTableContainer">
    <?php echo $initial_table_html; ?>
</div>
</body>
</html>