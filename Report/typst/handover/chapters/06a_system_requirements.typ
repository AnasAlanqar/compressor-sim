#import "../../template.typ": *

#part[Part II --- Using the Simulator]

= System Requirements and Deployment Considerations <sec-sysreq>

The simulator is a real-time process simulator with a desktop HMI — it computes and displays the
process model described in Part I and exchanges tags with a PLC over OPC UA. It does not perform
CFD, FEA, AI inference, 3D rendering, or other high-performance computing tasks, and its
computational requirements are modest.

*One instance* means one copy of the Compressor Simulator application running at a given time —
for example, one simulator application running is one instance; two simulator applications
running simultaneously are two instances; a machine running several separate simulator instances
for several concurrent PLC tests is running multiple instances.

For deployment planning, the following configuration provides a practical baseline for running
one Compressor Simulator application at a time. These are practical planning figures, not the
result of formal minimum-hardware qualification testing.

#data-table(
  ([], [Minimum practical configuration], [Recommended configuration]),
  (
    ([Operating environment], [64-bit Windows], [64-bit Windows, standard desktop, VM, or Server
      environment with an interactive desktop session]),
    ([Processor], [Dual-core 64-bit, approximately Intel Core i3 / Pentium Gold class, AMD
      equivalent, or better], [Intel Core i3 class or better — Core i5 or higher is more than
      sufficient but not required for normal operation]),
    ([Virtual machine / server CPU], [2 vCPU], [2 or more vCPU]),
    ([Memory], [4 GB RAM], [8 GB RAM or more]),
    ([Disk space], [Approximately 1 GB available], [Approximately 1 GB available]),
    ([Network], [Standard Ethernet/network connectivity when OPC UA communication with a PLC is
      required], [Same]),
    ([Graphics], [No dedicated GPU required], [No dedicated GPU required]),
  )
)

The simulator has modest computational requirements and does not require specialised computing
hardware or a dedicated graphics processor for normal operation.

== Server and Virtual-Machine Deployment

The current release is an interactive Windows desktop application, intended to operate within an
interactive Windows session. A Windows virtual machine or Windows Server environment with desktop
access can therefore be used, subject to normal operating-system and network requirements,
including normal network access to the PLC / OPC UA endpoint. The current release is not a
headless Windows service, and headless (no interactive session) deployment has not been tested or
validated.

== Multiple Instances

If several simulator applications are run simultaneously, the required CPU and memory should be
increased according to the number of active instances, with additional capacity reserved for
Windows and any PLC runtime, engineering software, or other workloads hosted on the same machine.
No maximum number of simultaneous instances is specified here.

A normal Windows PC or small Windows VM is sufficient for running one Compressor Simulator
application. A dedicated GPU or high-end workstation is not required. Larger server resources are
mainly relevant when several simulator applications or other workloads are running at the same
time.
