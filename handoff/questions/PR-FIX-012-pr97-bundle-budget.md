# PR-FIX-012 - Genuine frontend size failure

## RESOLVED implementation scope

The committed entry is 215300 bytes. Shared local voice, API and query modules are
large static imports of the entry and also serve lazy workspaces. An explicit
existing-source chunk is a bounded build configuration change; it does not require
discarding features or weakening the delivery budget. PR-FIX-012 admits the config,
paired test and only its directly generated public/yellow-next output.
