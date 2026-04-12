# Twitter Trend Server - Test Suite
# Usage: .\test.ps1
# Assumes the server is already running on localhost:3000 (npm start)

$BASE = "http://localhost:3000"
$PASS = 0
$FAIL = 0

function Write-Pass($msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:PASS++
}

function Write-Fail($msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:FAIL++
}

function Write-Section($title) {
    Write-Host ""
    Write-Host "--- $title ---" -ForegroundColor Cyan
}

# Helper: GET request, returns [statusCode, body]
function Invoke-Get($url) {
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
        return @($resp.StatusCode, ($resp.Content | ConvertFrom-Json))
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $raw = $_.ErrorDetails.Message
        $body = $null
        if ($raw) { try { $body = $raw | ConvertFrom-Json } catch {} }
        return @($status, $body)
    }
}

# -------------------------------------------------------------------------
# 0. Connectivity check
# -------------------------------------------------------------------------
Write-Section "Connectivity"
$ping = Invoke-Get "$BASE/?q=1"
if ($null -eq $ping[0] -or $ping[0] -eq 0) {
    Write-Host ""
    Write-Host "ERROR: Cannot reach $BASE - is the server running?" -ForegroundColor Yellow
    Write-Host "  Start it with: npm start" -ForegroundColor Yellow
    exit 1
}
Write-Host "  Server reachable (HTTP $($ping[0]))" -ForegroundColor DarkGray

# -------------------------------------------------------------------------
# 1. Input validation - bad q values should return 400
# -------------------------------------------------------------------------
Write-Section "Input Validation (expect 400)"

$badValues = @("0", "51", "abc", "-1", "3.5", "")
foreach ($bad in $badValues) {
    $url = if ($bad -eq "") { "$BASE/" } else { "$BASE/?q=$bad" }
    $result = Invoke-Get $url
    $code = $result[0]
    if ($code -eq 400) {
        Write-Pass "q=$bad  ->  400"
    } else {
        Write-Fail "q=$bad  ->  expected 400, got $code"
    }
}

# -------------------------------------------------------------------------
# 2. Valid requests - check status and response shape
# -------------------------------------------------------------------------
Write-Section "Valid Requests (expect 200 + correct shape)"

$validValues = @(1, 5, 10)
foreach ($q in $validValues) {
    $result = Invoke-Get "$BASE/?q=$q"
    $code   = $result[0]
    $body   = $result[1]

    if ($code -ne 200) {
        Write-Fail "q=$q  ->  expected 200, got $code"
        continue
    }
    Write-Pass "q=$q  ->  200"

    # Must have a 'trends' array
    if ($body.PSObject.Properties.Name -notcontains "trends") {
        Write-Fail "q=$q  ->  response missing 'trends' key"
        continue
    }
    Write-Pass "q=$q  ->  response has 'trends' key"

    $trends = $body.trends
    $trendsIsArray = ($trends -is [System.Array]) -or ($trends -is [System.Collections.IEnumerable])
    if ($trendsIsArray) {
        Write-Pass "q=$q  ->  'trends' is an array"
    } else {
        Write-Fail "q=$q  ->  'trends' is not an array"
        continue
    }

    # Returned at most q trends
    if ($trends.Count -le $q) {
        Write-Pass "q=$q  ->  trends.length ($($trends.Count)) <= q"
    } else {
        Write-Fail "q=$q  ->  trends.length ($($trends.Count)) exceeds q=$q"
    }

    # Check each trend object has required fields and correct types
    $shapeFail = $false
    foreach ($t in $trends) {
        $keys = $t.PSObject.Properties.Name
        foreach ($required in @("trend", "trend_score", "post_count", "representative_hashtags")) {
            if ($keys -notcontains $required) {
                Write-Fail "q=$q  ->  trend object missing '$required'"
                $shapeFail = $true
            }
        }
        $scoreType = $t.trend_score.GetType().Name
        if ($scoreType -notin @("Int32", "Int64", "Double", "Decimal")) {
            Write-Fail "q=$q  ->  trend_score is not a number (got $scoreType)"
            $shapeFail = $true
        }
        if ($t.post_count -lt 1) {
            Write-Fail "q=$q  ->  post_count < 1"
            $shapeFail = $true
        }
    }
    if (-not $shapeFail -and $trends.Count -gt 0) {
        Write-Pass "q=$q  ->  all trend objects have correct shape"
    }
}

# -------------------------------------------------------------------------
# 3. Caching - second identical request should return cached:true
# -------------------------------------------------------------------------
Write-Section "Cache Behavior"

$r1 = Invoke-Get "$BASE/?q=3"
$r2 = Invoke-Get "$BASE/?q=3"

$b1 = $r1[1]
$b2 = $r2[1]

if ($r1[0] -eq 200 -and $r2[0] -eq 200) {
    Write-Pass "Both requests returned 200"
} else {
    Write-Fail "One or both requests failed (got $($r1[0]), $($r2[0]))"
}

$b2Cached = $b2.PSObject.Properties.Name -contains "cached" -and $b2.cached -eq $true
$b1Cached = $b1.PSObject.Properties.Name -contains "cached" -and $b1.cached -eq $true

if ($b2Cached) {
    Write-Pass "Second request has cached=true"
} elseif ($b1Cached) {
    Write-Pass "Response was cached (server was already warm from earlier test)"
} else {
    Write-Fail "Second request missing cached=true (got cached=$($b2.cached))"
}

# -------------------------------------------------------------------------
# 4. Print top trends from q=5 for manual inspection
# -------------------------------------------------------------------------
Write-Section "Sample Output (q=5)"

$sample = Invoke-Get "$BASE/?q=5"
if ($sample[0] -eq 200) {
    $trends = $sample[1].trends
    if ($trends.Count -eq 0) {
        Write-Host "  (no trends returned - possibly no tweets in the last hour with min_faves:50)" -ForegroundColor DarkGray
    } else {
        $i = 1
        foreach ($t in $trends) {
            $tags = if ($t.representative_hashtags.Count -gt 0) {
                $t.representative_hashtags -join ", "
            } else {
                "(none)"
            }
            $line = "  {0,2}. {1,-30} score={2,-8} posts={3,-4} tags={4}" -f $i, $t.trend, $t.trend_score, $t.post_count, $tags
            Write-Host $line
            $i++
        }
    }
} else {
    Write-Host "  Could not fetch sample (HTTP $($sample[0]))" -ForegroundColor DarkGray
}

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------
Write-Host ""
Write-Host "==============================" -ForegroundColor White
$total = $PASS + $FAIL
if ($FAIL -eq 0) {
    Write-Host "  ALL $PASS / $total TESTS PASSED" -ForegroundColor Green
} else {
    $summary = "  $PASS PASSED   $FAIL FAILED   ($total total)"
    Write-Host $summary -ForegroundColor Yellow
}
Write-Host "==============================" -ForegroundColor White
Write-Host ""
