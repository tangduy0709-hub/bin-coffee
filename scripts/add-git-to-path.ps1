$old = [Environment]::GetEnvironmentVariable('PATH','User')
if ([string]::IsNullOrEmpty($old)) {
  [Environment]::SetEnvironmentVariable('PATH','C:\Program Files\Git\cmd','User')
  Write-Output 'Added PATH (new)'
} elseif ($old -notlike '*C:\Program Files\Git\cmd*') {
  [Environment]::SetEnvironmentVariable('PATH',$old + ';C:\Program Files\Git\cmd','User')
  Write-Output 'Appended PATH.'
} else {
  Write-Output 'PATH already contains Git.'
}

# Show resulting User PATH entries containing Git for verification
[Environment]::GetEnvironmentVariable('PATH','User') -split ';' | Where-Object { $_ -match 'Git' } | ForEach-Object { Write-Output "User PATH contains: $_" }
