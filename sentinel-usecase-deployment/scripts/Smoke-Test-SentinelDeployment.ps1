#Requires -Version 7.2
<#
.SYNOPSIS
Exercises the supplied deployment script's end-to-end validation and Azure read path without PUTs.

.DESCRIPTION
Runs Deploy-SentinelUseCases.ps1 with -Apply -WhatIf. This validates the CSV and KQL, checks the
configured workspace, and resolves whether each rule would be created or updated. -WhatIf causes
the script's ShouldProcess guard to skip every Microsoft Sentinel PUT request.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [string]$ResourceGroupName = 'rg-surya-sentinel-lab',
    [string]$WorkspaceName = 'law-surya-sentinel-lab',
    [Parameter(Mandatory)][string]$CsvPath,
    [string]$DeploymentScript = '/Users/suryap/Library/Mobile Documents/com~apple~CloudDocs/Surya_Professional_Repository/MS_Sentinel/Deploy-SentinelUseCases.ps1'
)

& $DeploymentScript `
    -SubscriptionId $SubscriptionId `
    -ResourceGroupName $ResourceGroupName `
    -WorkspaceName $WorkspaceName `
    -CsvPath $CsvPath `
    -Apply `
    -WhatIf `
    -Confirm:$false
