<?php
// Allow CORS if needed
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the raw POST data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if ($data) {
        // Prepare the data record
        $record = [
            'timestamp' => date('Y-m-d H:i:s'),
            'name' => $data['name'] ?? '',
            'status' => $data['status'] ?? '',
            'level' => $data['level'] ?? 'N/A',
            'department' => $data['department'] ?? '',
            'whatsapp' => $data['whatsapp'] ?? '',
            'access_time' => date('Y-m-d H:i:s')
        ];
        
        // Save to CSV file
        $filename = 'visitor_data.csv';
        
        // Check if file exists to write headers
        $writeHeaders = !file_exists($filename);
        
        $file = fopen($filename, 'a');
        
        // Write headers if new file
        if ($writeHeaders) {
            fputcsv($file, array_keys($record));
        }
        
        // Write the data
        fputcsv($file, $record);
        fclose($file);
        
        // Send email notification
        $emailSent = sendEmailNotification($record);
        
        // Return success response
        echo json_encode([
            'success' => true, 
            'message' => 'Data saved successfully',
            'email_sent' => $emailSent
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'No data received']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}

function sendEmailNotification($record) {
    $to = "helpinghandshallneverfall@gmail.com";
    $subject = "🎓 New FUTA Survival Guide Visitor";
    
    // Create a nice email message
    $statusDisplay = $record['status'] === 'fresher' ? 'Fresher' : $record['level'] . ' Level';
    
    $message = "
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003366; color: white; padding: 15px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .data-row { margin: 10px 0; padding: 10px; background: white; border-left: 4px solid #003366; }
            .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h2>🚀 New FUTA Guide Visitor</h2>
            </div>
            <div class='content'>
                <p>A new student has accessed the FUTA Survival Guide:</p>
                
                <div class='data-row'>
                    <strong>👤 Name:</strong> {$record['name']}
                </div>
                <div class='data-row'>
                    <strong>🎓 Status:</strong> {$statusDisplay}
                </div>
                <div class='data-row'>
                    <strong>🏫 Department:</strong> {$record['department']}
                </div>
                <div class='data-row'>
                    <strong>📱 WhatsApp:</strong> {$record['whatsapp']}
                </div>
                <div class='data-row'>
                    <strong>🕒 Access Time:</strong> {$record['timestamp']}
                </div>
            </div>
            <div class='footer'>
                <p>This email was automatically sent from the FUTA Survival Guide website.</p>
            </div>
        </div>
    </body>
    </html>
    ";
    
    // Email headers
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: FUTA Survival Guide <noreply@futa-survival-guide.com>" . "\r\n";
    $headers .= "Reply-To: noreply@futa-survival-guide.com" . "\r\n";
    
    // Send email
    return mail($to, $subject, $message, $headers);
}
?>
