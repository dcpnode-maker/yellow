# Home network upgrade criteria

## Current decision

No upgrade or configuration change is justified from the information currently available. The known service is JioFiber 100 Mbps, with a Jio gateway feeding a Tenda AC10 by Ethernet. Laptop connection type, AC10 hardware revision, negotiated link rates, Wi-Fi conditions, and measured throughput are still unknown. Complete the laptop preflight and compare direct-Jio, Tenda-wired, and Tenda-Wi-Fi results before deciding.

The 100 Mbps subscription sets the near-term internet throughput context. A newer Wi-Fi radio may improve local coverage, consistency, or performance among devices, but it cannot turn this service into a faster internet plan. Jio describes consumer Fiber as symmetric download/upload. A dedicated, uncontended service with a guaranteed SLA is a different product category: Jio's leased-line description does not support promising that a residential fiber plan behaves as a 1:1 dedicated circuit.

## Decision gates

1. **Confirm the exact Tenda model and revision** from its label or administration page without changing settings. AC10 V3/V4 behavior and AC10 V6 port specifications must not be inferred from an AC6 lookalike or from the product name alone. The supplied V6 support page specifies one gigabit WAN and three gigabit LAN ports; older AC6 hardware can look similar and may have Fast Ethernet ports. Verify the unit itself.
2. **Check the bottleneck with measurements.** Compare direct Jio Ethernet, Tenda Ethernet, and Tenda Wi-Fi using the same laptop and bounded test method. A 100 Mbps Ethernet negotiation, a consistent drop only through Tenda, or a Wi-Fi-only drop changes what is worth investigating. Do not infer throughput from advertised 867 + 300 Mbps Wi-Fi PHY rates.
3. **Check Wi-Fi conditions before replacing hardware.** Record client support, band, signal, channel, and width. On 2.4 GHz, use 20 MHz and compare only the distinct non-overlapping channels 1, 6, and 11 against local crowding. On 5 GHz, compare 40 MHz or 80 MHz based on measured crowding and stability; a wider channel is not automatically better.
4. **Check guest isolation and household needs before AP mode.** The supplied AC10 V3/V4 guides describe AP mode for a single Jio gateway with DHCP supplied by that gateway and wired backhaul. In AP mode, all ports act as LAN ports, the Tenda reboots and receives a new LAN IP, and bandwidth control and port forwarding are unavailable. Verify the actual hardware revision and that guest isolation remains adequate before recommending a switch. If those needs are uncertain, keep the current mode pending measurements and review.
5. **Choose the smallest change that addresses the measured limit.** Keep the topology if direct and Tenda-wired results are comparable and Wi-Fi meets the household's needs. Consider placement or channel changes only after observations support them. Consider AP mode only when a single-gateway network is desired and its feature tradeoffs are acceptable. Consider newer Wi-Fi hardware only if measured wireless coverage/capability is the limiting factor or local device-to-device speed is a stated need. Consider a faster service plan only if internet throughput is the limiting factor and the household needs more than 100 Mbps.

## Safety and operating limits

Any recommendation remains conditional until the model revision, guest-isolation requirement, and comparative results are known. No reset, DMZ, firewall disablement, automatic firmware flashing, or unreviewed WAN/LAN change is part of these criteria. Preserve the current configuration during measurement. Do not claim a fix or a specific speed from these planning notes.

## Official references supplied for this plan

- [Tenda AC10 V4 user guide](https://static.tenda.com.cn/tdeweb/download/AC10/AC10V4.0%20User%20Guide.pdf)
- [Tenda AC10 V3 user guide](https://static.tenda.com.cn/tdeweb/download/AC10V3.0/AC10V3.0_User%20Guide.pdf)
- [Tenda AC10 V6 support](https://www.tendacn.com/product/support/AC10v60)
- [JioFiber postpaid benefits](https://www.jio.com/help/faq/jiofiber/postpaid-offerings/about-postpaid/what-are-the-key-benefits-of-jiofiber-postpaid-offer/)
- [Jio Internet Leased Line](https://www.jio.com/business/services/connectivity/internet-leased-line/)
