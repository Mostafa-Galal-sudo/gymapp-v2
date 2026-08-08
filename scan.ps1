$port = 59301
$files = Get-ChildItem -Path e:\ddddddddddddddddd\proj\gymapp\src -Recurse -Include *.ts,*.tsx
foreach ($f in $files) {
    $body = @{ filePath = $f.FullName } | ConvertTo-Json
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:$port/scan" -Method Post -ContentType "application/json" -Body $body
        Write-Output "--- SCAN RESULTS FOR $($f.FullName) ---"
        if ($res.findings.Count -gt 0) {
            $res.findings | ConvertTo-Json -Depth 5
        } else {
            Write-Output "No findings."
        }
    } catch {
        Write-Output "Failed to scan $($f.FullName)"
    }
}
