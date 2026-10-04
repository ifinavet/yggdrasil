# Google connection diagnostics

OAuth failures are shown once in the access overview banner. Google error codes and descriptions are retained, bounded to 1,000 characters. Only diagnostic fields are read; request assertions, keys, access tokens and account passwords are redacted when echoed. Malformed/non-JSON responses retain the HTTP status.

The existing “Sjekk Google og Slack nå” action checks authentication again. Successful authentication clears the banner; blocked account jobs still require their existing retry action. Account-specific Directory errors stay on the account. Existing saved OAuth failures are also presented in the banner until the first new connection check.

Check `invalid_client` against the service account/key pair, and `unauthorized_client` against Workspace domain-wide delegation (numeric client ID, the `admin.directory.user` scope and the delegated admin). These messages diagnose configuration; they do not change credentials or permissions.

Reference: https://developers.google.com/identity/protocols/oauth2/service-account
