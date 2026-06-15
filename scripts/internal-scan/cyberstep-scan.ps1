<#
.SYNOPSIS
    CyberStep Ic Tarama Scripti - Windows
.DESCRIPTION
    Sistemin guvenlik durumunu degerlendirir ve JSON cikti uretir.
    Yonetici yetkisi onerilir, bazi bilgiler standart kullanici ile de toplanabilir.
.EXAMPLE
    .\cyberstep-scan.ps1 -CustomerId "123" -ApiKey "cs_xxx" -ApiUrl "https://cyberstep.io"
    .\cyberstep-scan.ps1 -OutputFile "scan-result.json"  # Offline mod
#>

param(
    [string]$CustomerId = "{{CUSTOMER_ID}}",
    [string]$ApiKey     = "{{API_KEY}}",
    [string]$ApiUrl     = "{{API_URL}}",
    [string]$OutputFile = ""
)

$ErrorActionPreference = "SilentlyContinue"
$result = @{
    scan_type    = "internal_script_windows"
    scan_version = "1.0.0"
    scanned_at   = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    customer_id  = $CustomerId
    hostname     = $env:COMPUTERNAME
    os           = @{}
    network      = @{}
    users        = @{}
    security     = @{}
    services     = @{}
    errors       = @()
}

Write-Host "CyberStep Ic Tarama Basliyor..." -ForegroundColor Cyan

# -- 1. ISLETIM SISTEMI -------------------------------------------------------
try {
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem
    $lastBoot = $os.LastBootUpTime

    $result.os = @{
        name          = $os.Caption
        version       = $os.Version
        build         = $os.BuildNumber
        architecture  = $os.OSArchitecture
        install_date  = $os.InstallDate.ToString("yyyy-MM-dd")
        last_boot     = $lastBoot.ToString("yyyy-MM-dd HH:mm")
        uptime_days   = [math]::Round(((Get-Date) - $lastBoot).TotalDays, 1)
        is_eol        = ($os.Version -match "^(5\.|6\.0|6\.1)")
        domain_joined = ($cs.PartOfDomain -eq $true)
        domain        = $cs.Domain
        total_ram_gb  = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
    }

    $patches = Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 10
    $result.os.last_patch_date = if ($patches) { $patches[0].InstalledOn.ToString("yyyy-MM-dd") } else { $null }
    $result.os.recent_patches  = @($patches | ForEach-Object { $_.HotFixID })

    $au = (Get-ItemProperty "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -EA SilentlyContinue)
    $result.os.auto_update = ($au.AUOptions -eq 4)
} catch { $result.errors += "os: $_" }

# -- 2. AG ADAPTÖRLERI -------------------------------------------------------
try {
    $adapters = Get-NetIPConfiguration | Where-Object { $_.IPv4Address }
    $result.network.adapters = @($adapters | ForEach-Object {
        @{ interface = $_.InterfaceAlias; ip = $_.IPv4Address.IPAddress; gateway = $_.IPv4DefaultGateway.NextHop }
    })
} catch { $result.errors += "network_adapters: $_" }

try {
    $connections = Get-NetTCPConnection -State Listen
    $result.network.open_ports = @($connections | ForEach-Object {
        @{ port = $_.LocalPort; pid = $_.OwningProcess }
    } | Sort-Object { $_.port })
} catch { $result.errors += "open_ports: $_" }

try {
    $shares = Get-SmbShare | Where-Object { $_.Name -notmatch '^\w+\$$' }
    $result.network.shares = @($shares | ForEach-Object {
        @{ name = $_.Name; path = $_.Path; description = $_.Description }
    })
} catch { $result.errors += "shares: $_" }

# -- 3. KULLANICI YÖNETIMI ---------------------------------------------------
try {
    $localUsers = Get-LocalUser
    $result.users.local = @($localUsers | ForEach-Object {
        @{
            name              = $_.Name
            enabled           = $_.Enabled
            last_logon        = if ($_.LastLogon) { $_.LastLogon.ToString("yyyy-MM-dd") } else { $null }
            password_required = $_.PasswordRequired
        }
    })
    $result.users.local_admin_count = @(Get-LocalGroupMember "Administrators" -EA SilentlyContinue).Count
} catch { $result.errors += "users: $_" }

if ($result.os.domain_joined) {
    try {
        $domainAdmins = Get-ADGroupMember "Domain Admins" -EA SilentlyContinue
        $result.users.domain_admin_count = if ($domainAdmins) { @($domainAdmins).Count } else { $null }

        $pwPolicy = Get-ADDefaultDomainPasswordPolicy -EA SilentlyContinue
        if ($pwPolicy) {
            $result.users.password_policy = @{
                min_length         = $pwPolicy.MinPasswordLength
                complexity         = $pwPolicy.ComplexityEnabled
                max_age_days       = $pwPolicy.MaxPasswordAge.Days
                lockout_threshold  = $pwPolicy.LockoutThreshold
            }
        }
    } catch { $result.errors += "domain_users: $_" }
}

# -- 4. GÜVENLIK -------------------------------------------------------------
try {
    $defender = Get-MpComputerStatus -EA SilentlyContinue
    if ($defender) {
        $result.security.av = @{
            name               = "Windows Defender"
            enabled            = $defender.AntivirusEnabled
            realtime_enabled   = $defender.RealTimeProtectionEnabled
            signature_date     = $defender.AntivirusSignatureLastUpdated.ToString("yyyy-MM-dd")
            signature_outdated = ($defender.AntivirusSignatureLastUpdated -lt (Get-Date).AddDays(-7))
        }
    }
    $avProducts = Get-CimInstance -Namespace "root/SecurityCenter2" -ClassName "AntiVirusProduct" -EA SilentlyContinue
    $result.security.av_products = @($avProducts | ForEach-Object { $_.displayName })

    $fw = Get-NetFirewallProfile -EA SilentlyContinue
    $result.security.firewall = @{
        domain_enabled  = ($fw | Where-Object { $_.Name -eq "Domain" }).Enabled
        private_enabled = ($fw | Where-Object { $_.Name -eq "Private" }).Enabled
        public_enabled  = ($fw | Where-Object { $_.Name -eq "Public" }).Enabled
    }

    $bl = Get-BitLockerVolume -EA SilentlyContinue
    $result.security.bitlocker = @{
        enabled = ($bl | Where-Object { $_.ProtectionStatus -eq "On" }).Count -gt 0
        volumes = @($bl | ForEach-Object {
            @{ drive = $_.MountPoint; status = $_.ProtectionStatus.ToString() }
        })
    }

    $uac = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -EA SilentlyContinue
    $result.security.uac_enabled = ($uac.EnableLUA -eq 1)
} catch { $result.errors += "security: $_" }

# -- 5. SERVISLER ------------------------------------------------------------
try {
    $services = Get-Service | Where-Object { $_.Status -eq "Running" }
    $result.services.running_count = @($services).Count
    $result.services.security_services = @{
        windows_defender = (Get-Service "WinDefend"      -EA SilentlyContinue).Status -eq "Running"
        windows_update   = (Get-Service "wuauserv"       -EA SilentlyContinue).Status -eq "Running"
        event_log        = (Get-Service "EventLog"       -EA SilentlyContinue).Status -eq "Running"
        remote_registry  = (Get-Service "RemoteRegistry" -EA SilentlyContinue).Status -eq "Running"
        telnet           = (Get-Service "TlntSvr"        -EA SilentlyContinue).Status -eq "Running"
    }
    $tasks = Get-ScheduledTask | Where-Object { $_.State -eq "Ready" -and $_.TaskPath -notlike "\Microsoft\*" }
    $result.services.custom_scheduled_tasks = @($tasks | ForEach-Object {
        @{ name = $_.TaskName; path = $_.TaskPath; state = $_.State.ToString() }
    })
} catch { $result.errors += "services: $_" }

# -- 6. DISK -----------------------------------------------------------------
try {
    $disks = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used }
    $result.disks = @($disks | ForEach-Object {
        @{
            drive    = $_.Name
            used_gb  = [math]::Round($_.Used / 1GB, 1)
            free_gb  = [math]::Round($_.Free / 1GB, 1)
            total_gb = [math]::Round(($_.Used + $_.Free) / 1GB, 1)
        }
    })
} catch { $result.errors += "disks: $_" }

# -- 7. KIMLIK & ERISIM (AD veya Yerel) ----------------------------------------

$result.identity = @{
    ad_available = $false
    mode         = "local"
    findings     = @()
}

$adAvailable = $false
try {
    $domainInfo = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
    $adAvailable = $true
} catch { }

$adModuleAvailable = $null -ne (Get-Module -ListAvailable -Name "ActiveDirectory")

if ($adAvailable -and $adModuleAvailable) {
    $result.identity.ad_available = $true
    $result.identity.mode = "active_directory"
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
        $domain = Get-ADDomain
        $result.identity.domain_name              = $domain.DNSRoot
        $result.identity.domain_functional_level  = $domain.DomainMode.ToString()
        $result.identity.forest_functional_level  = (Get-ADForest).ForestMode.ToString()

        $allUsers      = Get-ADUser -Filter * -Properties Enabled, LastLogonDate, PasswordExpired, PasswordNeverExpires, PasswordLastSet
        $enabledUsers  = $allUsers | Where-Object { $_.Enabled -eq $true }
        $disabledUsers = $allUsers | Where-Object { $_.Enabled -eq $false }
        $result.identity.total_users    = @($allUsers).Count
        $result.identity.enabled_users  = @($enabledUsers).Count
        $result.identity.disabled_users = @($disabledUsers).Count

        $staleThreshold = (Get-Date).AddDays(-90)
        $staleUsers = $enabledUsers | Where-Object { $_.LastLogonDate -ne $null -and $_.LastLogonDate -lt $staleThreshold }
        $result.identity.stale_users_90d = @($staleUsers).Count

        $kerberoastable = Get-ADUser -Filter { ServicePrincipalName -ne "$null" -and Enabled -eq $true } -Properties ServicePrincipalName
        $result.identity.kerberoastable_accounts = @($kerberoastable).Count

        $asrepRoastable = Get-ADUser -Filter { DoesNotRequirePreAuth -eq $true -and Enabled -eq $true } -Properties DoesNotRequirePreAuth -EA SilentlyContinue
        $result.identity.asrep_roastable = if ($asrepRoastable) { @($asrepRoastable).Count } else { 0 }

        try {
            $adminSDHolder = Get-ADUser -Filter { AdminCount -eq 1 -and Enabled -eq $true }
            $result.identity.admin_sd_holder = @($adminSDHolder).Count
        } catch { $result.identity.admin_sd_holder = $null }

        try {
            $lockout30 = Search-ADAccount -LockedOut | Where-Object { $_.LastBadPasswordAttempt -gt (Get-Date).AddDays(-30) }
            $result.identity.lockouts_30d = @($lockout30).Count
        } catch { $result.identity.lockouts_30d = $null }

        try {
            $gpos = Get-GPO -All
            $result.identity.gpo_count    = @($gpos).Count
            $result.identity.gpo_unlinked = @($gpos | Where-Object { $_.GpoStatus -eq "AllSettingsDisabled" }).Count
        } catch { $result.identity.gpo_count = $null; $result.errors += "gpo: $_" }

        $domainAdmins = Get-ADGroupMember "Domain Admins" -Recursive -EA SilentlyContinue
        $result.identity.domain_admin_count = if ($domainAdmins) { @($domainAdmins).Count } else { 0 }

        $oldPwdAdmins = $domainAdmins | ForEach-Object {
            Get-ADUser $_ -Properties PasswordLastSet -EA SilentlyContinue
        } | Where-Object { $_.PasswordLastSet -ne $null -and $_.PasswordLastSet -lt (Get-Date).AddDays(-365) }
        $result.identity.admins_old_password = @($oldPwdAdmins).Count

        $pwPolicy = Get-ADDefaultDomainPasswordPolicy -EA SilentlyContinue
        if ($pwPolicy) {
            $result.identity.password_policy = @{
                min_length         = $pwPolicy.MinPasswordLength
                complexity_enabled = $pwPolicy.ComplexityEnabled
                max_age_days       = $pwPolicy.MaxPasswordAge.Days
                min_age_days       = $pwPolicy.MinPasswordAge.Days
                lockout_threshold  = $pwPolicy.LockoutThreshold
                reversible_encryption = $pwPolicy.ReversibleEncryptionEnabled
            }
        }

        try {
            $fgpp = Get-ADFineGrainedPasswordPolicy -Filter * -EA SilentlyContinue
            $result.identity.fine_grained_policies = @($fgpp).Count
        } catch { $result.identity.fine_grained_policies = 0 }

        $kerbStale = Get-ADUser -Filter { ServicePrincipalName -ne "$null" -and Enabled -eq $true } -Properties ServicePrincipalName
        $result.identity.kerberoastable_accounts = @($kerbStale).Count

        $neverExpire = $enabledUsers | Where-Object { $_.PasswordNeverExpires -eq $true }
        $result.identity.password_never_expires = @($neverExpire).Count

        try {
            $rdpNla = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" `
                -Name "UserAuthenticationRequired" -EA SilentlyContinue).UserAuthenticationRequired
            $result.identity.rdp_nla_enabled = ($rdpNla -eq 1)
        } catch { $result.errors += "rdp_nla: $_" }

    } catch { $result.identity.ad_error = $_.ToString(); $result.errors += "ad_module: $_" }

} elseif ($adAvailable -and -not $adModuleAvailable) {
    $result.identity.ad_available      = $true
    $result.identity.mode              = "adsi_fallback"
    $result.identity.ad_module_missing = $true
    $result.identity.note              = "AD modulu yuklu degil. RSAT yukleyerek daha fazla bilgi toplanabilir."
    try {
        $searcher = New-Object DirectoryServices.DirectorySearcher
        $searcher.Filter = "(&(objectClass=user)(objectCategory=person))"
        $searcher.PageSize = 1000
        $results = $searcher.FindAll()
        $result.identity.total_users = $results.Count
    } catch { $result.errors += "adsi: $_" }

} else {
    $result.identity.mode = "local_security_policy"
    try {
        $netAccounts = net accounts 2>&1
        $minPwdLen  = ($netAccounts | Select-String "Minimum password length").ToString() -replace "\D",""
        $maxPwdAge  = ($netAccounts | Select-String "Maximum password age").ToString() -replace "\D",""
        $lockoutThr = ($netAccounts | Select-String "Lockout threshold").ToString() -replace "\D",""
        $result.identity.local_policy = @{
            min_password_length = if ($minPwdLen)  { [int]$minPwdLen }  else { $null }
            max_password_age_days = if ($maxPwdAge -and $maxPwdAge -ne "Unlimited") { [int]$maxPwdAge } else { $null }
            lockout_threshold   = if ($lockoutThr) { [int]$lockoutThr } else { $null }
        }
    } catch { $result.errors += "net_accounts: $_" }

    try {
        $localAdmins = Get-LocalGroupMember -Group "Administrators"
        $result.identity.local_admins = @($localAdmins | ForEach-Object {
            @{ name = $_.Name; type = $_.PrincipalSource.ToString() }
        })
        $result.identity.local_admin_count = @($localAdmins).Count
    } catch { $result.errors += "local_admins: $_" }

    $guestEnabled = (Get-LocalUser -Name "Guest" -EA SilentlyContinue).Enabled
    $result.identity.guest_account_enabled = ($guestEnabled -eq $true)

    try {
        $tmpFile = "$env:TEMP\secedit_export.cfg"
        secedit /export /cfg $tmpFile /quiet 2>$null
        if (Test-Path $tmpFile) {
            $secedit = Get-Content $tmpFile
            $pwdComplexity = ($secedit | Select-String "PasswordComplexity").ToString() -match "= 1"
            $minPwdLen2    = ($secedit | Select-String "MinimumPasswordLength") -replace ".*= ",""
            $result.identity.secedit = @{
                password_complexity = $pwdComplexity
                min_password_length = if ($minPwdLen2) { [int]$minPwdLen2.Trim() } else { $null }
            }
            Remove-Item $tmpFile -Force
        }
    } catch { $result.errors += "secedit: $_" }

    try {
        $rdpNla = (Get-ItemProperty `
            "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" `
            -Name "UserAuthenticationRequired" -EA SilentlyContinue).UserAuthenticationRequired
        $result.identity.rdp_nla_enabled = ($rdpNla -eq 1)
    } catch { $result.errors += "rdp_nla: $_" }
}

# -- CIKTI -------------------------------------------------------------------
$json = $result | ConvertTo-Json -Depth 8

Write-Host "Tarama Tamamlandi." -ForegroundColor Green
Write-Host "Hata sayisi: $($result.errors.Count)" -ForegroundColor $(if ($result.errors.Count -eq 0) { "Green" } else { "Yellow" })

if ($OutputFile) {
    $json | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "Dosya kaydedildi: $OutputFile" -ForegroundColor Cyan
}

if ($ApiKey -and $ApiKey -ne "{{API_KEY}}" -and $ApiUrl -and $ApiUrl -ne "{{API_URL}}") {
    try {
        $headers = @{ "Authorization" = "Bearer $ApiKey"; "Content-Type" = "application/json" }
        $response = Invoke-RestMethod -Uri "$ApiUrl/api/internal-scan/upload" -Method POST -Headers $headers -Body $json
        Write-Host "Platform'a gonderildi. Skor: $($response.internalScore)" -ForegroundColor Green
    } catch {
        Write-Host "API gonderimi basarisiz: $_" -ForegroundColor Red
        Write-Host "Dosyayi manuel yukleyin." -ForegroundColor Yellow
    }
}

Write-Output $json
