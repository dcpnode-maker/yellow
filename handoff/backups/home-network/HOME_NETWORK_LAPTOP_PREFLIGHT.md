# Home network laptop preflight

## Scope and known setup

This is a read-only preflight for laptop session `01a0ecbc-469b-7671-b1d1-d3e6bab40c98`, which is the controller. The subscribed service is JioFiber 100 Mbps. The Jio router connects by RJ45 Ethernet to the WAN port of a Tenda AC10; the laptop is connected to the Tenda, but whether by Ethernet or Wi-Fi is unknown. The cloud environment has no home LAN access.

Do not dispatch jobs, contact anyone, scan the LAN, inspect or request passwords, or change router settings. Do not access or mention CompSetStudio. Do not use accountcredits or invoke workers. If quota is reported at or below 1%, pause, cease work, and checkpoint. This document does not claim that any home measurement or fix has been performed.

## Stage 1: identify the laptop link (Windows, read-only)

Run these in PowerShell. They report adapter/link state and gateway information without displaying saved WLAN keys or dumping full local identifiers:

```powershell
Get-NetAdapter | Select-Object Name, Status, LinkSpeed, InterfaceDescription
Get-NetIPConfiguration | Select-Object InterfaceAlias, IPv4Address, IPv4DefaultGateway
```

If the active adapter is Wi-Fi, inspect current association and signal without exporting WLAN profiles:

```powershell
netsh wlan show interfaces
```

Record only the active connection's radio type, channel, receive/transmit rate, and signal percentage. Do not run `netsh wlan show profiles` or include BSSID, SSID, MAC, or IP values in a shared report. If needed, the current channel width and band can be checked in Windows Settings > Network & internet > Wi-Fi > hardware properties; do not change settings.

For a wired adapter, note `LinkSpeed`. A reported 100 Mbps link is a link-negotiation observation, not an internet throughput result. If the active path is unclear, stop and identify which adapter carries the default route before testing.

## Stage 2: establish comparable baselines

First record a quiet, idle baseline at the laptop: adapter/link type, link speed or Wi-Fi band/channel/signal, time, and a short sequence of gateway latency samples. Use the default gateway shown locally; avoid sharing its address. For example, substitute the locally observed gateway privately:

```powershell
ping -n 20 <default-gateway>
```

Measure three paths separately where practical:

1. **Direct Jio baseline:** connect the laptop by Ethernet directly to a Jio LAN port, bypassing Tenda. Record negotiated link speed and a bounded speed-test result.
2. **Tenda wired LAN:** connect by Ethernet to a Tenda LAN port. Record negotiated link speed and the same bounded speed test.
3. **Tenda Wi-Fi:** disconnect Ethernet, test near the Tenda with line-of-sight, then at the normal work location. Record band, channel, channel width if visible, signal, and the same bounded speed test.

Keep the test endpoint and device constant where possible. Take one idle latency sample before each test, then one loaded-latency sample during the test (gateway and a public test endpoint if already known). Record download, upload, latency, and test time. Jio describes consumer Fiber as symmetric for download and upload; observed results can vary with Wi-Fi, device, congestion, endpoint, and plan provisioning. A 100 Mbps subscription is the practical service ceiling, not a promise that every test will show exactly 100 Mbps.

Speed tests generate traffic. They are separate from this read-only preflight and should run only under the user's already granted, explicit, bounded network-test authorization. Use one test at a time, stop if other work is disrupted, and do not run scans, repeated loops, or tests during active builds. If that bounded authorization is unavailable or its scope is unclear, collect only link and radio observations and stop before generating traffic.

## Stage 3: interpret before recommending a change

- If direct Jio and Tenda wired results are similar, but Wi-Fi is lower or unstable, investigate placement, band, channel crowding, and client capability before considering router replacement.
- If direct Jio is healthy but Tenda wired is materially lower, first verify negotiated Ethernet rates and the exact AC10 hardware version. Do not change configuration based on model appearance alone.
- If direct Jio is low as well, compare at another quiet time under the same bounded test conditions; the evidence may point to service, endpoint, or local conditions and does not establish a router fault.
- A high PHY rate is not expected application throughput. AC10 marketing figures such as 867 + 300 Mbps describe Wi-Fi PHY rates and cannot exceed the 100 Mbps service ceiling as internet throughput.

Do not reset, flash, disable a firewall, configure DMZ, or change WAN/LAN settings during preflight. No recommendation to switch operating mode is made until the hardware version and guest isolation requirements are verified.

## Official references supplied for this plan

- [Tenda AC10 V4 user guide](https://static.tenda.com.cn/tdeweb/download/AC10/AC10V4.0%20User%20Guide.pdf)
- [Tenda AC10 V3 user guide](https://static.tenda.com.cn/tdeweb/download/AC10V3.0/AC10V3.0_User%20Guide.pdf)
- [Tenda AC10 V6 support](https://www.tendacn.com/product/support/AC10v60)
- [JioFiber postpaid benefits](https://www.jio.com/help/faq/jiofiber/postpaid-offerings/about-postpaid/what-are-the-key-benefits-of-jiofiber-postpaid-offer/)
- [Jio Internet Leased Line](https://www.jio.com/business/services/connectivity/internet-leased-line/)
