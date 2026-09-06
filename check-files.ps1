# check-files.ps1
$files = @(
    # Core System
    "src\lib\refNo.ts",
    "src\lib\messages.ts",
    "src\lib\cache.ts",
    "src\components\ui\ToastProvider.tsx",

    # Daily Log System
    "src\app\api\daily-logs\route.ts",
    "src\app\api\daily-logs\quick-capture\route.ts",
    "src\app\api\daily-logs\pending-actions\route.ts",
    "src\app\api\daily-logs\[id]\acknowledge\route.ts",
    "src\app\daily-log\page.tsx",
    "src\components\QuickCaptureLog.tsx",
    "src\components\TimeRangePicker.tsx",
    "src\components\SearchableStaffPicker.tsx",
    "src\components\PendingAcknowledgments.tsx",
    "src\components\logging\TimerLog.tsx",
    "src\components\logging\RepeatLog.tsx",
    "src\components\logging\BulkGridLog.tsx",
    "src\components\logging\ProxyLog.tsx",
    "src\components\logging\LogModeHub.tsx",

    # Tasks System
    "src\app\api\tasks\route.ts",
    "src\app\api\tasks\broadcast\route.ts",
    "src\app\api\tasks\check-overdue\route.ts",
    "src\app\tasks\page.tsx",
    "src\components\tasks\BroadcastDirectiveForm.tsx",

    # Case Transfer
    "src\app\api\case-transfer\route.ts",
    "src\app\case-transfer\page.tsx",

    # Staff Logs & Supervisor
    "src\app\api\staff-logs\route.ts",
    "src\app\supervisor\page.tsx",

    # Performance & Leadership
    "src\app\api\leaderboard\route.ts",
    "src\app\performance\page.tsx",
    "src\app\api\incentive-recommendations\route.ts",
    "src\app\incentives\page.tsx",
    "src\app\api\hr-oversight\route.ts",
    "src\app\hr-oversight\page.tsx",

    # Chat System
    "src\app\chat\page.tsx",
    "src\app\api\chat\messages\route.ts",
    "src\app\api\chat\conversations\route.ts",
    "src\app\api\chat\reactions\route.ts",
    "src\app\api\chat\read\route.ts",
    "src\app\api\chat\upload\route.ts",
    "src\components\chat\index.ts",
    "src\components\chat\types.ts",
    "src\components\chat\ChatHeader.tsx",
    "src\components\chat\ConversationList.tsx",
    "src\components\chat\MessageArea.tsx",
    "src\components\chat\MessageBubble.tsx",
    "src\components\chat\MessageInput.tsx",
    "src\components\chat\Panels.tsx",
    "src\components\chat\Icons.tsx",

    # Screen Share
    "src\components\screenshare\ScreenShareProvider.tsx",
    "src\components\screenshare\ScreenShareUI.tsx",
    "src\components\screenshare\ScreenShareWebRTC.tsx",
    "src\hooks\useScreenShareBroadcast.ts",

    # Biometric / Face Capture
    "src\components\biometric\FaceCaptureModal.tsx",
    "src\components\biometric\GuidedFaceEnrollment.tsx",
    "src\components\settings\BiometricEnrollment.tsx",
    "src\lib\biometric\face-client.ts",
    "src\app\api\face\route.ts",
    "src\app\api\webauthn\route.ts",
    "src\lib\webauthn-client.ts",

    # Configuration
    "prisma\schema.prisma",
    "src\components\layout\Sidebar.tsx",
    "src\app\layout.tsx"
)

$shouldNotExist = @(
    "src\app\api\supervisor\logs\route.ts",
    "src\app\staff-logs\page.tsx"
)

Write-Host "
═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📁 FCCPC PERFORMANCE SYSTEM – COMPLETE FILE CHECK" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

$missing = @()
Write-Host "
🟢 CHECKING FILES THAT SHOULD EXIST:" -ForegroundColor Green
foreach ($f in $files) {
    if (Test-Path $f) {
        Write-Host "  ✅ $f" -ForegroundColor Green
    } else {
        Write-Host "  ❌ MISSING: $f" -ForegroundColor Red
        $missing += $f
    }
}

Write-Host "
🔴 CHECKING FILES THAT SHOULD BE DELETED:" -ForegroundColor Red
foreach ($f in $shouldNotExist) {
    if (Test-Path $f) {
        Write-Host "  ⚠️ STILL EXISTS: $f" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ CORRECTLY GONE: $f" -ForegroundColor Green
    }
}

Write-Host "
═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
if ($missing.Count -eq 0) {
    Write-Host "✅ ALL FILES ACCOUNTED FOR!" -ForegroundColor Green
} else {
    Write-Host "❌ MISSING FILES ($($missing.Count)):" -ForegroundColor Red
    foreach ($m in $missing) {
        Write-Host "  - $m" -ForegroundColor Yellow
    }
}
Write-Host "═══════════════════════════════════════════════════════════════════
" -ForegroundColor Cyan
